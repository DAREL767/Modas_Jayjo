from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.modules.users.schemas import UserCreate, UserResponse, UserRole
from app.modules.users.service import DuplicateUserError, UserService
from app.infrastructure.mongodb.user_repository import UserRepository
from app.security.authorization import require_roles

router = APIRouter(prefix="/api/users", tags=["Gestión de Usuarios"])

@router.post(
    "/", 
    response_model=UserResponse, 
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles([UserRole.ADMIN]))]
)
async def create_user(user_in: UserCreate):
    service = UserService(UserRepository())
    try:
        created_user = await service.create_user(user_in)
    except DuplicateUserError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario o email ya está registrado"
        )
    created_user["_id"] = str(created_user["_id"])
    return created_user

@router.get(
    "/", 
    response_model=List[UserResponse],
    dependencies=[Depends(require_roles([UserRole.ADMIN]))]
)
async def list_users():
    users = await UserService(UserRepository()).list_users()
    for user in users:
        user["_id"] = str(user["_id"])
    return users
