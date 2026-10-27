import logging

import dns.asyncresolver
from pymongo import AsyncMongoClient

from app.core.config import settings


logger = logging.getLogger(__name__)


class MongoClientState:
    client: AsyncMongoClient | None = None


client_state = MongoClientState()


async def connect_to_mongo() -> None:
    """Create and verify the shared MongoDB client."""
    if settings.mongodb_dns_nameserver_allowlist:
        resolver = dns.asyncresolver.Resolver(configure=False)
        resolver.nameservers = list(settings.mongodb_dns_nameserver_allowlist)
        dns.asyncresolver.default_resolver = resolver

    client = AsyncMongoClient(settings.MONGODB_URI)
    try:
        await client.admin.command("ping")
    except BaseException:
        try:
            await client.close()
        except Exception:
            logger.exception("Failed to close MongoDB client after connection failure")
        raise
    client_state.client = client
    logger.info("MongoDB connection established")


async def close_mongo_connection() -> None:
    """Close and clear the shared MongoDB client."""
    client = client_state.client
    if client is not None:
        try:
            await client.close()
        finally:
            client_state.client = None
        logger.info("MongoDB connection closed")
