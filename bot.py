import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from telegram.constants import ParseMode
from config import Config
from database import db, redis_client
from models import User
import json

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# WebApp URL (set in Render.com env)
WEBAPP_URL = "https://hacker-simulator-bot.onrender.com"

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user = update.effective_user
    
    # Check if user exists in DB
    db_user = User.query.filter_by(telegram_id=user.id).first()
    
    if not db_user:
        # Create new user
        username = user.username or f"user_{user.id}"
        
        # Ensure unique username
        base_username = username
        counter = 1
        while User.query.filter_by(username=username).first():
            username = f"{base_username}_{counter}"
            counter += 1
        
        db_user = User(
            telegram_id=user.id,
            username=username
        )
        db.session.add(db_user)
        db.session.commit()
        logger.info(f"New user created: {username}")
    
    # Create WebApp button
    keyboard = [[
        InlineKeyboardButton(
            "🚀 ЗАПУСТИТЬ ХАКЕР-ТЕРМИНАЛ", 
            web_app=WebAppInfo(url=f"{WEBAPP_URL}?user={user.id}")
        )
    ]]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    welcome_text = f"""
🔐 *ДОБРО ПОЖАЛОВАТЬ В HACKER SIMULATOR* 🔐

Привет, *{db_user.username}*!

Твой персональный хакерский терминал готов к работе.
Взламывай системы, майни крипту и становись легендой!

📊 *Твой статус:*
💰 $CODE: {db_user.code_balance}
💎 $HACK: {db_user.hack_balance}
⚡ Энергия: {db_user.energy}/{db_user.max_energy}
📈 Уровень: {db_user.level}

👇 Нажми кнопку ниже для входа
    """
    
    await update.message.reply_text(
        welcome_text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=reply_markup
    )

async def profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show user profile"""
    user = update.effective_user
    db_user = User.query.filter_by(telegram_id=user.id).first()
    
    if not db_user:
        await update.message.reply_text("Сначала используй /start")
        return
    
    profile_text = f"""
👤 *ПРОФИЛЬ ХАКЕРА*
━━━━━━━━━━━━━━━━━━━
🆔 Ник: {db_user.username}
🎭 Маска: #{db_user.mask_id}
📊 Уровень: {db_user.level}

💰 *БАЛАНСЫ*
$CODE: {db_user.code_balance:,.2f}
$HACK: {db_user.hack_balance:,.2f}

⚡ *ЭНЕРГИЯ*
{db_user.energy}/{db_user.max_energy}
Восстановление: 1/сек

📈 *СТАТИСТИКА*
Кликов: {db_user.total_clicks:,}
Заработано: {db_user.total_earned:,.2f} $CODE
Пассивный доход: {db_user.passive_income}/час

🏆 Рейтинг: #{db_user.id}

🔒 Античит: {db_user.warnings} предупреждений
    """
    
    # Add ban status if applicable
    if db_user.is_banned:
        profile_text += f"\n\n❌ *ЗАБЛОКИРОВАН*\nПричина: {db_user.ban_reason}"
    
    await update.message.reply_text(
        profile_text,
        parse_mode=ParseMode.MARKDOWN
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show help"""
    help_text = """
📚 *РУКОВОДСТВО ХАКЕРА*

*Основные команды:*
/start - Запустить терминал
/profile - Твой профиль
/top - Топ хакеров
/help - Это меню

*Как играть:*
1️⃣ Кликай на главный терминал для добычи $CODE
2️⃣ Покупай улучшения для пассивного дохода
3️⃣ Обменивай $CODE на $HACK на бирже
4️⃣ Торгуй на P2P рынке с другими игроками
5️⃣ Общайся в чате и лови бонус-коды

*Античит:*
Система автоматически detects читеров.
За нарушения следует блокировка!

*Больше информации в Mini App!*
    """
    
    await update.message.reply_text(
        help_text,
        parse_mode=ParseMode.MARKDOWN
    )

async def top(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show leaderboard"""
    top_users = User.query.filter_by(is_banned=False)\
                 .order_by(User.hack_balance.desc())\
                 .limit(10).all()
    
    if not top_users:
        await update.message.reply_text("Пока нет игроков в топе")
        return
    
    text = "🏆 *ТОП ХАКЕРОВ* 🏆\n━━━━━━━━━━━━━━━━━━━\n\n"
    
    medals = ["🥇", "🥈", "🥉"]
    
    for i, user in enumerate(top_users, 1):
        medal = medals[i-1] if i <= 3 else f"{i}."
        text += f"{medal} *{user.username}*\n"
        text += f"   💎 {user.hack_balance:,.2f} $HACK\n"
        text += f"   📊 Уровень {user.level}\n\n"
    
    await update.message.reply_text(
        text,
        parse_mode=ParseMode.MARKDOWN
    )

async def webapp_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle data from WebApp"""
    data = json.loads(update.effective_message.web_app_data.data)
    user = update.effective_user
    
    logger.info(f"WebApp data from {user.id}: {data}")
    
    # Process different actions
    action = data.get('action')
    
    if action == 'share_username':
        # Update username if changed
        db_user = User.query.filter_by(telegram_id=user.id).first()
        if db_user:
            new_username = data.get('username')
            if new_username and new_username != db_user.username:
                # Check uniqueness
                if not User.query.filter_by(username=new_username).first():
                    db_user.username = new_username
                    db.session.commit()
                    await update.message.reply_text(f"✅ Ник изменен на {new_username}")
                else:
                    await update.message.reply_text("❌ Этот ник уже занят")
    
    elif action == 'claim_bonus':
        code = data.get('code')
        # Process bonus code
        # ... logic here

def main():
    """Start the bot"""
    # Create application
    application = Application.builder().token(Config.BOT_TOKEN).build()
    
    # Add handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("profile", profile))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("top", top))
    application.add_handler(CallbackQueryHandler(webapp_data, pattern="^webapp_data"))
    
    # Start bot
    print("🤖 Bot is starting...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
