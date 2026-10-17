from typing import Protocol

from app.modules.users.schemas import UserCreate
from app.security.passwords import get_password_hash


class DuplicateUserError(Exception):
    """Raised when a username or email is already registered."""


class UserPersistence(Protocol):
    async def exists_by_username_or_email(self, username: str, email: str) -> bool: ...
    async def create(self, user_data: dict) -> dict: ...
    async def list_all(self) -> list[dict]: ...


class UserService:
    def __init__(self, users: UserPersistence):
        self._users = users

    async def create_user(self, user_in: UserCreate) -> dict:
        if await self._users.exists_by_username_or_email(user_in.username, user_in.email):
            raise DuplicateUserError
        user_data = user_in.model_dump()
        user_data["password"] = get_password_hash(user_data["password"])
        return await self._users.create(user_data)

    async def list_users(self) -> list[dict]:
        return await self._users.list_all()
