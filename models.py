from database import db
from datetime import datetime, timedelta
import json
import hashlib

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    telegram_id = db.Column(db.BigInteger, unique=True, nullable=False, index=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    mask_id = db.Column(db.Integer, default=1)
    
    # Balances
    code_balance = db.Column(db.Float, default=100.0)  # Start bonus
    hack_balance = db.Column(db.Float, default=0.0)
    
    # Energy
    energy = db.Column(db.Integer, default=1000)
    max_energy = db.Column(db.Integer, default=1000)
    last_energy_update = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Progress
    level = db.Column(db.Integer, default=1)
    total_clicks = db.Column(db.BigInteger, default=0)
    total_earned = db.Column(db.Float, default=0.0)
    passive_income = db.Column(db.Float, default=0.0)
    
    # Anti-cheat
    click_count_today = db.Column(db.Integer, default=0)
    last_click_time = db.Column(db.DateTime, default=datetime.utcnow)
    click_pattern = db.Column(db.Text, default='[]')  # JSON array of timestamps
    warnings = db.Column(db.Integer, default=0)
    is_banned = db.Column(db.Boolean, default=False)
    ban_reason = db.Column(db.String(200), nullable=True)
    
    # Inventory
    upgrades = db.Column(db.Text, default='[]')
    
    # Stats
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, default=datetime.utcnow)
    referrer_id = db.Column(db.BigInteger, nullable=True)
    
    def get_upgrades(self):
        return json.loads(self.upgrades) if self.upgrades else []
    
    def add_upgrade(self, upgrade_id):
        upgrades = self.get_upgrades()
        upgrades.append(upgrade_id)
        self.upgrades = json.dumps(upgrades)
    
    def get_click_pattern(self):
        return json.loads(self.click_pattern) if self.click_pattern else []
    
    def add_click_timestamp(self, timestamp):
        pattern = self.get_click_pattern()
        pattern.append(timestamp)
        # Keep only last 60 seconds
        cutoff = datetime.utcnow() - timedelta(seconds=60)
        pattern = [t for t in pattern if t > cutoff.timestamp()]
        self.click_pattern = json.dumps(pattern)
    
    def update_energy(self):
        """Regenerate energy based on time passed"""
        if self.energy >= self.max_energy:
            self.energy = self.max_energy
            return
        
        now = datetime.utcnow()
        seconds_passed = (now - self.last_energy_update).total_seconds()
        
        if seconds_passed > 0:
            regen = int(seconds_passed * Config.ENERGY_REGEN_RATE)
            self.energy = min(self.max_energy, self.energy + regen)
        
        self.last_energy_update = now
    
    def get_client_hash(self):
        """Generate client verification hash"""
        data = f"{self.telegram_id}:{self.code_balance}:{self.energy}:{self.total_clicks}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    def to_dict(self):
        return {
            'id': self.telegram_id,
            'username': self.username,
            'mask_id': self.mask_id,
            'code_balance': round(self.code_balance, 2),
            'hack_balance': round(self.hack_balance, 2),
            'energy': self.energy,
            'max_energy': self.max_energy,
            'level': self.level,
            'total_clicks': self.total_clicks,
            'passive_income': round(self.passive_income, 2),
            'warnings': self.warnings,
            'hash': self.get_client_hash()
        }

class Upgrade(db.Model):
    __tablename__ = 'upgrades'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    category = db.Column(db.String(50))  # software, hardware, script
    price = db.Column(db.Float)
    income_per_hour = db.Column(db.Float)
    click_bonus = db.Column(db.Float, default=0.0)  # Extra CODE per click
    description = db.Column(db.String(200))
    icon = db.Column(db.String(50))
    level_required = db.Column(db.Integer, default=1)
    
    @staticmethod
    def get_default_upgrades():
        return [
            {'id': 1, 'name': 'Сниффер трафика', 'category': 'software', 
             'price': 500, 'income_per_hour': 50, 'click_bonus': 0.1,
             'description': 'Перехватывает пакеты данных', 'icon': 'sniffer.png'},
            
            {'id': 2, 'name': 'Сканер портов', 'category': 'software',
             'price': 2000, 'income_per_hour': 200, 'click_bonus': 0.3,
             'description': 'Находит уязвимые сервисы', 'icon': 'scanner.png'},
            
            {'id': 3, 'name': 'Видеокарта RTX 4090', 'category': 'hardware',
             'price': 10000, 'income_per_hour': 1000, 'click_bonus': 0.5,
             'description': 'Для майнинга и взлома', 'icon': 'gpu.png'},
            
            {'id': 4, 'name': 'Брутфорс-скрипт', 'category': 'script',
             'price': 5000, 'income_per_hour': 0, 'click_bonus': 1.0,
             'description': '+1 $CODE за клик', 'icon': 'bruteforce.png'},
        ]

class P2POrder(db.Model):
    __tablename__ = 'p2p_orders'
    
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.BigInteger, index=True)
    seller_username = db.Column(db.String(50))
    amount = db.Column(db.Float)
    price_per_unit = db.Column(db.Float)
    total = db.Column(db.Float)
    status = db.Column(db.String(20), default='active')  # active, completed, cancelled
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    buyer_id = db.Column(db.BigInteger, nullable=True)

class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, index=True)
    username = db.Column(db.String(50))
    message = db.Column(db.String(500))
    is_system = db.Column(db.Boolean, default=False)
    is_bonus = db.Column(db.Boolean, default=False)
    bonus_code = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AnticheatLog(db.Model):
    __tablename__ = 'anticheat_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.BigInteger, index=True)
    username = db.Column(db.String(50))
    violation_type = db.Column(db.String(50))  # speed_hack, auto_click, pattern
    details = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    action_taken = db.Column(db.String(50))  # warning, temp_ban, perm_ban
