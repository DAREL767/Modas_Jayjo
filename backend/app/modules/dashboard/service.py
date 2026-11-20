from asyncio import gather
from datetime import UTC, datetime, time, timedelta, timezone
from typing import Protocol

BOGOTA = timezone(timedelta(hours=-5))


class DashboardRepositoryPort(Protocol):
    async def daily_sales(self, start: datetime, end: datetime) -> dict: ...
    async def low_stock_count(self) -> int: ...


class DashboardService:
    def __init__(self, repository: DashboardRepositoryPort):
        self.repository = repository

    async def metrics(self, now: datetime | None = None) -> dict:
        now = now or datetime.now(UTC)
        day = now.astimezone(BOGOTA).date()
        start = datetime.combine(day, time.min, BOGOTA).astimezone(UTC)
        sales, low_stock = await gather(
            self.repository.daily_sales(start, start + timedelta(days=1)),
            self.repository.low_stock_count(),
        )
        return {
            "date": day,
            "sales_total_cop": sales["sales_total_cop"],
            "units_sold": sales["units_sold"],
            "low_stock_count": low_stock,
        }
