import logging
import os
from uuid import uuid4

import pytest

from app.core.config import settings
from app.infrastructure.mongodb import client as mongo_client
from app.infrastructure.mongodb.user_repository import UserRepository


logger = logging.getLogger(__name__)
MAX_DATABASE_NAME_BYTES = 38


def _temporary_database_name(production_database_name: str) -> str:
    """Return a short, unique database name within Atlas's name limit."""
    for _ in range(5):
        database_name = f"mjj_pytest_{uuid4().hex[:16]}"
        if (
            database_name != production_database_name
            and len(database_name.encode("utf-8")) <= MAX_DATABASE_NAME_BYTES
        ):
            return database_name
    raise RuntimeError("Could not generate a safe temporary MongoDB database name")


def test_temporary_database_name_is_short_and_not_production():
    production_database_name = "modas_jayjo_db"
    temporary_database = _temporary_database_name(production_database_name)

    assert temporary_database != production_database_name
    assert len(temporary_database.encode("utf-8")) <= MAX_DATABASE_NAME_BYTES


@pytest.mark.integration
@pytest.mark.anyio
async def test_mongodb_connection_and_isolated_crud(monkeypatch):
    test_uri = os.getenv("MONGODB_TEST_URI")
    base_test_database = os.getenv("MONGODB_TEST_DATABASE")
    if not test_uri or not base_test_database:
        pytest.skip("Set MONGODB_TEST_URI and MONGODB_TEST_DATABASE to enable MongoDB integration tests")
    if base_test_database == settings.DATABASE_NAME:
        pytest.fail("MONGODB_TEST_DATABASE must be different from DATABASE_NAME")

    temporary_database = _temporary_database_name(settings.DATABASE_NAME)
    assert len(temporary_database.encode("utf-8")) <= MAX_DATABASE_NAME_BYTES
    monkeypatch.setattr(settings, "MONGODB_URI", test_uri)
    monkeypatch.setattr(settings, "DATABASE_NAME", temporary_database)

    operation_error = None
    try:
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

        created = await repository.create(user)
        assert created["username"] == username
        assert await repository.get_by_username(username) is not None
        assert await repository.exists_by_username_or_email(username, email)

        updated = await collection.update_one(
            {"username": username}, {"$set": {"full_name": "Updated test record"}}
        )
        assert updated.modified_count == 1
        assert (await collection.find_one({"username": username}))["full_name"] == "Updated test record"

        deleted = await collection.delete_one({"username": username})
        assert deleted.deleted_count == 1
        assert await repository.get_by_username(username) is None
    except Exception as exc:
        operation_error = exc
        raise
    finally:
        active_client = mongo_client.db.client
        try:
            if active_client is not None:
                try:
                    await active_client.drop_database(temporary_database)
                except Exception as cleanup_error:
                    if operation_error is None:
                        raise
                    operation_error.add_note(
                        f"Temporary MongoDB cleanup also failed: {type(cleanup_error).__name__}"
                    )
                    logger.warning(
                        "Temporary MongoDB cleanup failed; preserving the original test error (%s)",
                        type(cleanup_error).__name__,
                    )
        finally:
            await mongo_client.close_mongo_connection()
