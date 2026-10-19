from app.infrastructure.mongodb.collections import get_cash_sessions_collection


async def ensure_cash_register_indexes() -> None:
    sessions = get_cash_sessions_collection()
    await sessions.create_index(
        "status",
        unique=True,
        partialFilterExpression={"status": "open"},
        name="uq_cash_sessions_one_open",
    )
    await sessions.create_index(
        [("status", 1), ("closed_at", -1)],
        name="ix_cash_sessions_closed_at",
    )
