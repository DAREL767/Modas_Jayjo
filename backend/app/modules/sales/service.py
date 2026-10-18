from datetime import UTC, datetime
import hashlib
import json
from uuid import uuid4

from app.modules.cash_register.errors import CashSessionNotOpenError
from app.modules.inventory.errors import InsufficientStockError, ProductNotFoundError
from app.modules.sales.errors import (
    DuplicateIdempotencyKeyError,
    IdempotencyKeyConflictError,
    ProductPriceChangedError,
    SaleTotalTooLargeError,
)
from app.modules.sales.ports import (
    SaleCashSessionPort,
    SaleInventoryPort,
    SaleRepositoryPort,
    TransactionRunnerPort,
)
from app.modules.sales.schemas import SaleCreate


class SalesService:
    def __init__(
        self,
        sales: SaleRepositoryPort,
        inventory: SaleInventoryPort,
        sessions: SaleCashSessionPort,
        transactions: TransactionRunnerPort,
    ) -> None:
        self._sales = sales
        self._inventory = inventory
        self._sessions = sessions
        self._transactions = transactions

    async def create_sale(
        self, data: SaleCreate, *, actor_id: str, idempotency_key: str
    ) -> dict:
        request_hash = hashlib.sha256(
            json.dumps(
                data.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
            ).encode("utf-8")
        ).hexdigest()

        async def operation(session):
            cash_session = await self._sessions.get_open_session(session=session)
            if cash_session is None:
                raise CashSessionNotOpenError

            line_items = []
            total = 0
            for requested in data.items:
                product = await self._inventory.get_by_id(
                    requested.product_id, session=session
                )
                if product is None or product.get("is_active", True) is False:
                    raise ProductNotFoundError
                if product["stock_quantity"] < requested.quantity:
                    raise InsufficientStockError
                unit_price = product["unit_price_cop"]
                line_total = unit_price * requested.quantity
                total += line_total
                line_items.append(
                    {
                        "product_id": requested.product_id,
                        "sku": product["sku"],
                        "name": product["name"],
                        "size": product["size"],
                        "color": product["color"],
                        "quantity": requested.quantity,
                        "unit_price_cop": unit_price,
                        "line_total_cop": line_total,
                    }
                )
            if total > 2_000_000_000:
                raise SaleTotalTooLargeError

            now = datetime.now(UTC)
            sale_id = str(uuid4())
            sale = {
                "sale_id": sale_id,
                "status": "completed",
                "items": line_items,
                "payment_method": data.payment_method.value,
                "total_cop": total,
                "cashier_id": actor_id,
                "cash_session_id": str(cash_session["_id"]),
                "idempotency_key": idempotency_key,
                "request_hash": request_hash,
                "created_at": now,
            }
            created = await self._sales.create(sale, session=session)

            for requested, line in zip(data.items, line_items, strict=True):
                await self._inventory.decrement_for_sale(
                    requested.product_id,
                    requested.quantity,
                    line["unit_price_cop"],
                    actor_id,
                    sale_id,
                    session=session,
                )

            registered = await self._sessions.add_sale_total(
                str(cash_session["_id"]),
                data.payment_method,
                total,
                session=session,
            )
            if not registered:
                raise CashSessionNotOpenError
            return created

        try:
            return await self._transactions.run(operation)
        except DuplicateIdempotencyKeyError as exc:
            existing = await self._sales.get_by_idempotency_key(idempotency_key)
            if (
                existing is None
                or existing.get("cashier_id") != actor_id
                or existing.get("request_hash") != request_hash
            ):
                raise IdempotencyKeyConflictError from exc
            return existing
