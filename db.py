from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

client = AsyncIOMotorClient(settings.MONGO_URI)
db = client[settings.MONGO_DB_NAME]

users_col = db.users
folders_col = db.folders
files_col = db.files

async def init_db():
    await users_col.create_index("tg_id", unique=True)
    await users_col.create_index("share_token", unique=True)
    await folders_col.create_index("owner_id")
    await files_col.create_index("owner_id")
