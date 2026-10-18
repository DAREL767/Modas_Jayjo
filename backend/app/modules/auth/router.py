from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.dependencies import (
    get_auth_service,
    get_current_user,
    get_google_auth_service,
)
from app.modules.auth.errors import (
    GoogleAccountLinkFailedError,
    GoogleAccountLinkRequiredError,
    GoogleAuthNotConfiguredError,
    GoogleProviderUnavailableError,
    InvalidGoogleTokenError,
)
from app.modules.auth.google_service import GoogleAuthService
from app.modules.auth.schemas import GoogleLoginRequest, Token
from app.modules.auth.service import (
    AuthService,
    InactiveUserError,
    InvalidCredentialsError,
)
from app.modules.users.schemas import UserResponse
from app.security.tokens import create_access_token

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


def _create_token_response(user: dict) -> Token:
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}
    )
    return Token(access_token=access_token, token_type="bearer")


@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    service: AuthService = Depends(get_auth_service),
):
    try:
        user = await service.authenticate(form_data.username, form_data.password)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InactiveUserError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo",
        )

    return _create_token_response(user)


@router.post("/google", response_model=Token)
async def login_with_google(
    body: GoogleLoginRequest,
    service: GoogleAuthService = Depends(get_google_auth_service),
):
    try:
        user = await service.authenticate(
            body.credential.get_secret_value(),
            username=body.username,
            password=(
                body.password.get_secret_value() if body.password is not None else None
            ),
        )
    except GoogleAccountLinkRequiredError:
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail="google_account_link_required",
        )
    except (GoogleAccountLinkFailedError, InvalidGoogleTokenError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar o vincular la cuenta de Google",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InactiveUserError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )
    except GoogleAuthNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La autenticación con Google no está configurada",
        )
    except GoogleProviderUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo contactar el servicio de verificación de Google",
        )

    return _create_token_response(user)


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    current_user["_id"] = str(current_user["_id"])
    return current_user
