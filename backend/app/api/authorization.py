from fastapi import Depends, HTTPException, status

from app.api.dependencies import get_current_user
from app.modules.users.schemas import UserRole


def require_roles(allowed_roles: list[UserRole]):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        current_role = current_user.get("role")
        # Keep old records safe during rolling deployments until startup
        # normalization has updated every legacy role.
        if current_role in {"vendedor", "cajero"}:
            current_role = UserRole.VENDOR.value
        if current_role not in {role.value for role in allowed_roles}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos suficientes para realizar esta acción",
            )
        return current_user

    return role_checker
