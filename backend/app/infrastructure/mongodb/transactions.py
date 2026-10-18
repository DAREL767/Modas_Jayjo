from collections.abc import Awaitable, Callable
from typing import TypeVar

from app.infrastructure.mongodb.client import client_state


T = TypeVar("T")


class MongoTransactionRunner:
    """Run a unit of work in a MongoDB transaction."""

    async def run(self, operation: Callable[[object], Awaitable[T]]) -> T:
        client = client_state.client
        if client is None:
            raise RuntimeError("MongoDB client is not initialized")
        async with client.start_session() as session:
            return await session.with_transaction(operation)
