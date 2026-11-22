from app.core.config import settings
from app.infrastructure.mongodb.client import client_state


def get_database():
    """Return the configured database from the active MongoDB client."""
    if client_state.client is None:
        raise RuntimeError("MongoDB client is not initialized")
    return client_state.client[settings.DATABASE_NAME]
