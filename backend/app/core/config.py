import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "CRC One"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = "postgresql+asyncpg://crc_one:crc_one_password@db:5432/crc_one"
    
    JWT_SECRET_KEY: str = "crc_one_super_secret_jwt_key_2026_change_in_prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    LLM_PROVIDER: str = "anthropic"
    ANTHROPIC_API_KEY: str = ""
    
    ENVIRONMENT: str = "local"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:8000"
    FILE_STORAGE_PATH: str = "./uploads"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
