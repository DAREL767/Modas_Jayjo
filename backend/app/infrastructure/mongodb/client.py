import logging

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


logger = logging.getLogger(__name__)

class MongoClientState:
    client: AsyncIOMotorClient | None = None



client_state = MongoClientState()


async def connect_to_mongo() -> None:
    """Create and verify the shared MongoDB client."""
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        await client.admin.command("ping")
    except Exception:
        client.close()
        raise
    client_state.client = client
    logger.info("MongoDB connection established")


async def close_mongo_connection() -> None:
    """Close and clear the shared MongoDB client."""
    if client_state.client:
        client_state.client.close()
        client_state.client = None
        logger.info("MongoDB connection closed")
