from app.infrastructure.mongodb.collections import get_sales_collection


async def ensure_sales_indexes() -> None:
    sales = get_sales_collection()
    await sales.create_index("sale_id", unique=True, name="uq_sales_sale_id")
    await sales.create_index(
        "idempotency_key", unique=True, name="uq_sales_idempotency_key"
    )
    await sales.create_index(
        [("cash_session_id", 1), ("created_at", 1)],
        name="ix_sales_cash_session_created",
    )
