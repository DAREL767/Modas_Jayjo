from app.infrastructure.mongodb.client import get_database


class UserRepository:
    """MongoDB persistence adapter for user records."""

    @staticmethod
    def _users():
        return get_database()["users"]

    async def get_by_username(self, username: str) -> dict | None:
        return await self._users().find_one({"username": username})

    async def exists_by_role(self, role: str) -> bool:
        return await self._users().find_one({"role": role}) is not None

    async def exists_by_username_or_email(self, username: str, email: str) -> bool:
        return await self._users().find_one({"$or": [{"username": username}, {"email": email}]}) is not None

    async def create(self, user_data: dict) -> dict:
        users = self._users()
        result = await users.insert_one(user_data)
        return await users.find_one({"_id": result.inserted_id})

    async def list_all(self) -> list[dict]:
        return [user async for user in self._users().find()]
