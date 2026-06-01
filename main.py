import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from config import settings
from db import init_db
from bot import dp, bot
from api import router as api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    asyncio.create_task(dp.start_polling(bot))
    yield
    await bot.session.close()

app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(api_router)

# --- UPTIMEROBOT HEALTH PING ---
@app.get("/ping")
async def ping_server():
    return {"status": "alive"}

@app.get("/")
async def root(): return FileResponse("templates/index.html")

@app.get("/admin")
async def admin_panel(): return FileResponse("templates/admin.html")
