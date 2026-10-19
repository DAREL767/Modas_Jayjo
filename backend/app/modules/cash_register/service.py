from datetime import UTC, datetime

from app.modules.cash_register.errors import (
    CashSessionAlreadyClosedError,
    CashSessionAlreadyOpenError,
    CashSessionNotOpenError,
)
from app.modules.cash_register.ports import CashSessionRepositoryPort


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
            "sales_cash_cop": 0,
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
        counted_cash_cop: int,
        actor_id: str,
        note: str | None = None,
    ) -> dict:
        current = await self._sessions.get_open_session()
        if current is None:
            raise CashSessionNotOpenError
        expected = current["opening_cash_cop"] + current["sales_cash_cop"]
        data = {
            "status": "closed",
            "closed_by": actor_id,
            "closed_at": datetime.now(UTC),
            "expected_cash_cop": expected,
            "counted_cash_cop": counted_cash_cop,
            "difference_cash_cop": counted_cash_cop - expected,
            "closing_note": note,
        }
        closed = await self._sessions.close_session(str(current["_id"]), data)
        if closed is None:
            raise CashSessionAlreadyClosedError
        return closed

    async def list_closed_sessions(
        self, start_at: datetime, end_at: datetime, *, skip: int = 0, limit: int = 50
    ) -> list[dict]:
        return await self._sessions.list_closed_sessions(
            start_at, end_at, skip=skip, limit=limit
        )
