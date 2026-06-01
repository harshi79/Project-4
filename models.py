from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

def generate_id():
    return uuid.uuid4().hex

class User(BaseModel):
    id: str = Field(default_factory=generate_id)
    tg_id: int
    username: Optional[str] = None
    passcode_hash: Optional[str] = None
    share_token: str = Field(default_factory=generate_id)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    storage_limit: int = 50 * 1024 * 1024 * 1024  # 50 GB default
    storage_used: int = 0

class Folder(BaseModel):
    id: str = Field(default_factory=generate_id)
    owner_id: int
    parent_id: Optional[str] = None
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VaultFile(BaseModel):
    id: str = Field(default_factory=generate_id)
    owner_id: int
    folder_id: Optional[str] = None
    filename: str
    mime_type: str
    size: int
    file_id: str
    file_unique_id: str
    message_id: int
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TokenData(BaseModel):
    tg_id: int
    unlocked: bool = False
