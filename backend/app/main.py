from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.infrastructure.mongodb.client import connect_to_mongo, close_mongo_connection
from app.core.config import settings
from app.api.v1.router import api_router
from app.infrastructure.mongodb.user_repository import UserRepository
from app.modules.users.bootstrap import create_initial_admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    try:
        users = UserRepository()
        await users.normalize_legacy_roles()
        await users.ensure_indexes()
        await users.disable_public_bootstrap_admin()
        await create_initial_admin(
            users,
            username=settings.INITIAL_ADMIN_USERNAME,
            email=settings.INITIAL_ADMIN_EMAIL,
            full_name=settings.INITIAL_ADMIN_FULL_NAME,
            password=settings.INITIAL_ADMIN_PASSWORD,
        )
        yield
    finally:
        await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    lifespan=lifespan
)

app.include_router(api_router)

@app.get("/", tags=["Health Check"])
async def root():
    return {"status": "ok", "message": "API Modas Jayjo POS operativa"}
