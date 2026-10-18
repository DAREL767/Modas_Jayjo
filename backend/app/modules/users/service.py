from typing import Any

from app.modules.users.errors import (
    CannotModifySelfError,
    DuplicateUserError,
    EmptyUserUpdateError,
    LastActiveAdminError,
    UserNotFoundError,
)
from app.modules.users.ports import UserDocument, UserRepositoryPort
from app.modules.users.schemas import UserCreate, UserUpdate
from app.security.passwords import get_password_hash


class UserService:
    """Application use cases for user management."""

    def __init__(self, users: UserRepositoryPort) -> None:
        self._users = users

    async def create_user(self, user_in: UserCreate) -> UserDocument:
        user_data = user_in.model_dump()
        user_data["password"] = get_password_hash(user_data["password"])
        return await self._users.create(user_data)

    async def get_user(self, user_id: str) -> UserDocument:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError
        return user

    async def list_users(
        self, *, skip: int = 0, limit: int = 50, is_active: bool | None = None
    ) -> list[UserDocument]:
        return await self._users.list_all(skip=skip, limit=limit, is_active=is_active)

    async def update_user(
        self, user_id: str, user_in: UserUpdate, *, actor_user_id: str
    ) -> UserDocument:
        changes: dict[str, Any] = user_in.model_dump(exclude_unset=True)
        if not changes:
            raise EmptyUserUpdateError
        if "password" in changes:
            changes["password"] = get_password_hash(changes["password"])

        if {"username", "email", "role", "is_active"}.intersection(changes):
            existing = await self._users.get_by_id(user_id)
            if existing is None:
                raise UserNotFoundError
            if {"username", "email"}.intersection(changes):
                username = changes.get("username", existing["username"])
                email = changes.get("email", existing["email"])
                if await self._users.exists_by_username_or_email(
                    username, email, exclude_user_id=user_id
                ):
                    raise DuplicateUserError

            removes_admin_access = (
                existing.get("role") == "admin"
                and existing.get("is_active", True) is not False
                and (
                    changes.get("role", "admin") != "admin"
                    or changes.get("is_active", existing.get("is_active", True))
                    is False
                )
            )
            if removes_admin_access:
                if str(existing["_id"]) == actor_user_id:
                    raise CannotModifySelfError
                if await self._users.count_active_admins() <= 1:
                    raise LastActiveAdminError

        updated = await self._users.update_by_id(user_id, changes)
        if updated is None:
            raise UserNotFoundError
        return updated

    async def deactivate_user(self, user_id: str, *, actor_user_id: str) -> None:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError
        if user.get("role") == "admin" and user.get("is_active", True) is not False:
            if str(user["_id"]) == actor_user_id:
                raise CannotModifySelfError
            if await self._users.count_active_admins() <= 1:
                raise LastActiveAdminError
        if not await self._users.deactivate_by_id(user_id):
            raise UserNotFoundError
