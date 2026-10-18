from app.infrastructure.mongodb.collections import get_users_collection


USERNAME_INDEX = "uq_users_username"
EMAIL_INDEX = "uq_users_email"


async def ensure_user_indexes() -> None:
    """Create the unique indexes required by user persistence."""
    users = get_users_collection()
    await users.create_index("username", unique=True, name=USERNAME_INDEX)
    await users.create_index("email", unique=True, name=EMAIL_INDEX)
