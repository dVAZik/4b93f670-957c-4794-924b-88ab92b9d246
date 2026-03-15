import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Telegram
    BOT_TOKEN = os.getenv('BOT_TOKEN')
    
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///game.db')
    
    # Security
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-change-in-prod')
    JWT_SECRET = os.getenv('JWT_SECRET', 'jwt-secret-change-in-prod')
    ADMIN_IDS = [int(id) for id in os.getenv('ADMIN_IDS', '').split(',') if id]
    
    # Redis для rate limiting
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    
    # Game parameters
    BASE_ENERGY = 1000
    MAX_ENERGY = 5000
    ENERGY_REGEN_RATE = 1  # per second
    BASE_CLICK_REWARD = 1
    MAX_CLICK_REWARD = 5
    
    # Economy
    INITIAL_HACK_PRICE = 100  # 100 CODE = 1 HACK
    P2P_COMMISSION = 0.05  # 5%
    MIN_P2P_ORDER = 10  # Minimum HACK for P2P
    
    # Anti-cheat
    MAX_CLICKS_PER_SECOND = 20
    MAX_CLICKS_PER_MINUTE = 600
    SUSPICIOUS_CLICK_PATTERN = 15  # clicks per second threshold
    BAN_THRESHOLD = 3  # warnings before ban
    
    # Features
    ENABLE_ANTICHEAT = True
    ENABLE_RATE_LIMIT = True
    DEBUG_MODE = os.getenv('DEBUG', 'False').lower() == 'true'
