from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def connect_to_mongo():
    db.client = AsyncIOMotorClient(settings.MONGODB_URI)
    print("Conexión exitosa a MongoDB Atlas (Modas Jayjo POS)")

async def close_mongo_connection():
    if db.client:
        db.client.close()
        print("Conexión a MongoDB cerrada.")

def get_database():
    return db.client[settings.DATABASE_NAME]