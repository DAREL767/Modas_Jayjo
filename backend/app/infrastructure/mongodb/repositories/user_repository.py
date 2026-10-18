from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.infrastructure.mongodb.collections import get_users_collection
from app.modules.users.errors import DuplicateUserError, InvalidUserIdError
from app.modules.users.ports import UserDocument


class UserRepository:
    """MongoDB adapter implementing user persistence operations."""

    @staticmethod
    def _users():
        return get_users_collection()

    @staticmethod
    def _object_id(user_id: str) -> ObjectId:
        if not ObjectId.is_valid(user_id):
            raise InvalidUserIdError
        return ObjectId(user_id)

    async def get_by_username(self, username: str) -> UserDocument | None:
        return await self._users().find_one({"username": username})

    async def exists_by_role(self, role: str) -> bool:
        return await self._users().find_one({"role": role}) is not None

    async def count_active_admins(self) -> int:
        return await self._users().count_documents(
            {"role": "admin", "is_active": {"$ne": False}}
        )

    async def exists_by_username_or_email(
        self, username: str, email: str, *, exclude_user_id: str | None = None
    ) -> bool:
        query: dict[str, Any] = {
            "$or": [{"username": username}, {"email": email}]
        }
        if exclude_user_id is not None:
            query["_id"] = {"$ne": self._object_id(exclude_user_id)}
        return await self._users().find_one(query, {"_id": 1}) is not None

    async def create(self, user_data: UserDocument) -> UserDocument:
        users = self._users()
        try:
            result = await users.insert_one(user_data)
        except DuplicateKeyError as exc:
            raise DuplicateUserError from exc
        created = await users.find_one({"_id": result.inserted_id})
        if created is None:
            raise RuntimeError("MongoDB insert completed but the user could not be read")
        return created

    async def get_by_id(self, user_id: str) -> UserDocument | None:
        return await self._users().find_one({"_id": self._object_id(user_id)})

    async def list_all(
        self, *, skip: int = 0, limit: int = 50, is_active: bool | None = None
    ) -> list[UserDocument]:
        query = {} if is_active is None else {"is_active": is_active}
        cursor = self._users().find(query, {"password": 0}).sort("_id", 1)
        return [user async for user in cursor.skip(skip).limit(limit)]

    async def update_by_id(
        self, user_id: str, changes: UserDocument
    ) -> UserDocument | None:
        try:
            return await self._users().find_one_and_update(
                {"_id": self._object_id(user_id)},
                {"$set": changes},
                return_document=ReturnDocument.AFTER,
                projection={"password": 0},
            )
        except DuplicateKeyError as exc:
            raise DuplicateUserError from exc

    async def deactivate_by_id(self, user_id: str) -> bool:
        result = await self._users().update_one(
            {"_id": self._object_id(user_id), "is_active": {"$ne": False}},
            {"$set": {"is_active": False}},
        )
        if result.matched_count:
            return True
        return await self._users().find_one(
            {"_id": self._object_id(user_id)}, {"_id": 1}
        ) is not None
