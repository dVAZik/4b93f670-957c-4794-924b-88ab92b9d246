from flask import Flask, request, jsonify, render_template, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import datetime, timedelta
import hashlib
import hmac
import json
from functools import wraps

from config import Config
from database import db, init_db, limiter, redis_client
from models import User, Upgrade, P2POrder, ChatMessage, AnticheatLog
from anticheat import anticheat

app = Flask(__name__)
app.config['SECRET_KEY'] = Config.SECRET_KEY
app.config['SESSION_TYPE'] = 'redis'
app.config['SESSION_REDIS'] = redis_client

init_db(app)
limiter.init_app(app)

# ==================== AUTH MIDDLEWARE ====================

def verify_telegram_auth(f):
    """Verify that request comes from Telegram"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_data = request.headers.get('X-Telegram-Auth')
        if not auth_data:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Verify initData from Telegram WebApp
        # Implementation depends on Telegram's verification method
        # This is a simplified version
        try:
            user_id = request.args.get('user') or request.json.get('user_id')
            if not user_id:
                return jsonify({'error': 'User ID required'}), 401
            return f(*args, **kwargs)
        except:
            return jsonify({'error': 'Invalid auth'}), 401
    
    return decorated_function

# ==================== API ENDPOINTS ====================

@app.route('/')
def index():
    """Serve main HTML page"""
    user_id = request.args.get('user')
    return render_template('index.html', user_id=user_id)

@app.route('/<page>')
def serve_page(page):
    """Serve other HTML pages"""
    if page in ['upgrades', 'exchange', 'p2p', 'leaderboard', 'chat', 'profile']:
        return render_template(f'{page}.html')
    return render_template('index.html')

@app.route('/api/user/<int:telegram_id>', methods=['GET'])
@verify_telegram_auth
def get_user(telegram_id):
    """Get user data"""
    user = User.query.filter_by(telegram_id=telegram_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Update energy before sending
    user.update_energy()
    db.session.commit()
    
    return jsonify(user.to_dict())

@app.route('/api/click', methods=['POST'])
@verify_telegram_auth
@limiter.limit("20 per second")
def process_click():
    """Process click from user"""
    data = request.json
    user_id = data.get('user_id')
    client_hash = data.get('hash')
    click_time = datetime.utcfromtimestamp(data.get('timestamp', datetime.utcnow().timestamp()))
    
    user = User.query.filter_by(telegram_id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Anti-cheat checks
    is_valid, warning_level, reason = anticheat.check_click(user, click_time)
    
    if not is_valid:
        if warning_level >= 2:
            return jsonify({'error': 'Cheat detected', 'reason': reason}), 403
        else:
            return jsonify({'warning': reason}), 429
    
    # Verify client hash
    if not anticheat.verify_client_hash(user, client_hash):
        anticheat.log_violation(user, 'hash_mismatch', 'Client hash verification failed')
        return jsonify({'error': 'Invalid client state'}), 403
    
    # Update energy
    user.update_energy()
    
    if user.energy <= 0:
        return jsonify({'error': 'No energy'}), 400
    
    # Calculate reward
    upgrades = user.get_upgrades()
    click_bonus = sum([u.click_bonus for u in Upgrade.query.filter(Upgrade.id.in_(upgrades)).all()])
    reward = Config.BASE_CLICK_REWARD + click_bonus
    
    # Apply limits
    reward = min(reward, Config.MAX_CLICK_REWARD)
    
    # Update user
    user.code_balance += reward
    user.energy -= 1
    user.total_clicks += 1
    user.total_earned += reward
    user.last_click_time = click_time
    user.add_click_timestamp(click_time.timestamp())
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'reward': reward,
        'new_balance': round(user.code_balance, 2),
        'energy': user.energy,
        'hash': user.get_client_hash()
    })

@app.route('/api/upgrades', methods=['GET'])
def get_upgrades():
    """Get all available upgrades"""
    user_id = request.args.get('user_id')
    
    if user_id:
        user = User.query.filter_by(telegram_id=user_id).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user_upgrades = set(user.get_upgrades())
    else:
        user_upgrades = set()
    
    upgrades = Upgrade.query.all()
    
    # If no upgrades in DB, create defaults
    if not upgrades:
        for upg in Upgrade.get_default_upgrades():
            db.session.add(Upgrade(**upg))
        db.session.commit()
        upgrades = Upgrade.query.all()
    
    result = []
    for upg in upgrades:
        upg_dict = {
            'id': upg.id,
            'name': upg.name,
            'category': upg.category,
            'price': upg.price,
            'income_per_hour': upg.income_per_hour,
            'click_bonus': upg.click_bonus,
            'description': upg.description,
            'icon': upg.icon,
            'level_required': upg.level_required,
            'owned': upg.id in user_upgrades
        }
        result.append(upg_dict)
    
    return jsonify(result)

@app.route('/api/buy_upgrade', methods=['POST'])
@verify_telegram_auth
def buy_upgrade():
    """Purchase an upgrade"""
    data = request.json
    user_id = data.get('user_id')
    upgrade_id = data.get('upgrade_id')
    
    user = User.query.filter_by(telegram_id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    upgrade = Upgrade.query.get(upgrade_id)
    if not upgrade:
        return jsonify({'error': 'Upgrade not found'}), 404
    
    # Check if already owned
    if upgrade_id in user.get_upgrades():
        return jsonify({'error': 'Already owned'}), 400
    
    # Check level requirement
    if user.level < upgrade.level_required:
        return jsonify({'error': 'Level too low'}), 400
    
    # Check balance
    if user.code_balance < upgrade.price:
        return jsonify({'error': 'Insufficient funds'}), 400
    
    # Process purchase
    user.code_balance -= upgrade.price
    user.add_upgrade(upgrade_id)
    user.passive_income += upgrade.income_per_hour
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'new_balance': round(user.code_balance, 2),
        'passive_income': user.passive_income
    })

@app.route('/api/exchange/rate', methods=['GET'])
def get_exchange_rate():
    """Get current HACK/CODE exchange rate"""
    # Simple dynamic rate based on recent trades
    # In production, use more sophisticated algorithm
    
    recent_trades = P2POrder.query.filter_by(status='completed')\
                         .order_by(P2POrder.completed_at.desc())\
                         .limit(50).all()
    
    if recent_trades:
        avg_price = sum(t.price_per_unit for t in recent_trades) / len(recent_trades)
        rate = avg_price
    else:
        rate = Config.INITIAL_HACK_PRICE
    
    # Add some randomness
    import random
    rate = rate * (1 + (random.random() - 0.5) * 0.1)  # ±5% fluctuation
    
    return jsonify({
        'rate': round(rate, 2),
        'trend': 'up' if random.random() > 0.5 else 'down'
    })

@app.route('/api/exchange/buy', methods=['POST'])
@verify_telegram_auth
def buy_hack():
    """Buy HACK with CODE"""
    data = request.json
    user_id = data.get('user_id')
    code_amount = data.get('amount')
    
    user = User.query.filter_by(telegram_id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.code_balance < code_amount:
        return jsonify({'error': 'Insufficient CODE'}), 400
    
    # Get current rate
    rate_response = get_exchange_rate()
    rate = rate_response.json['rate']
    
    hack_amount = code_amount / rate
    
    # Process exchange
    user.code_balance -= code_amount
    user.hack_balance += hack_amount
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'code_balance': round(user.code_balance, 2),
        'hack_balance': round(user.hack_balance, 2),
        'hack_received': round(hack_amount, 4)
    })

@app.route('/api/p2p/orders', methods=['GET'])
def get_p2p_orders():
    """Get active P2P orders"""
    orders = P2POrder.query.filter_by(status='active')\
                    .order_by(P2POrder.price_per_unit.asc())\
                    .limit(50).all()
    
    result = [{
        'id': o.id,
        'seller': o.seller_username,
        'amount': o.amount,
        'price_per_unit': o.price_per_unit,
        'total': o.total,
        'created_at': o.created_at.isoformat()
    } for o in orders]
    
    return jsonify(result)

@app.route('/api/p2p/create', methods=['POST'])
@verify_telegram_auth
def create_p2p_order():
    """Create new P2P order"""
    data = request.json
    user_id = data.get('user_id')
    amount = data.get('amount')
    price_per_unit = data.get('price')
    
    user = User.query.filter_by(telegram_id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check minimum amount
    if amount < Config.MIN_P2P_ORDER:
        return jsonify({'error': f'Minimum amount is {Config.MIN_P2P_ORDER} HACK'}), 400
    
    # Check balance
    if user.hack_balance < amount:
        return jsonify({'error': 'Insufficient HACK'}), 400
    
    # Calculate total
    total = amount * price_per_unit
    
    # Create order
    order = P2POrder(
        seller_id=user.telegram_id,
        seller_username=user.username,
        amount=amount,
        price_per_unit=price_per_unit,
        total=total
    )
    
    # Reserve HACK
    user.hack_balance -= amount
    
    db.session.add(order)
    db.session.commit()
    
    return jsonify({'success': True, 'order_id': order.id})

@app.route('/api/p2p/buy/<int:order_id>', methods=['POST'])
@verify_telegram_auth
def buy_p2p_order(order_id):
    """Buy from P2P order"""
    data = request.json
    user_id = data.get('user_id')
    
    user = User.query.filter_by(telegram_id=user_id).first()
    order = P2POrder.query.get(order_id)
    
    if not user or not order:
        return jsonify({'error': 'User or order not found'}), 404
    
    if order.status != 'active':
        return jsonify({'error': 'Order not active'}), 400
    
    if order.seller_id == user.telegram_id:
        return jsonify({'error': 'Cannot buy your own order'}), 400
    
    # Check balance
    if user.code_balance < order.total:
        return jsonify({'error': 'Insufficient CODE'}), 400
    
    # Calculate commission
    commission = order.total * Config.P2P_COMMISSION
    
    # Process transaction
    user.code_balance -= order.total
    user.hack_balance += order.amount
    
    # Pay seller
    seller = User.query.filter_by(telegram_id=order.seller_id).first()
    if seller:
        seller.code_balance += (order.total - commission)
    
    # Update order
    order.status = 'completed'
    order.completed_at = datetime.utcnow()
    order.buyer_id = user.telegram_id
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Bought {order.amount} HACK for {order.total - commission} CODE'
    })

@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get top players"""
    top_users = User.query.filter_by(is_banned=False)\
                 .order_by(User.hack_balance.desc())\
                 .limit(100).all()
    
    result = []
    for i, user in enumerate(top_users, 1):
        result.append({
            'rank': i,
            'username': user.username,
            'hack_balance': round(user.hack_balance, 2),
            'level': user.level,
            'mask_id': user.mask_id
        })
    
    return jsonify(result)

@app.route('/api/chat/messages', methods=['GET'])
def get_chat_messages():
    """Get recent chat messages"""
    limit = request.args.get('limit', 50, type=int)
    
    messages = ChatMessage.query.order_by(ChatMessage.created_at.desc())\
                         .limit(limit).all()
    
    # Reverse to show oldest first
    messages.reverse()
    
    result = [{
        'id': m.id,
        'username': m.username,
        'message': m.message,
        'is_system': m.is_system,
        'is_bonus': m.is_bonus,
        'bonus_code': m.bonus_code,
        'created_at': m.created_at.strftime('%H:%M:%S')
    } for m in messages]
    
    return jsonify(result)

@app.route('/api/chat/send', methods=['POST'])
@verify_telegram_auth
@limiter.limit("10 per minute")
def send_chat_message():
    """Send chat message"""
    data = request.json
    user_id = data.get('user_id')
    message = data.get('message', '').strip()
    
    user = User.query.filter_by(telegram_id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.is_banned:
        return jsonify({'error': 'You are banned'}), 403
    
    # Validate message
    if len(message) < 1 or len(message) > 200:
        return jsonify({'error': 'Message must be 1-200 characters'}), 400
    
    # Check for spam
    recent_messages = ChatMessage.query.filter_by(user_id=user_id)\
                         .order_by(ChatMessage.created_at.desc())\
                         .limit(5).all()
    
    if len(recent_messages) >= 5:
        time_diff = (datetime.utcnow() - recent_messages[-1].created_at).total_seconds()
        if time_diff < 30:
            return jsonify({'error': 'Too many messages, slow down'}), 429
    
    # Create message
    chat_msg = ChatMessage(
        user_id=user.telegram_id,
        username=user.username,
        message=message
    )
    
    db.session.add(chat_msg)
    db.session.commit()
    
    # Random chance for bonus code (1%)
    import random
    if random.random() < 0.01:
        bonus_code = f"HACK{random.randint(1000, 9999)}"
        
        bonus_msg = ChatMessage(
            user_id=0,
            username="СИСТЕМА",
            message=f"🔓 УТЕЧКА ДАННЫХ! Бонус-код: {bonus_code}",
            is_system=True,
            is_bonus=True,
            bonus_code=bonus_code
        )
        db.session.add(bonus_msg)
        db.session.commit()
    
    return jsonify({'success': True})

@app.route('/api/claim_bonus', methods=['POST'])
@verify_telegram_auth
def claim_bonus():
    """Claim bonus code"""
    data = request.json
    user_id = data.get('user_id')
    code = data.get('code', '').upper()
    
    user = User.query.filter_by(telegram_id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if code exists and not claimed
    # In production, store claimed codes in DB
    if code.startswith('HACK'):
        # Simple validation
        bonus_amount = 500
        
        user.code_balance += bonus_amount
        db.session.commit()
        
        return jsonify({
            'success': True,
            'bonus': bonus_amount,
            'new_balance': user.code_balance
        })
    
    return jsonify({'error': 'Invalid code'}), 400

@app.route('/api/admin/ban/<int:user_id>', methods=['POST'])
def ban_user(user_id):
    """Admin endpoint to ban user"""
    # Check admin auth (simplified)
    admin_key = request.headers.get('X-Admin-Key')
    if admin_key != Config.SECRET_KEY:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user = User.query.filter_by(telegram_id=user_id).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user.is_banned = True
    user.ban_reason = request.json.get('reason', 'Admin action')
    
    db.session.commit()
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=Config.DEBUG_MODE, host='0.0.0.0', port=5000)
