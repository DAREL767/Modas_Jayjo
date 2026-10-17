from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from app.database.database import get_database
from app.schemas.user import UserCreate, UserResponse, UserRole
from app.core.security import get_password_hash, require_roles

router = APIRouter(prefix="/api/users", tags=["Gestión de Usuarios"])

@router.post(
    "/", 
    response_model=UserResponse, 
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles([UserRole.ADMIN]))]
)
async def create_user(user_in: UserCreate):
    db = get_database()
    
    # Validar si ya existe el usuario o el email
    existing_user = await db["users"].find_one({
        "$or": [{"username": user_in.username}, {"email": user_in.email}]
    })
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de usuario o email ya está registrado"
        )

    user_dict = user_in.model_dump()
    user_dict["password"] = get_password_hash(user_dict["password"])
    
    result = await db["users"].insert_one(user_dict)
    
    created_user = await db["users"].find_one({"_id": result.inserted_id})
    created_user["_id"] = str(created_user["_id"])
    return created_user

@router.get(
    "/", 
    response_model=List[UserResponse],
    dependencies=[Depends(require_roles([UserRole.ADMIN]))]
)
async def list_users():
    db = get_database()
    users = []
    async for user in db["users"].find():
        user["_id"] = str(user["_id"])
        users.append(user)
    return users