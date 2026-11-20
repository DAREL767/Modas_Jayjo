from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.authorization import require_roles
from app.api.dependencies import get_dashboard_service
from app.modules.dashboard.service import DashboardService
from app.modules.users.schemas import UserRole

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


class DashboardMetrics(BaseModel):
    date: date
    sales_total_cop: int
    units_sold: int
    low_stock_count: int


@router.get("/metrics", response_model=DashboardMetrics, dependencies=[Depends(require_roles([UserRole.ADMIN]))])
async def get_metrics(service: Annotated[DashboardService, Depends(get_dashboard_service)]):
    return await service.metrics()
