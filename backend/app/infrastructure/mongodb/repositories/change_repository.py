from datetime import UTC, datetime
import re

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.infrastructure.mongodb.database import get_database


class ChangeRepository:
    @staticmethod
    def _collection():
        return get_database()["product_changes"]

    async def create(self, data: dict) -> dict:
        try:
            await self._collection().insert_one({"_id": data["id"], **data})
        except DuplicateKeyError:
            existing = await self.get(data["id"])
            if existing is None:
                raise
            return existing
        return data

    async def get(self, request_id: str) -> dict | None:
        return await self._collection().find_one({"_id": request_id})

    async def list(self, *, state, start, end, search, skip, limit) -> list[dict]:
        query = {}
        if state:
            query["status"] = state
        if start is not None and end is not None:
            query["created_at"] = {"$gte": start, "$lt": end}
        if search:
            match = {"$regex": re.escape(search), "$options": "i"}
            fields = ("id", "sale_id", "reason", "product.sku", "product.name", "replacement.sku", "replacement.name")
            query["$or"] = [{field: match} for field in fields]
        cursor = self._collection().find(query).sort([("created_at", -1), ("_id", -1)]).skip(skip).limit(limit)
        return [row async for row in cursor]

    async def resolve(self, request_id, state, actor_id, *, session=None) -> dict | None:
        return await self._collection().find_one_and_update(
            {"_id": request_id, "status": "pending"},
            {"$set": {"status": state, "resolved_at": datetime.now(UTC), "resolved_by": actor_id}},
            return_document=ReturnDocument.AFTER,
            session=session,
        )

    async def attach_cash(self, request_id, cash_id, *, session) -> dict:
        return await self._collection().find_one_and_update(
            {"_id": request_id}, {"$set": {"cash_session_id": cash_id}},
            return_document=ReturnDocument.AFTER, session=session,
        )
