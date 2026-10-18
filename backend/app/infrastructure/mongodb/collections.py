from app.infrastructure.mongodb.database import get_database


def get_users_collection():
    """Return the users collection used by MongoDB adapters."""
    return get_database()["users"]
