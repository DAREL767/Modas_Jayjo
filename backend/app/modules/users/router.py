from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.api.dependencies import get_user_service
from app.modules.users.errors import (
    CannotModifySelfError,
    DuplicateUserError,
    EmptyUserUpdateError,
    InvalidUserIdError,
    LastActiveAdminError,
    UserNotFoundError,
)
from app.modules.users.schemas import UserCreate, UserResponse, UserRole, UserUpdate
from app.modules.users.service import UserService
from app.api.authorization import require_roles


require_admin = require_roles([UserRole.ADMIN])

router = APIRouter(
    prefix="/api/users",
    tags=["Gestión de Usuarios"],
    dependencies=[Depends(require_admin)],
)
UserServiceDependency = Annotated[UserService, Depends(get_user_service)]


def _raise_http_error(error: Exception) -> None:
    if isinstance(error, DuplicateUserError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El nombre de usuario o email ya está registrado",
        ) from error
    if isinstance(error, InvalidUserIdError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El identificador de usuario no es válido",
        ) from error
    if isinstance(error, UserNotFoundError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        ) from error
    if isinstance(error, EmptyUserUpdateError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debe enviar al menos un campo para actualizar",
        ) from error
    if isinstance(error, CannotModifySelfError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No puedes desactivar ni cambiar el rol de tu propia cuenta",
        ) from error
    if isinstance(error, LastActiveAdminError):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Debe permanecer al menos un administrador activo",
        ) from error
    raise error


@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user(user_in: UserCreate, service: UserServiceDependency):
    try:
        return await service.create_user(user_in)
    except DuplicateUserError as error:
        _raise_http_error(error)


@router.get("/", response_model=list[UserResponse])
async def list_users(
    service: UserServiceDependency,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    is_active: bool | None = None,
):
    return await service.list_users(skip=skip, limit=limit, is_active=is_active)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, service: UserServiceDependency):
    try:
        return await service.get_user(user_id)
    except (InvalidUserIdError, UserNotFoundError) as error:
        _raise_http_error(error)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_in: UserUpdate,
    service: UserServiceDependency,
    current_user: dict = Depends(require_admin),
):
    try:
        return await service.update_user(
            user_id, user_in, actor_user_id=str(current_user["_id"])
        )
    except (
        DuplicateUserError,
        EmptyUserUpdateError,
        CannotModifySelfError,
        InvalidUserIdError,
        LastActiveAdminError,
        UserNotFoundError,
    ) as error:
        _raise_http_error(error)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: str,
    service: UserServiceDependency,
    current_user: dict = Depends(require_admin),
) -> Response:
    try:
        await service.deactivate_user(user_id, actor_user_id=str(current_user["_id"]))
    except (InvalidUserIdError, UserNotFoundError) as error:
        _raise_http_error(error)
    except (CannotModifySelfError, LastActiveAdminError) as error:
        _raise_http_error(error)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
