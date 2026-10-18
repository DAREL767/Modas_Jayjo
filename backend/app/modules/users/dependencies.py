from app.infrastructure.mongodb.user_repository import UserRepository
from app.modules.users.service import UserService


def get_user_service() -> UserService:
    return UserService(UserRepository())
