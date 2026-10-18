import pytest

from app.core.config import Settings
from app.modules.users.bootstrap import (
    InitialAdminConfigurationError,
    create_initial_admin,
)
from app.security.passwords import verify_password


class FakeUserRepository:
    def __init__(self, active_admins: int = 0):
        self.active_admins = active_admins
        self.users = []

    async def count_active_admins(self) -> int:
        return self.active_admins

    async def create(self, user_data: dict) -> dict:
        self.users.append(user_data)
        self.active_admins += int(user_data["role"] == "admin")
        return user_data


def test_settings_reject_blank_and_example_secrets():
    with pytest.raises(ValueError):
        Settings(_env_file=None, MONGODB_URI=" ", SECRET_KEY="a-real-key")
    with pytest.raises(ValueError):
        Settings(
            _env_file=None,
            MONGODB_URI="mongodb://localhost",
            SECRET_KEY="change-me",
        )


def test_production_requires_long_secret():
    with pytest.raises(ValueError, match="32 caracteres"):
        Settings(
            _env_file=None,
            APP_ENV="production",
            MONGODB_URI="mongodb://localhost",
            SECRET_KEY="short-but-not-a-placeholder",
        )


@pytest.mark.anyio
async def test_bootstrap_requires_explicit_credentials_when_admin_is_missing():
    repository = FakeUserRepository()

    with pytest.raises(InitialAdminConfigurationError, match="INITIAL_ADMIN"):
        await create_initial_admin(
            repository,
            username=None,
            email=None,
            full_name=None,
            password=None,
        )

    assert repository.users == []


@pytest.mark.anyio
async def test_bootstrap_creates_admin_once_with_hashed_password():
    repository = FakeUserRepository()
    created = await create_initial_admin(
        repository,
        username="  owner ",
        email="OWNER@example.com",
        full_name=" Store Owner ",
        password="long-secure-test-password",
    )

    assert created is True
    admin = repository.users[0]
    assert admin["username"] == "owner"
    assert admin["email"] == "owner@example.com"
    assert admin["role"] == "admin"
    assert verify_password("long-secure-test-password", admin["password"])
    assert admin["password"] != "long-secure-test-password"

    assert await create_initial_admin(
        repository,
        username=None,
        email=None,
        full_name=None,
        password=None,
    ) is False
    assert len(repository.users) == 1
