import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
import uvicorn
from bot.config import config
from bot.database import Database
import os

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация
bot = Bot(token=config.BOT_TOKEN)
dp = Dispatcher()
db = Database(config.DATABASE_URL)

# Создание таблиц
async def init_db():
    async with db.pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                username TEXT,
                balance INTEGER DEFAULT 1000,
                last_bonus TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS game_history (
                id SERIAL PRIMARY KEY,
                user_id BIGINT REFERENCES users(user_id),
                game TEXT,
                bet INTEGER,
                win INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

# Обработчики бота
@dp.message(Command("start"))
async def cmd_start(message: Message):
    user = await db.get_user(message.from_user.id)
    if not user:
        user = await db.create_user(
            message.from_user.id, 
            message.from_user.username
        )
    
    # Создаем кнопку для открытия WebApp
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(
                text="🎰 Открыть Казино", 
                web_app=WebAppInfo(url=f"{config.WEBAPP_URL}")
            )]
        ]
    )
    
    await message.answer(
        f"🌟 Добро пожаловать в Casino!\n"
        f"💰 Твой баланс: {user['balance']} монет\n\n"
        f"🎮 Нажми кнопку ниже, чтобы начать играть!",
        reply_markup=keyboard
    )

# API для игр
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Старт
    await db.connect()
    await init_db()
    logger.info("Database connected")
    yield
    # Стоп
    await db.close()
    logger.info("Database closed")

app = FastAPI(lifespan=lifespan)

# Монтируем статические файлы
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/games", StaticFiles(directory="webapp/games"), name="games")

# Отдаем главную страницу
@app.get("/", response_class=HTMLResponse)
async def get_index():
    with open("webapp/index.html", "r", encoding="utf-8") as f:
        return f.read()

# Отдаем CSS
@app.get("/style.css")
async def get_css():
    return FileResponse("webapp/style.css")

# Отдаем JS
@app.get("/app.js")
async def get_js():
    return FileResponse("webapp/app.js")

# API для получения пользователя
@app.get("/api/user/{user_id}")
async def get_user(user_id: int):
    user = await db.get_user(user_id)
    if not user:
        user = await db.create_user(user_id)
    return user

# API для обновления баланса
@app.post("/api/update_balance")
async def update_balance(request: Request):
    data = await request.json()
    user_id = data.get("user_id")
    amount = data.get("amount", 0)
    game = data.get("game", "unknown")
    bet = data.get("bet", 0)
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    new_balance = await db.update_balance(user_id, amount)
    await db.add_game_history(user_id, game, bet, amount)
    
    return {"balance": new_balance}

# API для ежедневного бонуса
@app.post("/api/daily_bonus")
async def daily_bonus(request: Request):
    data = await request.json()
    user_id = data.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    
    success, balance = await db.get_daily_bonus(user_id)
    
    return {
        "success": success,
        "balance": balance
    }

# Вебхук для Telegram (опционально)
@app.post("/webhook")
async def webhook(request: Request):
    update = types.Update(**await request.json())
    await dp.feed_update(bot, update)
    return {"ok": True}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
