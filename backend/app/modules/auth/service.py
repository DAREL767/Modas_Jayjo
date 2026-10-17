from typing import Protocol

from app.security.passwords import verify_password


class InvalidCredentialsError(Exception):
    """Raised when a login username or password is invalid."""


class InactiveUserError(Exception):
    """Raised when a disabled account attempts to log in."""


class UserLookup(Protocol):
    async def get_by_username(self, username: str) -> dict | None: ...


class AuthService:
    def __init__(self, users: UserLookup):
        self._users = users

    async def authenticate(self, username: str, password: str) -> dict:
        user = await self._users.get_by_username(username)
        if not user or not verify_password(password, user["password"]):
            raise InvalidCredentialsError
        if not user.get("is_active", True):
            raise InactiveUserError
        return user
