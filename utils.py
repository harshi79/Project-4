import hmac
import hashlib
import urllib.parse
import jwt
import bcrypt
from datetime import datetime, timedelta
from config import settings
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

def validate_init_data(init_data: str) -> dict:
    try:
        parsed_data = dict(urllib.parse.parse_qsl(init_data))
        if "hash" not in parsed_data:
            return None
            
        hash_val = parsed_data.pop("hash")
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))
        
        secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        if calculated_hash == hash_val:
            import json
            return json.loads(parsed_data.get("user", "{}"))
        return None
    except Exception:
        return None

def create_jwt(tg_id: int, unlocked: bool = False):
    expire = datetime.utcnow() + timedelta(days=7)
    payload = {"sub": str(tg_id), "unlocked": unlocked, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def decode_jwt(token: str):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        return None

def hash_passcode(passcode: str) -> str:
    return bcrypt.hashpw(passcode.encode(), bcrypt.gensalt()).decode()

def verify_passcode(passcode: str, hashed: str) -> bool:
    return bcrypt.checkpw(passcode.encode(), hashed.encode())

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    payload = decode_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"tg_id": int(payload["sub"]), "unlocked": payload.get("unlocked", False)}
