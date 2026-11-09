from datetime import UTC, datetime

from app.modules.changes.schemas import ChangeCreate
from app.modules.inventory.errors import InsufficientStockError, StockLimitExceededError


class ChangeError(Exception):
    def __init__(self, detail: str, status_code: int = 409):
        super().__init__(detail)
        self.status_code = status_code


def product_snapshot(product: dict, product_id: str) -> dict:
    return {"product_id": product_id, **{field: product[field] for field in ("sku", "name", "size", "color")}}


def return_lines(sale: dict) -> list[dict]:
    # Allocate the global discount across the original units without losing pesos to rounding.
    base = sum(line["line_total_cop"] for line in sale["items"])
    paid = sale["total_cop"]
    offset = 0
    result = []
    for line in sale["items"]:
        product_id = line["product_id"]
        returned = sale.get("returned_units", {}).get(product_id, 0)
        quantity = line["quantity"]
        unit = line["line_total_cop"] // quantity
        if returned < quantity:
            before = offset + returned * unit
            credit = ((before + unit) * paid // base - before * paid // base) if base else 0
            result.append({**product_snapshot(line, product_id), "remaining": quantity - returned, "credit_cop": credit})
        offset += line["line_total_cop"]
    return result


class ChangeService:
    def __init__(self, changes, inventory, sales, cash, transactions):
        self.changes = changes
        self.inventory = inventory
        self.sales = sales
        self.cash = cash
        self.transactions = transactions

    async def sale_lines(self, sale_id: str, *, session=None) -> list[dict]:
        sale = await self.sales.get_completed(sale_id, session=session)
        if sale is None:
            raise ChangeError("No se encontró la venta original.", 404)
        return return_lines(sale)

    async def _product(self, product_id: str, *, session=None) -> dict:
        product = await self.inventory.get_by_id(product_id, session=session)
        if product is None or not product.get("is_active", True):
            raise ChangeError("La variante debe estar activa en inventario para procesar el cambio.")
        return product

    async def _return_line(self, sale_id: str, product_id: str, *, session=None) -> dict:
        lines = await self.sale_lines(sale_id, session=session)
        line = next((line for line in lines if line["product_id"] == product_id), None)
        if line is None:
            raise ChangeError("La venta no tiene unidades disponibles para devolver de esta variante.")
        return line

    async def create(self, body: ChangeCreate, *, actor_id: str, request_id: str) -> dict:
        payload = body.model_dump(mode="json")
        existing = await self.changes.get(request_id)
        if existing is not None:
            return self._check_request(existing, actor_id, payload)
        product = await self._product(body.product_id)
        data = {
            **payload, "id": request_id, "status": "pending",
            "created_at": datetime.now(UTC), "requested_by": actor_id,
            "product": product_snapshot(product, body.product_id),
        }
        if body.kind == "defect":
            if product["stock_quantity"] < 1:
                raise ChangeError("No hay existencias de la prenda dañada para retirar.")
        else:
            line = await self._return_line(str(body.sale_id), body.product_id)
            replacement = await self._product(body.replacement_id)
            if replacement["stock_quantity"] < 1:
                raise ChangeError("La prenda elegida no tiene existencias.")
            price = replacement["unit_price_cop"]
            data.update(
                product=product_snapshot(line, body.product_id),
                replacement=product_snapshot(replacement, body.replacement_id),
                credit_cop=line["credit_cop"], replacement_price_cop=price,
                difference_cop=price - line["credit_cop"],
            )
        return self._check_request(await self.changes.create(data), actor_id, payload)

    @staticmethod
    def _check_request(existing: dict, actor_id: str, payload: dict) -> dict:
        if existing["requested_by"] != actor_id or any(existing.get(key) != value for key, value in payload.items()):
            raise ChangeError("La referencia ya pertenece a otra solicitud.")
        return existing

    async def approve(self, request_id: str, *, actor_id: str) -> dict:
        async def operation(session):
            request = await self.changes.resolve(request_id, "approved", actor_id, session=session)
            if request is None:
                raise ChangeError("La solicitud ya fue resuelta o no existe.")

            if request["kind"] == "defect":
                await self._move(request["product_id"], -1, request_id, "Retiro por defecto", actor_id, session)
                return request

            product_id, sale_id = request["product_id"], request["sale_id"]
            line = await self._return_line(sale_id, product_id, session=session)
            replacement = await self._product(request["replacement_id"], session=session)
            if (line["credit_cop"] != request["credit_cop"]
                    or replacement["unit_price_cop"] != request["replacement_price_cop"]):
                raise ChangeError("El importe cambió desde la solicitud. Recházala y registra una nueva.")

            difference = request["difference_cop"]
            if difference:
                cash = await self.cash.get_open_session(session=session)
                if cash is None:
                    raise ChangeError("Abre caja antes de aprobar un cambio con cobro o devolución.")
                available = cash["opening_cash_cop"] + cash["sales_cash_cop"] + cash.get("exchange_cash_cop", 0)
                if available + difference < 0:
                    raise ChangeError("El efectivo esperado en caja no alcanza para la devolución.")
                cash_id = str(cash["_id"])
                if not await self.cash.add_exchange_cash(cash_id, difference, session=session):
                    raise ChangeError("La caja dejó de estar abierta. Vuelve a intentarlo.")
                request = await self.changes.attach_cash(request_id, cash_id, session=session)

            await self._move(product_id, 1, request_id, "Reintegro por cambio", actor_id, session)
            await self._move(request["replacement_id"], -1, request_id, "Entrega por cambio", actor_id, session)
            # This write serializes approvals of separate requests for the same original sale.
            await self.sales.record_return(sale_id, product_id, session=session)
            return request

        return await self.transactions.run(operation)

    async def _move(self, product_id, delta, request_id, reason, actor_id, session):
        try:
            updated = await self.inventory.adjust_stock(
                product_id, delta, reason, actor_id, session=session, change_id=request_id,
            )
        except (InsufficientStockError, StockLimitExceededError) as error:
            raise ChangeError("Las existencias actuales impiden aplicar el movimiento.") from error
        if updated is None:
            raise ChangeError("Una de las prendas ya no está activa en inventario.")

    async def reject(self, request_id: str, *, actor_id: str) -> dict:
        request = await self.changes.resolve(request_id, "rejected", actor_id)
        if request is None:
            raise ChangeError("La solicitud ya fue resuelta o no existe.")
        return request
