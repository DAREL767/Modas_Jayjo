from datetime import UTC, datetime

from app.modules.cash_register.errors import (
    CashSessionAlreadyClosedError,
    CashSessionAlreadyOpenError,
    CashSessionNotOpenError,
)
from app.modules.cash_register.ports import CashSessionRepositoryPort
from app.modules.shared.payments import PAYMENT_METHODS, PaymentMethod


class CashRegisterService:
    def __init__(self, sessions: CashSessionRepositoryPort) -> None:
        self._sessions = sessions

    async def get_current_session(self) -> dict | None:
        return await self._sessions.get_open_session()

    async def open_session(
        self, opening_cash_cop: int, actor_id: str, note: str | None = None
    ) -> dict:
        if await self._sessions.get_open_session() is not None:
            raise CashSessionAlreadyOpenError
        now = datetime.now(UTC)
        data = {
            "status": "open",
            "opening_cash_cop": opening_cash_cop,
            "sales_by_payment_cop": {method: 0 for method in PAYMENT_METHODS},
            "opened_by": actor_id,
            "opened_at": now,
            "opening_note": note,
        }
        try:
            return await self._sessions.open_session(data)
        except CashSessionAlreadyOpenError:
            raise

    async def close_session(
        self,
        counted_by_payment_cop: dict[PaymentMethod, int],
        actor_id: str,
        note: str | None = None,
    ) -> dict:
        current = await self._sessions.get_open_session()
        if current is None:
            raise CashSessionNotOpenError
        sales = current["sales_by_payment_cop"]
        expected = {
            method: sales[method] + (
                current["opening_cash_cop"] if method == PaymentMethod.CASH.value else 0
            )
            for method in PAYMENT_METHODS
        }
        counted = {method.value: amount for method, amount in counted_by_payment_cop.items()}
        data = {
            "status": "closed",
            "closed_by": actor_id,
            "closed_at": datetime.now(UTC),
            "expected_by_payment_cop": expected,
            "counted_by_payment_cop": counted,
            "difference_by_payment_cop": {
                method: counted[method] - expected[method] for method in PAYMENT_METHODS
            },
            "closing_note": note,
        }
        closed = await self._sessions.close_session(str(current["_id"]), data)
        if closed is None:
            raise CashSessionAlreadyClosedError
        return closed
