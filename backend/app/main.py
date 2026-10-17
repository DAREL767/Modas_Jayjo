from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.database.database import connect_to_mongo, close_mongo_connection, get_database
from app.core.config import settings
from app.routers import auth, users
from app.core.security import get_password_hash

async def create_initial_admin():
    db = get_database()
    admin_exists = await db["users"].find_one({"role": "admin"})
    if not admin_exists:
        admin_data = {
            "username": "admin",
            "email": "admin@modasjayjo.com",
            "full_name": "Administrador POS",
            "password": get_password_hash("admin123"),
            "role": "admin",
            "is_active": True
        }
        await db["users"].insert_one(admin_data)
        print("-> Usuario administrador por defecto creado (admin / admin123)")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    await create_initial_admin()
    yield
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    lifespan=lifespan
)

# Incluir Routers
app.include_router(auth.router)
app.include_router(users.router)

@app.get("/", tags=["Health Check"])
async def root():
    return {"status": "ok", "message": "API Modas Jayjo POS operativa"}