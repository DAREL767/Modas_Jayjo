from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings
from app.infrastructure.google.identity_verifier import GoogleIDTokenVerifier
from app.infrastructure.mongodb.repositories.cash_session_repository import (
    CashSessionRepository,
)
from app.infrastructure.mongodb.repositories.inventory_repository import (
    InventoryRepository,
)
from app.infrastructure.mongodb.repositories.sales_repository import SaleRepository
from app.infrastructure.mongodb.repositories.user_repository import UserRepository
from app.infrastructure.mongodb.transactions import MongoTransactionRunner
from app.modules.auth.google_service import GoogleAuthService
from app.modules.auth.service import AuthService
from app.modules.cash_register.service import CashRegisterService
from app.modules.inventory.service import InventoryService
from app.modules.sales.service import SalesService
from app.modules.users.service import UserService
from app.security.tokens import InvalidTokenError, decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def get_user_service() -> UserService:
    return UserService(UserRepository())


def get_inventory_service() -> InventoryService:
    return InventoryService(InventoryRepository())


def get_cash_register_service() -> CashRegisterService:
    return CashRegisterService(CashSessionRepository())


def get_sales_service() -> SalesService:
    return SalesService(
        SaleRepository(),
        InventoryRepository(),
        CashSessionRepository(),
        MongoTransactionRunner(),
    )


def get_auth_service() -> AuthService:
    return AuthService(UserRepository())


def get_google_auth_service() -> GoogleAuthService:
    users = UserRepository()
    return GoogleAuthService(
        users=users,
        local_auth=AuthService(users),
        verifier=GoogleIDTokenVerifier(settings.google_client_id_allowlist),
    )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        username = decode_access_token(token).get("sub")
        if username is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    user = await UserRepository().get_by_username(username)
    if user is None:
        raise credentials_exception
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo"
        )
    return user
