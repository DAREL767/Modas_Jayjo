from datetime import UTC, datetime

import pytest

from app.modules.cash_register.errors import CashSessionAlreadyOpenError
from app.modules.cash_register.service import CashRegisterService
from app.modules.shared.payments import PaymentMethod


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
        "sales_by_payment_cop": {"cash": 35000, "card": 20000, "transfer": 5000},
    }
    service = CashRegisterService(repository)

    closed = await service.close_session(
        {
            PaymentMethod.CASH: 134000,
            PaymentMethod.CARD: 20000,
            PaymentMethod.TRANSFER: 6000,
        },
        "admin-1",
    )

    assert closed["expected_by_payment_cop"] == {
        "cash": 135000,
        "card": 20000,
        "transfer": 5000,
    }
    assert closed["difference_by_payment_cop"] == {
        "cash": -1000,
        "card": 0,
        "transfer": 1000,
    }
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
