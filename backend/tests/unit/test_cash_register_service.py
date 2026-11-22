from datetime import UTC, datetime

import pytest

from app.modules.cash_register.errors import CashSessionAlreadyOpenError
from app.modules.cash_register.service import CashRegisterService


class FakeCashSessions:
    def __init__(self):
        self.current = None

    async def get_open_session(self, *, session=None):
        return self.current

    async def open_session(self, data):
        if self.current is not None:
            raise CashSessionAlreadyOpenError
        self.current = {"_id": "cash-1", **data}
        return self.current

    async def close_session(self, session_id, data):
        if self.current is None or self.current["status"] != "open":
            return None
        self.current.update(data)
        return self.current


@pytest.mark.anyio
async def test_close_session_calculates_expected_totals_and_discrepancies():
    repository = FakeCashSessions()
    repository.current = {
        "_id": "cash-1",
        "status": "open",
        "opening_cash_cop": 100000,
        "sales_cash_cop": 35000,
    }
    service = CashRegisterService(repository)

    closed = await service.close_session(
        134000,
        "admin-1",
        "Pagos electrónicos: $25.000; gasto de bolsas: $1.000",
    )

    assert closed["expected_cash_cop"] == 135000
    assert closed["counted_cash_cop"] == 134000
    assert closed["difference_cash_cop"] == -1000
    assert closed["closing_note"] == "Pagos electrónicos: $25.000; gasto de bolsas: $1.000"
    assert closed["status"] == "closed"
    assert isinstance(closed["closed_at"], datetime)
    assert closed["closed_at"].tzinfo == UTC


@pytest.mark.anyio
async def test_only_one_open_session_can_be_started():
    repository = FakeCashSessions()
    service = CashRegisterService(repository)
    await service.open_session(50000, "admin-1")

    with pytest.raises(CashSessionAlreadyOpenError):
        await service.open_session(25000, "admin-2")


@pytest.mark.anyio
async def test_history_delegates_a_bounded_period_and_pagination():
    from datetime import UTC, datetime

    class HistoryRepository(FakeCashSessions):
        async def list_closed_sessions(self, start_at, end_at, *, skip, limit):
            return [{"start_at": start_at, "end_at": end_at, "skip": skip, "limit": limit}]

    start = datetime(2026, 1, 1, tzinfo=UTC)
    end = datetime(2026, 2, 1, tzinfo=UTC)
    service = CashRegisterService(HistoryRepository())

    results = await service.list_closed_sessions(start, end, skip=10, limit=20)

    assert results == [{"start_at": start, "end_at": end, "skip": 10, "limit": 20}]
