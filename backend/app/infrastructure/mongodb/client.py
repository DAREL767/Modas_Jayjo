from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient | None = None

db = Database()

async def connect_to_mongo():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    try:
        await client.admin.command("ping")
    except Exception:
        client.close()
        raise
    db.client = client
    print("Conexión exitosa a MongoDB Atlas (Modas Jayjo POS)")

async def close_mongo_connection():
    if db.client:
        db.client.close()
        db.client = None
        print("Conexión a MongoDB cerrada.")

def get_database():
    if db.client is None:
        raise RuntimeError("MongoDB client is not initialized")
    return db.client[settings.DATABASE_NAME]
