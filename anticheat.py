from datetime import datetime, timedelta
from collections import deque
import numpy as np
from models import User, AnticheatLog
from config import Config
from database import db
import statistics

class AntiCheatSystem:
    
    def __init__(self):
        self.click_history = {}  # user_id -> deque of timestamps
        self.suspicious_patterns = {}
        
    def check_click(self, user, timestamp=None):
        """
        Comprehensive click validation
        Returns: (is_valid, warning_level, reason)
        """
        if not Config.ENABLE_ANTICHEAT:
            return True, 0, None
            
        if user.is_banned:
            return False, 3, "User is banned"
        
        now = timestamp or datetime.utcnow()
        user_id = user.telegram_id
        
        # Initialize history for new users
        if user_id not in self.click_history:
            self.click_history[user_id] = deque(maxlen=60)
        
        history = self.click_history[user_id]
        current_time = now.timestamp()
        
        # Add current click
        history.append(current_time)
        
        # Check 1: Rate limiting (clicks per second)
        recent_clicks = [t for t in history if current_time - t <= 1.0]
        if len(recent_clicks) > Config.MAX_CLICKS_PER_SECOND:
            self.log_violation(user, 'speed_hack', 
                             f'{len(recent_clicks)} clicks in 1 second')
            return False, 2, "Too many clicks per second"
        
        # Check 2: Clicks per minute
        minute_clicks = [t for t in history if current_time - t <= 60.0]
        if len(minute_clicks) > Config.MAX_CLICKS_PER_MINUTE:
            self.log_violation(user, 'speed_hack',
                             f'{len(minute_clicks)} clicks in 1 minute')
            return False, 2, "Click limit exceeded"
        
        # Check 3: Pattern analysis (automation detection)
        if len(history) >= 10:
            pattern_score = self.analyze_pattern(list(history)[-10:])
            if pattern_score > 0.8:  # 80% chance of automation
                self.log_violation(user, 'auto_click',
                                 f'Pattern score: {pattern_score}')
                return False, 1, "Suspicious click pattern"
        
        # Check 4: Energy consistency
        if user.energy <= 0:
            return False, 1, "No energy"
        
        # Check 5: Time since last click (prevent replay attacks)
        if user.last_click_time:
            time_diff = (now - user.last_click_time).total_seconds()
            if time_diff < 0.01:  # Less than 10ms
                self.log_violation(user, 'replay_attack',
                                 f'Time diff: {time_diff}s')
                return False, 2, "Invalid click timing"
        
        return True, 0, None
    
    def analyze_pattern(self, timestamps):
        """
        Analyze click pattern for automation
        Returns score from 0-1 (1 = definitely bot)
        """
        if len(timestamps) < 5:
            return 0
        
        # Calculate intervals between clicks
        intervals = np.diff(timestamps)
        
        if len(intervals) == 0:
            return 0
        
        # Feature 1: Standard deviation (bots have low variance)
        std_dev = statistics.stdev(intervals) if len(intervals) > 1 else 0
        std_score = max(0, min(1, 1 - (std_dev / 0.1)))  # Lower std = higher score
        
        # Feature 2: Mean interval (too fast or too slow)
        mean_interval = np.mean(intervals)
        speed_score = 0
        if mean_interval < 0.05:  # Faster than 50ms
            speed_score = 1
        elif mean_interval > 2.0:  # Slower than 2 seconds
            speed_score = 0.5
        
        # Feature 3: Pattern repetition
        pattern_score = 0
        if len(intervals) >= 5:
            # Check if intervals are very similar
            if max(intervals) - min(intervals) < 0.02:
                pattern_score = 1
        
        # Weighted average
        final_score = (std_score * 0.5) + (speed_score * 0.3) + (pattern_score * 0.2)
        
        return min(1, final_score)
    
    def log_violation(self, user, violation_type, details):
        """Log anticheat violation and take action"""
        
        # Increment warnings
        user.warnings += 1
        user.click_pattern = '[]'  # Reset pattern
        
        # Create log
        log = AnticheatLog(
            user_id=user.telegram_id,
            username=user.username,
            violation_type=violation_type,
            details=details,
            action_taken='warning'
        )
        
        # Check if ban needed
        if user.warnings >= Config.BAN_THRESHOLD:
            user.is_banned = True
            user.ban_reason = f"Multiple violations: {violation_type}"
            log.action_taken = 'banned'
            
            # Reset balances (optional)
            user.code_balance = 0
            user.hack_balance = 0
        
        db.session.add(log)
        db.session.commit()
        
        # Clear click history
        if user.telegram_id in self.click_history:
            del self.click_history[user.telegram_id]
    
    def verify_client_hash(self, user, client_hash):
        """Verify client-side hash to prevent memory editing"""
        server_hash = user.get_client_hash()
        return server_hash == client_hash

# Initialize global anticheat
anticheat = AntiCheatSystem()
