from datetime import UTC, datetime

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.infrastructure.mongodb.collections import get_cash_sessions_collection
from app.modules.cash_register.errors import CashSessionAlreadyOpenError


class CashSessionRepository:
    @staticmethod
    def _collection():
        return get_cash_sessions_collection()

    async def get_open_session(self, *, session=None) -> dict | None:
        return await self._collection().find_one(
            {"status": "open"}, session=session
        )

    async def open_session(self, data: dict) -> dict:
        try:
            result = await self._collection().insert_one(data)
        except DuplicateKeyError as exc:
            raise CashSessionAlreadyOpenError from exc
        created = await self._collection().find_one({"_id": result.inserted_id})
        if created is None:
            raise RuntimeError("MongoDB insert completed but cash session could not be read")
        return created

    async def add_sale_total(
        self,
        session_id: str,
        amount_cop: int,
        *,
        session,
    ) -> bool:
        result = await self._collection().update_one(
            {"_id": ObjectId(session_id), "status": "open"},
            {
                "$inc": {"sales_cash_cop": amount_cop}
            },
            session=session,
        )
        return result.modified_count == 1

    async def close_session(self, session_id: str, data: dict) -> dict | None:
        return await self._collection().find_one_and_update(
            {"_id": ObjectId(session_id), "status": "open"},
            {"$set": data},
            return_document=ReturnDocument.AFTER,
        )

    async def list_closed_sessions(
        self, start_at: datetime, end_at: datetime, *, skip: int, limit: int
    ) -> list[dict]:
        cursor = (
            self._collection()
            .find({"status": "closed", "closed_at": {"$gte": start_at, "$lt": end_at}})
            .sort("closed_at", -1)
            .skip(skip)
            .limit(limit)
        )
        return [item async for item in cursor]
