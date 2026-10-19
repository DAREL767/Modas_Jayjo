from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_cash_register_service, get_current_user, get_inventory_service
from app.modules.cash_register.router import router as cash_register_router
from app.modules.inventory.router import router as inventory_router


class InventoryApiService:
    def __init__(self):
        self.created = None

    async def create_product(self, data, *, actor_id):
        self.created = (data, actor_id)
        return {
            "_id": "product-id",
            **data.model_dump(),
            "is_active": True,
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }

    async def update_product(self, product_id, data):
        return {}


class CashRegisterApiService:
    def __init__(self):
        self.history_args = None

    async def list_closed_sessions(self, start_at, end_at, *, skip, limit):
        self.history_args = (start_at, end_at, skip, limit)
        return []


def _product_payload():
    return {
        "sku": "SKU-1",
        "name": "Camisa",
        "category": "Superior",
        "size": "M",
        "color": "Azul",
        "unit_price_cop": 40000,
        "unit_cost_cop": 20000,
        "stock_quantity": 3,
        "low_stock_threshold": 1,
    }


def test_vendor_can_register_product_but_cost_is_not_persisted_or_exposed():
    app = FastAPI()
    app.include_router(inventory_router)
    service = InventoryApiService()
    app.dependency_overrides[get_current_user] = lambda: {
        "_id": "vendor-id",
        "role": "vendor",
    }
    app.dependency_overrides[get_inventory_service] = lambda: service

    response = TestClient(app).post("/api/inventory/", json=_product_payload())

    assert response.status_code == 201
    assert "unit_cost_cop" not in response.json()
    assert service.created is not None
    assert service.created[0].unit_cost_cop is None
    assert service.created[1] == "vendor-id"


def test_vendor_cannot_edit_product():
    app = FastAPI()
    app.include_router(inventory_router)
    app.dependency_overrides[get_current_user] = lambda: {
        "_id": "vendor-id",
        "role": "vendor",
    }
    app.dependency_overrides[get_inventory_service] = InventoryApiService

    response = TestClient(app).patch(
        "/api/inventory/product-id", json={"unit_price_cop": 45000}
    )

    assert response.status_code == 403


def test_cash_history_is_admin_only_and_uses_colombia_day_boundaries():
    app = FastAPI()
    app.include_router(cash_register_router)
    service = CashRegisterApiService()
    app.dependency_overrides[get_cash_register_service] = lambda: service
    app.dependency_overrides[get_current_user] = lambda: {
        "_id": "admin-id",
        "role": "admin",
    }
    client = TestClient(app)

    response = client.get(
        "/api/cash-register/history?start_date=2026-10-18&end_date=2026-10-18"
    )

    assert response.status_code == 200
    start_at, end_at, skip, limit = service.history_args
    assert start_at == datetime(2026, 10, 18, 5, tzinfo=UTC)
    assert end_at == datetime(2026, 10, 19, 5, tzinfo=UTC)
    assert (skip, limit) == (0, 50)

    app.dependency_overrides[get_current_user] = lambda: {
        "_id": "vendor-id",
        "role": "vendor",
    }
    assert client.get(
        "/api/cash-register/history?start_date=2026-10-18&end_date=2026-10-18"
    ).status_code == 403
