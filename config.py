import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    BOT_TOKEN: str
    MONGO_URI: str
    MONGO_DB_NAME: str = "yori_vault"
    STORAGE_CHANNEL_ID: int
    WEBAPP_URL: str
    SECRET_KEY: str

    class Config:
        env_file = ".env"

settings = Settings()
