import os
from dataclasses import dataclass

@dataclass
class Config:
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    WEBAPP_URL: str = os.getenv("WEBAPP_URL", "")
    ADMIN_IDS: list = None
    
    def __post_init__(self):
        if self.ADMIN_IDS is None:
            self.ADMIN_IDS = [int(id) for id in os.getenv("ADMIN_IDS", "").split(",") if id]

config = Config()
