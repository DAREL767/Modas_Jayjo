from app.infrastructure.mongodb.database import get_database


def get_users_collection():
    """Return the users collection used by MongoDB adapters."""
    return get_database()["users"]


def get_inventory_collection():
    """Return the product-variant collection used by inventory adapters."""
    return get_database()["inventory"]


def get_inventory_movements_collection():
    """Return the append-only stock movement collection."""
    return get_database()["inventory_movements"]


def get_cash_sessions_collection():
    """Return the cash register sessions collection."""
    return get_database()["cash_sessions"]


def get_sales_collection():
    """Return the immutable sales collection."""
    return get_database()["sales"]
