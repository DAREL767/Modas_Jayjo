import pytest

from app.modules.users.errors import (
    CannotModifySelfError,
    DuplicateUserError,
    EmptyUserUpdateError,
    LastActiveAdminError,
    UserNotFoundError,
)
from app.modules.users.schemas import UserCreate, UserRole, UserUpdate
from app.modules.users.service import UserService
from app.security.passwords import verify_password


class FakeUserRepository:
    def __init__(self):
        self.users = []

    async def exists_by_username_or_email(
        self, username: str, email: str, *, exclude_user_id: str | None = None
    ) -> bool:
        return any(
            user["_id"] != exclude_user_id
            and (user["username"] == username or user["email"] == email)
            for user in self.users
        )

    async def create(self, user_data: dict) -> dict:
        if await self.exists_by_username_or_email(
            user_data["username"], user_data["email"]
        ):
            raise DuplicateUserError
        user_data["_id"] = str(len(self.users) + 1)
        self.users.append(user_data)
        return user_data

    async def get_by_id(self, user_id: str) -> dict | None:
        return next((user for user in self.users if user["_id"] == user_id), None)

    async def list_all(self, *, skip=0, limit=50, is_active=None) -> list[dict]:
        users = self.users
        if is_active is not None:
            users = [user for user in users if user["is_active"] is is_active]
        return list(users[skip : skip + limit])

    async def update_by_id(self, user_id: str, changes: dict) -> dict | None:
        user = await self.get_by_id(user_id)
        if user is None:
            return None
        if any(
            other["_id"] != user_id
            and (other["username"] == changes.get("username", user["username"])
                 or other["email"] == changes.get("email", user["email"]))
            for other in self.users
        ):
            raise DuplicateUserError
        user.update(changes)
        return user

    async def deactivate_by_id(self, user_id: str) -> bool:
        user = await self.get_by_id(user_id)
        if user is None:
            return False
        user["is_active"] = False
        return True

    async def count_active_admins(self) -> int:
        return sum(
            user["role"] == "admin" and user["is_active"] is not False
            for user in self.users
        )


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


@pytest.mark.anyio
async def test_user_lifecycle_updates_password_and_deactivates():
    service = UserService(FakeUserRepository())
    created = await service.create_user(make_user())
    user_id = created["_id"]

    updated = await service.update_user(
        user_id,
        UserUpdate(full_name="  Vendor Updated  ", password="newpass123"),
        actor_user_id="admin-id",
    )
    assert updated["full_name"] == "Vendor Updated"
    assert verify_password("newpass123", updated["password"])
    assert not verify_password("password123", updated["password"])

    await service.deactivate_user(user_id, actor_user_id="admin-id")
    assert (await service.get_user(user_id))["is_active"] is False
    assert await service.list_users(is_active=False) == [updated]


@pytest.mark.anyio
async def test_update_rejects_empty_patch_duplicates_and_missing_users():
    repository = FakeUserRepository()
    service = UserService(repository)
    first = await service.create_user(make_user())
    await service.create_user(
        make_user(username="vendor2", email="vendor2@example.com")
    )

    with pytest.raises(EmptyUserUpdateError):
        await service.update_user(
            first["_id"], UserUpdate(), actor_user_id="admin-id"
        )
    with pytest.raises(DuplicateUserError):
        await service.update_user(
            first["_id"], UserUpdate(username="vendor2"), actor_user_id="admin-id"
        )
    with pytest.raises(UserNotFoundError):
        await service.get_user("missing")


@pytest.mark.anyio
async def test_service_preserves_access_to_the_last_admin():
    service = UserService(FakeUserRepository())
    admin = await service.create_user(make_user(role=UserRole.ADMIN))

    with pytest.raises(LastActiveAdminError):
        await service.update_user(
            admin["_id"], UserUpdate(is_active=False), actor_user_id="other-admin"
        )
    with pytest.raises(LastActiveAdminError):
        await service.deactivate_user(admin["_id"], actor_user_id="other-admin")
    with pytest.raises(CannotModifySelfError):
        await service.update_user(
            admin["_id"], UserUpdate(role=UserRole.VENDEDOR), actor_user_id=admin["_id"]
        )
