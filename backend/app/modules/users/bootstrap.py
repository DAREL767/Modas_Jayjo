from app.modules.users.errors import DuplicateUserError
from app.modules.users.ports import UserRepositoryPort
from app.modules.users.schemas import UserCreate, UserRole
from app.security.passwords import get_password_hash


class InitialAdminConfigurationError(RuntimeError):
    """Raised when the first administrator has not been configured safely."""


async def create_initial_admin(
    users: UserRepositoryPort,
    *,
    username: str | None,
    email: str | None,
    full_name: str | None,
    password: str | None,
) -> bool:
    """Create the first admin from deployment-provided credentials, once only."""
    if await users.count_active_admins() > 0:
        return False

    credentials = (username, email, full_name, password)
    if any(value is None or not value.strip() for value in credentials):
        raise InitialAdminConfigurationError(
            "No existe un administrador activo. Define INITIAL_ADMIN_USERNAME, "
            "INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_FULL_NAME e "
            "INITIAL_ADMIN_PASSWORD en el entorno para crear el primero."
        )
    if len(password) < 12:
        raise InitialAdminConfigurationError(
            "INITIAL_ADMIN_PASSWORD debe tener al menos 12 caracteres."
        )

    admin = UserCreate(
        username=username,
        email=email,
        full_name=full_name,
        password=password,
        role=UserRole.ADMIN,
    )
    data = admin.model_dump()
    data["password"] = get_password_hash(data["password"])
    try:
        await users.create(data)
    except DuplicateUserError:
        # Multiple app workers may race during first startup; only accept the
        # conflict if the competing worker actually created an admin.
        if await users.count_active_admins() == 0:
            raise
    return True
