from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRole(str, Enum):
    ADMIN = "admin"
    VENDEDOR = "vendedor"
    CAJERO = "cajero"


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.VENDEDOR
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserResponse(UserBase):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., alias="_id")
