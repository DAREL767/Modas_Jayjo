import pytest

from app.core.config import settings
from app.infrastructure.mongodb import client as mongo_client


class FakeAdmin:
    def __init__(self, error=None):
        self.error = error
        self.commands = []

    async def command(self, name):
        self.commands.append(name)
        if self.error:
            raise self.error
        return {"ok": 1}


class FakeMongoClient:
    def __init__(self, error=None):
        self.admin = FakeAdmin(error)
        self.closed = False

    def close(self):
        self.closed = True


@pytest.mark.anyio
async def test_connect_pings_and_close_resets_client(monkeypatch):
    fake_client = FakeMongoClient()
    monkeypatch.setattr(settings, "MONGODB_URI", "mongodb://test.invalid")
    monkeypatch.setattr(mongo_client.db, "client", None)
    monkeypatch.setattr(mongo_client, "AsyncIOMotorClient", lambda uri: fake_client)

    await mongo_client.connect_to_mongo()

    assert fake_client.admin.commands == ["ping"]
    assert mongo_client.db.client is fake_client
    await mongo_client.close_mongo_connection()
    assert fake_client.closed
    assert mongo_client.db.client is None


@pytest.mark.anyio
async def test_connect_closes_client_and_propagates_ping_failure(monkeypatch):
    fake_client = FakeMongoClient(ConnectionError("unavailable"))
    monkeypatch.setattr(settings, "MONGODB_URI", "mongodb://test.invalid")
    monkeypatch.setattr(mongo_client.db, "client", None)
    monkeypatch.setattr(mongo_client, "AsyncIOMotorClient", lambda uri: fake_client)

    with pytest.raises(ConnectionError, match="unavailable"):
        await mongo_client.connect_to_mongo()

    assert fake_client.closed
    assert mongo_client.db.client is None
