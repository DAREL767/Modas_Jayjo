from app.infrastructure.mongodb.collections import get_inventory_collection, get_sales_collection


class DashboardRepository:
    async def daily_sales(self, start, end) -> dict:
        cursor = await get_sales_collection().aggregate([
            {"$match": {"status": "completed", "created_at": {"$gte": start, "$lt": end}}},
            {"$group": {
                "_id": None,
                "sales_total_cop": {"$sum": "$total_cop"},
                "units_sold": {"$sum": {"$sum": "$items.quantity"}},
            }},
        ])
        rows = await cursor.to_list(length=1)
        return rows[0] if rows else {"sales_total_cop": 0, "units_sold": 0}

    async def low_stock_count(self) -> int:
        return await get_inventory_collection().count_documents({
            "is_active": {"$ne": False},
            "stock_quantity": {"$gte": 0},
            "$expr": {"$lte": ["$stock_quantity", {"$ifNull": ["$low_stock_threshold", 0]}]},
        })
