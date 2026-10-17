from app.infrastructure.mongodb.user_repository import UserRepository
from app.security.passwords import get_password_hash


async def create_initial_admin() -> None:
    users = UserRepository()
    if not await users.exists_by_role("admin"):
        await users.create(
            {
                "username": "admin",
                "email": "admin@modasjayjo.com",
                "full_name": "Administrador POS",
                "password": get_password_hash("admin123"),
                "role": "admin",
                "is_active": True,
            }
        )
        print("-> Usuario administrador inicial creado (admin / admin123)")
