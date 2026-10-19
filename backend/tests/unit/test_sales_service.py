import pytest

from app.modules.cash_register.errors import CashSessionNotOpenError
from app.modules.inventory.errors import InsufficientStockError
from app.modules.sales.errors import (
    DuplicateIdempotencyKeyError,
    InsufficientCashReceivedError,
    IdempotencyKeyConflictError,
)
from app.modules.sales.schemas import SaleCreate
from app.modules.sales.service import SalesService


PRODUCT_ID = "64b7f6c2a3f9d4e1c8b01234"


class FakeTransactions:
    async def run(self, operation):
        return await operation(object())


class FakeSales:
    def __init__(self):
        self.sales = {}

    async def create(self, sale, *, session):
        key = sale["idempotency_key"]
        if key in self.sales:
            raise DuplicateIdempotencyKeyError
        self.sales[key] = sale.copy()
        return self.sales[key]

    async def get_by_idempotency_key(self, key):
        return self.sales.get(key)


class FakeInventory:
    def __init__(self, stock=10):
        self.product = {
            "_id": PRODUCT_ID,
            "sku": "CAM-ROJ-M",
            "name": "Camiseta",
            "size": "M",
            "color": "Rojo",
            "unit_price_cop": 25000,
            "stock_quantity": stock,
            "is_active": True,
        }

    async def get_by_id(self, product_id, *, session=None):
        return self.product if product_id == PRODUCT_ID else None

    async def decrement_for_sale(
        self, product_id, quantity, expected_price_cop, actor_id, sale_id, *, session
    ):
        if self.product["unit_price_cop"] != expected_price_cop:
            from app.modules.sales.errors import ProductPriceChangedError

            raise ProductPriceChangedError
        if self.product["stock_quantity"] < quantity:
            raise InsufficientStockError
        self.product["stock_quantity"] -= quantity


class FakeCashSessions:
    def __init__(self):
        self.session = {"_id": "cash-1", "status": "open"}
        self.total_by_payment = {"cash": 0, "card": 0, "transfer": 0}

    async def get_open_session(self, *, session=None):
        return self.session

    async def add_sale_total(self, session_id, amount_cop, *, session):
        self.total_by_payment["cash"] += amount_cop
        return True


def make_service(stock=10):
    sales = FakeSales()
    inventory = FakeInventory(stock)
    sessions = FakeCashSessions()
    return SalesService(sales, inventory, sessions, FakeTransactions()), sales, inventory, sessions


def make_sale(quantity=2, cash_received_cop=None):
    return SaleCreate(
        items=[{"product_id": PRODUCT_ID, "quantity": quantity}],
        cash_received_cop=cash_received_cop if cash_received_cop is not None else 25000 * quantity,
    )


@pytest.mark.anyio
async def test_sale_snapshots_server_price_and_updates_stock_and_cash_once():
    service, sales, inventory, sessions = make_service()

    result = await service.create_sale(
        make_sale(), actor_id="vendor-1", idempotency_key="sale-request-001"
    )

    assert result["total_cop"] == 50000
    assert result["cash_received_cop"] == 50000
    assert result["change_cop"] == 0
    assert result["items"][0]["unit_price_cop"] == 25000
    assert inventory.product["stock_quantity"] == 8
    assert sessions.total_by_payment["cash"] == 50000
    assert len(sales.sales) == 1


@pytest.mark.anyio
async def test_sale_retry_returns_existing_sale_without_changing_stock_twice():
    service, _, inventory, sessions = make_service()
    request = make_sale()

    first = await service.create_sale(
        request, actor_id="vendor-1", idempotency_key="sale-request-002"
    )
    replay = await service.create_sale(
        request, actor_id="vendor-1", idempotency_key="sale-request-002"
    )

    assert replay == first
    assert inventory.product["stock_quantity"] == 8
    assert sessions.total_by_payment["cash"] == 50000


@pytest.mark.anyio
async def test_idempotency_key_cannot_be_reused_with_different_payload():
    service, _, _, _ = make_service()
    await service.create_sale(
        make_sale(1), actor_id="vendor-1", idempotency_key="sale-request-003"
    )

    with pytest.raises(IdempotencyKeyConflictError):
        await service.create_sale(
            make_sale(2), actor_id="vendor-1", idempotency_key="sale-request-003"
        )


@pytest.mark.anyio
async def test_sale_rejects_insufficient_stock_and_closed_cash_session():
    service, sales, inventory, sessions = make_service(stock=1)

    with pytest.raises(InsufficientStockError):
        await service.create_sale(
            make_sale(2), actor_id="vendor-1", idempotency_key="sale-request-004"
        )
    assert sales.sales == {}
    assert inventory.product["stock_quantity"] == 1

    sessions.session = None
    with pytest.raises(CashSessionNotOpenError):
        await service.create_sale(
            make_sale(), actor_id="vendor-1", idempotency_key="sale-request-005"
        )


@pytest.mark.anyio
async def test_sale_calculates_cash_change_and_rejects_short_payment():
    service, sales, inventory, sessions = make_service()
    result = await service.create_sale(
        make_sale(quantity=2, cash_received_cop=60000),
        actor_id="vendor-1",
        idempotency_key="sale-cash-change-01",
    )

    assert result["change_cop"] == 10000
    assert sessions.total_by_payment["cash"] == 50000

    service, sales, inventory, sessions = make_service()
    with pytest.raises(InsufficientCashReceivedError):
        await service.create_sale(
            make_sale(quantity=2, cash_received_cop=49999),
            actor_id="vendor-1",
            idempotency_key="sale-cash-short-01",
        )
    assert sales.sales == {}
    assert inventory.product["stock_quantity"] == 10
    assert sessions.total_by_payment["cash"] == 0
