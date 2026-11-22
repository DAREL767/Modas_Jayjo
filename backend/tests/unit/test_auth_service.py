import pytest

from app.modules.auth.service import (
    AuthService,
    InactiveUserError,
    InvalidCredentialsError,
)
from app.security.passwords import get_password_hash


class FakeUserRepository:
    def __init__(self, user):
        self.user = user

    async def get_by_username(self, username: str):
        if self.user and self.user["username"] == username:
            return self.user
        return None


@pytest.fixture
def user():
    return {
        "username": "sandra",
        "password": get_password_hash("correct-password"),
        "is_active": True,
    }


@pytest.mark.anyio
async def test_authenticate_returns_user_for_valid_credentials(user):
    service = AuthService(FakeUserRepository(user))

    authenticated = await service.authenticate("sandra", "correct-password")

    assert authenticated is user


@pytest.mark.anyio
async def test_authenticate_rejects_unknown_user_or_wrong_password(user):
    service = AuthService(FakeUserRepository(user))

    with pytest.raises(InvalidCredentialsError):
        await service.authenticate("unknown", "correct-password")
    with pytest.raises(InvalidCredentialsError):
        await service.authenticate("sandra", "wrong-password")


@pytest.mark.anyio
async def test_authenticate_rejects_inactive_user(user):
    user["is_active"] = False
    service = AuthService(FakeUserRepository(user))

    with pytest.raises(InactiveUserError):
        await service.authenticate("sandra", "correct-password")
