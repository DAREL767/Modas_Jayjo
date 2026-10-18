from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_user, get_user_service
from app.modules.users.router import router as users_router
from app.modules.users.service import UserService


class ApiUserRepository:
    def __init__(self):
        self.users = []

    async def create(self, user_data):
        user_data["_id"] = "user-id"
        self.users.append(user_data)
        return user_data

    async def get_by_id(self, user_id):
        return next((user for user in self.users if user["_id"] == user_id), None)

    async def list_all(self, *, skip=0, limit=50, is_active=None):
        users = self.users
        if is_active is not None:
            users = [user for user in users if user["is_active"] is is_active]
        return users[skip : skip + limit]

    async def exists_by_username_or_email(
        self, username, email, *, exclude_user_id=None
    ):
        return any(
            user["_id"] != exclude_user_id
            and (user["username"] == username or user["email"] == email)
            for user in self.users
        )

    async def update_by_id(self, user_id, changes):
        user = await self.get_by_id(user_id)
        if user is not None:
            user.update(changes)
        return user

    async def deactivate_by_id(self, user_id):
        user = await self.get_by_id(user_id)
        if user is None:
            return False
        user["is_active"] = False
        return True

    async def count_active_admins(self):
        return sum(
            user["role"] == "admin" and user["is_active"] is not False
            for user in self.users
        )


def test_admin_can_manage_users_without_exposing_password_hashes():
    app = FastAPI()
    app.include_router(users_router)
    app.dependency_overrides[get_current_user] = lambda: {
        "_id": "admin-id", "role": "admin"
    }
    service = UserService(ApiUserRepository())
    app.dependency_overrides[get_user_service] = lambda: service
    client = TestClient(app)

    created = client.post(
        "/api/users/",
        json={
            "username": "Vendor1",
            "email": "VENDOR1@example.com",
            "full_name": "Vendor One",
            "password": "password123",
        },
    )
    assert created.status_code == 201
    assert created.json()["username"] == "vendor1"
    assert created.json()["email"] == "vendor1@example.com"
    assert "password" not in created.json()

    user_id = created.json()["id"]
    assert client.get("/api/users/?limit=1").json()[0]["id"] == user_id
    assert client.get(f"/api/users/{user_id}").status_code == 200
    assert client.patch(
        f"/api/users/{user_id}", json={"full_name": "Updated Vendor"}
    ).json()["full_name"] == "Updated Vendor"
    assert client.delete(f"/api/users/{user_id}").status_code == 204
    assert client.get(f"/api/users/{user_id}").json()["is_active"] is False


def test_user_routes_reject_non_admin_users():
    app = FastAPI()
    app.include_router(users_router)
    app.dependency_overrides[get_current_user] = lambda: {
        "_id": "vendor-id", "role": "vendor"
    }
    client = TestClient(app)

    response = client.get("/api/users/")
    assert response.status_code == 403
