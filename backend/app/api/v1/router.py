from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.cash_register.router import router as cash_register_router
from app.modules.inventory.router import router as inventory_router
from app.modules.sales.router import router as sales_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(cash_register_router)
api_router.include_router(inventory_router)
api_router.include_router(sales_router)
api_router.include_router(users_router)
