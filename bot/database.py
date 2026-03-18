import asyncpg
from datetime import datetime, timedelta
from typing import Optional, Tuple

class Database:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self.pool = None

    async def connect(self):
        self.pool = await asyncpg.create_pool(self.dsn)

    async def close(self):
        if self.pool:
            await self.pool.close()

    async def get_user(self, user_id: int) -> Optional[dict]:
        async with self.pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT * FROM users WHERE user_id = $1",
                user_id
            )
            return dict(user) if user else None

    async def create_user(self, user_id: int, username: str = None) -> dict:
        async with self.pool.acquire() as conn:
            user = await conn.fetchrow(
                """
                INSERT INTO users (user_id, username, balance, last_bonus)
                VALUES ($1, $2, 1000, NOW())
                RETURNING *
                """,
                user_id, username
            )
            return dict(user)

    async def update_balance(self, user_id: int, amount: int) -> int:
        async with self.pool.acquire() as conn:
            result = await conn.fetchval(
                """
                UPDATE users 
                SET balance = balance + $2 
                WHERE user_id = $1 
                RETURNING balance
                """,
                user_id, amount
            )
            return result

    async def get_daily_bonus(self, user_id: int) -> Tuple[bool, int]:
        async with self.pool.acquire() as conn:
            user = await conn.fetchrow(
                "SELECT balance, last_bonus FROM users WHERE user_id = $1",
                user_id
            )
            
            if not user:
                return False, 0
            
            now = datetime.now()
            last_bonus = user['last_bonus']
            
            if not last_bonus or now - last_bonus > timedelta(hours=24):
                new_balance = await conn.fetchval(
                    """
                    UPDATE users 
                    SET balance = balance + 200, last_bonus = NOW()
                    WHERE user_id = $1
                    RETURNING balance
                    """,
                    user_id
                )
                return True, new_balance
            
            return False, user['balance']

    async def add_game_history(self, user_id: int, game: str, bet: int, win: int):
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO game_history (user_id, game, bet, win, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                """,
                user_id, game, bet, win
            )
