from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.api.dependencies import get_current_user, get_dashboard_service
from app.modules.dashboard.router import router
from app.modules.dashboard.service import DashboardService


@pytest.mark.anyio
async def test_metrics_use_bogota_date_and_exclusive_end_of_day():
    repository = SimpleNamespace(
        daily_sales=AsyncMock(return_value={"sales_total_cop": 17000, "units_sold": 4}),
        low_stock_count=AsyncMock(return_value=2),
    )
    result = await DashboardService(repository).metrics(datetime(2026, 11, 20, 4, 59, tzinfo=UTC))
    assert str(result["date"]) == "2026-11-19"
    assert result["sales_total_cop"] == 17000 and result["units_sold"] == 4
    assert result["low_stock_count"] == 2
    repository.daily_sales.assert_awaited_once_with(
        datetime(2026, 11, 19, 5, tzinfo=UTC), datetime(2026, 11, 20, 5, tzinfo=UTC),
    )


def test_dashboard_is_admin_only():
    app = FastAPI()
    app.include_router(router)
    metrics = AsyncMock(return_value={"date": "2026-11-19", "sales_total_cop": 0, "units_sold": 0, "low_stock_count": 0})
    app.dependency_overrides[get_dashboard_service] = lambda: SimpleNamespace(metrics=metrics)
    app.dependency_overrides[get_current_user] = lambda: {"_id": "vendor", "role": "vendor"}
    client = TestClient(app)
    assert client.get("/api/dashboard/metrics").status_code == 403
    metrics.assert_not_awaited()
    app.dependency_overrides[get_current_user] = lambda: {"_id": "admin", "role": "admin"}
    response = client.get("/api/dashboard/metrics")
    assert response.status_code == 200
    assert response.json() == {"date": "2026-11-19", "sales_total_cop": 0, "units_sold": 0, "low_stock_count": 0}
