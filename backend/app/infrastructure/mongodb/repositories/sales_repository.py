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
