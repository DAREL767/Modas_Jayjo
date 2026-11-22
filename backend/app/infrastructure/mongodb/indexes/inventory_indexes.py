from app.infrastructure.mongodb.collections import (
    get_inventory_collection,
    get_inventory_movements_collection,
)


async def ensure_inventory_indexes() -> None:
    inventory = get_inventory_collection()
    await inventory.create_index("sku", unique=True, name="uq_inventory_sku")
    await inventory.create_index(
        [("is_active", 1), ("category", 1), ("name", 1)],
        name="ix_inventory_active_category_name",
    )
    movements = get_inventory_movements_collection()
    await movements.create_index(
        [("product_id", 1), ("created_at", -1)],
        name="ix_inventory_movements_product_time",
    )
    await movements.create_index(
        [("sale_id", 1), ("product_id", 1)],
        unique=True,
        partialFilterExpression={"sale_id": {"$exists": True}},
        name="uq_inventory_movements_sale_product",
    )
