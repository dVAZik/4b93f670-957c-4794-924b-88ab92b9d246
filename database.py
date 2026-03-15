from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import Config
import redis

db = SQLAlchemy()

# Redis client for rate limiting and caching
redis_client = redis.from_url(Config.REDIS_URL)

# Rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=Config.REDIS_URL,
    default_limits=["200 per day", "50 per hour"]
)

def init_db(app):
    app.config['SQLALCHEMY_DATABASE_URI'] = Config.DATABASE_URL
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 10,
        'pool_recycle': 300,
        'pool_pre_ping': True,
    }
    
    db.init_app(app)
    
    with app.app_context():
        db.create_all()
        print("✅ Database initialized successfully")
