import pytest

from app.modules.users.schemas import UserCreate
from app.modules.users.service import DuplicateUserError, UserService
from app.security.passwords import verify_password


class FakeUserRepository:
    def __init__(self):
        self.users = []

    async def exists_by_username_or_email(self, username: str, email: str) -> bool:
        return any(user["username"] == username or user["email"] == email for user in self.users)

    async def create(self, user_data: dict) -> dict:
        self.users.append(user_data)
        return user_data

    async def list_all(self) -> list[dict]:
        return list(self.users)


def make_user(**overrides) -> UserCreate:
    fields = {
        "username": "vendor1",
        "email": "vendor1@example.com",
        "full_name": "Vendor One",
        "password": "password123",
    }
    fields.update(overrides)
    return UserCreate(**fields)


@pytest.mark.anyio
async def test_create_user_hashes_password_and_lists_user():
    repository = FakeUserRepository()
    service = UserService(repository)

    created = await service.create_user(make_user())
    users = await service.list_users()

    assert created["password"] != "password123"
    assert verify_password("password123", created["password"])
    assert users == [created]


@pytest.mark.anyio
async def test_create_user_rejects_duplicate_username_or_email():
    repository = FakeUserRepository()
    service = UserService(repository)
    await service.create_user(make_user())

    with pytest.raises(DuplicateUserError):
        await service.create_user(make_user(email="different@example.com"))
    with pytest.raises(DuplicateUserError):
        await service.create_user(make_user(username="vendor2"))
