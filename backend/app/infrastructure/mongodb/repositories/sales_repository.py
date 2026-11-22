from pymongo.errors import DuplicateKeyError

from app.infrastructure.mongodb.collections import get_sales_collection
from app.modules.sales.errors import DuplicateIdempotencyKeyError


class SaleRepository:
    @staticmethod
    def _collection():
        return get_sales_collection()

    async def create(self, sale: dict, *, session) -> dict:
        try:
            await self._collection().insert_one(sale, session=session)
        except DuplicateKeyError as exc:
            raise DuplicateIdempotencyKeyError from exc
        created = await self._collection().find_one(
            {"sale_id": sale["sale_id"]}, session=session
        )
        if created is None:
            raise RuntimeError("MongoDB insert completed but sale could not be read")
        return created

    async def get_by_idempotency_key(self, key: str) -> dict | None:
        return await self._collection().find_one({"idempotency_key": key})

    async def get_completed(self, sale_id: str, *, session=None) -> dict | None:
        return await self._collection().find_one({"sale_id": sale_id, "status": "completed"}, session=session)

    async def list_completed(self, *, start, end, cash_session_id, reference, skip, limit) -> list[dict]:
        query = {"status": "completed"}
        if cash_session_id:
            query["cash_session_id"] = cash_session_id
        else:
            query["created_at"] = {"$gte": start, "$lt": end}
            if reference:
                query["$or"] = [{"sale_id": reference.lower()}, {"items.sku": reference.upper()}]
        rows = self._collection().find(query).sort([("created_at", -1), ("sale_id", -1)]).skip(skip).limit(limit)
        return [row async for row in rows]

    async def record_return(self, sale_id: str, product_id: str, *, session) -> None:
        await self._collection().update_one(
            {"sale_id": sale_id}, {"$inc": {f"returned_units.{product_id}": 1}}, session=session,
        )
