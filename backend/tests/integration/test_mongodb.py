import os
from uuid import uuid4

import pytest

from app.core.config import settings
from app.infrastructure.mongodb import client as mongo_client
from app.infrastructure.mongodb.user_repository import UserRepository


@pytest.mark.integration
@pytest.mark.anyio
async def test_mongodb_connection_and_isolated_crud(monkeypatch):
    test_uri = os.getenv("MONGODB_TEST_URI")
    base_test_database = os.getenv("MONGODB_TEST_DATABASE")
    if not test_uri or not base_test_database:
        pytest.skip("Set MONGODB_TEST_URI and MONGODB_TEST_DATABASE to enable MongoDB integration tests")
    if base_test_database == settings.DATABASE_NAME:
        pytest.fail("MONGODB_TEST_DATABASE must be different from DATABASE_NAME")

    temporary_database = f"{base_test_database}_pytest_{uuid4().hex}"
    monkeypatch.setattr(settings, "MONGODB_URI", test_uri)
    monkeypatch.setattr(settings, "DATABASE_NAME", temporary_database)

    await mongo_client.connect_to_mongo()
    repository = UserRepository()
    collection = mongo_client.get_database()["users"]
    username = f"pytest_{uuid4().hex}"
    email = f"{username}@example.invalid"
    user = {
        "username": username,
        "email": email,
        "full_name": "Temporary MongoDB integration record",
        "password": "not-a-real-credential",
        "role": "vendor",
        "is_active": True,
    }
    try:
        created = await repository.create(user)
        assert created["username"] == username
        assert await repository.get_by_username(username) is not None
        assert await repository.exists_by_username_or_email(username, email)

        updated = await collection.update_one({"username": username}, {"$set": {"full_name": "Updated test record"}})
        assert updated.modified_count == 1
        assert (await collection.find_one({"username": username}))["full_name"] == "Updated test record"

        deleted = await collection.delete_one({"username": username})
        assert deleted.deleted_count == 1
        assert await repository.get_by_username(username) is None
    finally:
        active_client = mongo_client.db.client
        try:
            if active_client is not None:
                await active_client.drop_database(temporary_database)
        finally:
            await mongo_client.close_mongo_connection()
