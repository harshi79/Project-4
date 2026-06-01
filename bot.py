from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, CallbackQuery
from config import settings
from db import users_col, files_col
from models import User, VaultFile
import asyncio

bot = Bot(token=settings.BOT_TOKEN)
dp = Dispatcher()

ADMIN_ID = 7728424218

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    user_data = await users_col.find_one({"tg_id": message.from_user.id})
    if not user_data:
        new_user = User(tg_id=message.from_user.id, username=message.from_user.username)
        await users_col.insert_one(new_user.model_dump())

    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="☁️ ᴏᴘᴇɴ ᴠᴀᴜʟᴛ", web_app=WebAppInfo(url=settings.WEBAPP_URL))],
        [InlineKeyboardButton(text="📢 ᴏғғɪᴄɪᴀʟ ᴄʜᴀɴɴᴇʟ", url="https://t.me/YoriFederation")]
    ])
    
    welcome_text = (
        "<b>ʏᴏʀɪ ꜰᴇᴅᴇʀᴀᴛɪᴏɴ ᴠᴀᴜʟᴛ</b>\n\n"
        "sᴇᴄᴜʀᴇ ‧ ᴘʀɪᴠᴀᴛᴇ ‧ ɴᴀᴛɪᴠᴇ\n\n"
        "<i>ʏᴏᴜʀ ᴘᴇʀsᴏɴᴀʟ 50 ɢʙ ᴄʟᴏᴜᴅ ɪɴsɪᴅᴇ ᴛᴇʟᴇɢʀᴀᴍ. "
        "sᴇɴᴅ ᴀɴʏ ғɪʟᴇ ʜᴇʀᴇ ᴛᴏ sᴀᴠᴇ ɪᴛ, ᴏʀ ᴏᴘᴇɴ ᴛʜᴇ ᴠᴀᴜʟᴛ ᴛᴏ ᴍᴀɴᴀɢᴇ ʏᴏᴜʀ ᴅᴀᴛᴀ.</i>"
    )
    await message.answer(welcome_text, reply_markup=markup, parse_mode="HTML")

@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    help_text = "<b>🛡 ʜᴏᴡ ᴛᴏ ᴜsᴇ:</b>\n1. ᴜᴘʟᴏᴀᴅ: sᴇɴᴅ ғɪʟᴇs ʜᴇʀᴇ.\n2. ᴍᴀɴᴀɢᴇ: ᴄʟɪᴄᴋ 'ᴏᴘᴇɴ ᴠᴀᴜʟᴛ'.\n3. sᴛᴏʀᴀɢᴇ: ʏᴏᴜ ɢᴇᴛ 50ɢʙ ғʀᴇᴇ. ʙᴜʏ ᴍᴏʀᴇ ɪɴ-ᴀᴘᴘ."
    await message.answer(help_text, parse_mode="HTML")

@dp.message(Command("stats"))
async def cmd_stats(message: types.Message):
    if message.from_user.id != ADMIN_ID: return
    users = await users_col.count_documents({})
    files = await files_col.count_documents({})
    await message.answer(f"📊 <b>sᴛᴀᴛs</b>\n👥 ᴜsᴇʀs: {users}\n📁 ғɪʟᴇs: {files}", parse_mode="HTML")

@dp.message(Command("admin"))
async def cmd_admin(message: types.Message):
    if message.from_user.id != ADMIN_ID: return
    markup = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="⚙️ Open Admin Panel", web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}/admin"))]])
    await message.answer("🔐 <b>Admin Control Center</b>", reply_markup=markup, parse_mode="HTML")

@dp.message(Command("broadcast"))
async def cmd_broadcast(message: types.Message):
    if message.from_user.id != ADMIN_ID: return
    if not message.reply_to_message: return await message.answer("⚠️ Reply to a message to broadcast.")
    markup = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="✅ Send", callback_data=f"bcast_send_{message.reply_to_message.message_id}"), InlineKeyboardButton(text="❌ Cancel", callback_data="bcast_cancel")]])
    await message.answer("📢 <b>BROADCAST PREVIEW</b>", reply_markup=markup, parse_mode="HTML")

@dp.callback_query(F.data.startswith("bcast_"))
async def handle_broadcast_callback(call: CallbackQuery):
    if call.from_user.id != ADMIN_ID: return
    action = call.data.split("_")[1]
    if action == "cancel": return await call.message.edit_text("❌ Cancelled.")
    if action == "send":
        msg_id = int(call.data.split("_")[2])
        await call.message.edit_text("⏳ Broadcasting...")
        success, failed, users = 0, 0, await users_col.find({}).to_list(None)
        for u in users:
            try:
                await bot.copy_message(chat_id=u["tg_id"], from_chat_id=call.message.chat.id, message_id=msg_id)
                success += 1; await asyncio.sleep(0.05)
            except: failed += 1
        await call.message.edit_text(f"✅ <b>COMPLETE</b>\n🟢 Sent: {success}\n🔴 Failed: {failed}", parse_mode="HTML")

@dp.message(F.document | F.photo | F.video | F.audio)
async def handle_uploads(message: types.Message):
    user_data = await users_col.find_one({"tg_id": message.from_user.id})
    if not user_data: return await message.answer("Please /start the bot first.")

    size = 0
    if message.document: size = message.document.file_size
    elif message.photo: size = message.photo[-1].file_size
    elif message.video: size = message.video.file_size
    elif message.audio: size = message.audio.file_size
    
    if size and size > 40 * 1024 * 1024: return await message.answer("❌ File exceeds 40MB limit.")
    if user_data.get("storage_used", 0) + size > user_data.get("storage_limit", 50*1024**3):
        return await message.answer("❌ Storage full. Buy more GB in the Web App Store.")

    copied_msg = await message.copy_to(chat_id=settings.STORAGE_CHANNEL_ID)
    
    filename, mime_type, file_id, file_unique_id = "Untitled", "application/octet-stream", None, None
    if message.document:
        file_id, file_unique_id, filename, mime_type = message.document.file_id, message.document.file_unique_id, message.document.file_name or "doc", message.document.mime_type
    elif message.photo:
        photo = message.photo[-1]
        file_id, file_unique_id, filename, mime_type = photo.file_id, photo.file_unique_id, f"photo_{message.message_id}.jpg", "image/jpeg"
    elif message.video:
        file_id, file_unique_id, filename, mime_type = message.video.file_id, message.video.file_unique_id, message.video.file_name or f"vid_{message.message_id}.mp4", message.video.mime_type
    elif message.audio:
        file_id, file_unique_id, filename, mime_type = message.audio.file_id, message.audio.file_unique_id, message.audio.file_name or f"aud_{message.message_id}.mp3", message.audio.mime_type

    new_file = VaultFile(owner_id=message.from_user.id, folder_id=None, filename=filename, mime_type=mime_type, size=size, file_id=file_id, file_unique_id=file_unique_id, message_id=copied_msg.message_id)
    await files_col.insert_one(new_file.model_dump())
    await users_col.update_one({"tg_id": message.from_user.id}, {"$inc": {"storage_used": size}})
    
    await message.reply(f"✅ <b>sᴀᴠᴇᴅ:</b> <code>{filename}</code>", parse_mode="HTML")
