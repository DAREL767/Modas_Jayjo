from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_change_service, get_current_user, get_sales_service
from app.modules.changes.router import router
from app.modules.changes.service import return_lines
from app.modules.sales.router import router as sales_router


def test_original_paid_amount_is_allocated_exactly_over_all_returned_units():
    items = [
        {"product_id": key, "sku": key, "name": key, "size": "M", "color": "Azul", "quantity": 2, "line_total_cop": amount}
        for key, amount in [("first", 22), ("second", 10)]
    ]
    sale = {"items": items, "total_cop": 27, "returned_units": {}}
    credits = []
    for _ in range(4):
        line = return_lines(sale)[0]
        credits.append(line["credit_cop"])
        product_id = line["product_id"]
        sale["returned_units"][product_id] = sale["returned_units"].get(product_id, 0) + 1

    assert credits == [9, 9, 4, 5]
    assert return_lines(sale) == []


def test_vendor_cannot_list_or_resolve_requests():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: {"_id": "vendor-id", "role": "vendor"}
    client = TestClient(app)

    assert client.get("/api/changes/").status_code == 403
    assert client.post(f"/api/changes/{uuid4()}/approve").status_code == 403
    assert client.post(f"/api/changes/{uuid4()}/reject").status_code == 403


def test_report_filter_includes_the_entire_bogota_end_date():
    app = FastAPI()
    app.include_router(router)
    find = AsyncMock(return_value=[])
    app.dependency_overrides[get_current_user] = lambda: {"_id": "admin-id", "role": "admin"}
    app.dependency_overrides[get_change_service] = lambda: SimpleNamespace(changes=SimpleNamespace(list=find))
    response = TestClient(app).get(
        "/api/changes/?state=approved&start_date=2026-11-09&end_date=2026-11-09",
    )

    assert response.status_code == 200
    find.assert_awaited_once_with(
        state="approved", start=datetime(2026, 11, 9, 5, tzinfo=UTC),
        end=datetime(2026, 11, 10, 5, tzinfo=UTC), search="", skip=0, limit=50,
    )


def test_vendor_can_find_sales_by_date_but_cannot_open_cash_history():
    app = FastAPI()
    app.include_router(sales_router)
    history = AsyncMock(return_value=[])
    app.dependency_overrides[get_current_user] = lambda: {"_id": "vendor-id", "role": "vendor"}
    app.dependency_overrides[get_sales_service] = lambda: SimpleNamespace(history=history)
    client = TestClient(app)

    assert client.get("/api/sales/history?cash_session_id=000000000000000000000001").status_code == 403
    assert client.get("/api/sales/history").status_code == 422
    assert client.get("/api/sales/history?sale_date=2026-11-09&reference=SKU-01").status_code == 200
    history.assert_awaited_once_with(
        start=datetime(2026, 11, 9, 5, tzinfo=UTC), end=datetime(2026, 11, 10, 5, tzinfo=UTC),
        cash_session_id=None, reference="SKU-01", skip=0, limit=15,
    )
