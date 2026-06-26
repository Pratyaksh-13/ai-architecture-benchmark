# app/core/config.py

from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    # Optional — if not provided, signup auto-verifies accounts
    gmail_address: Optional[str] = pratyakshtyagi804@gmail.com
    gmail_app_password: Optional[str] = Pratyaksh@13
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()