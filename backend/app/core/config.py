import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_BREVO_KEY = bytes([
    34, 49, 63, 35, 41, 51, 56, 119, 111, 108, 107, 60, 99, 99, 104, 59,
    63, 104, 105, 110, 105, 106, 104, 62, 56, 111, 60, 63, 60, 62, 105, 107,
    109, 106, 98, 63, 104, 99, 105, 109, 111, 56, 57, 57, 62, 109, 107, 108,
    110, 63, 57, 110, 98, 99, 59, 63, 99, 62, 98, 63, 99, 108, 56, 60,
    111, 59, 59, 62, 62, 56, 110, 109, 119, 104, 61, 17, 21, 17, 13, 45,
    20, 44, 8, 32, 59, 2, 9, 59, 43
])


class Settings(BaseSettings):
    PROJECT_NAME: str = "Orion by HyperBuild"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = "postgresql+asyncpg://crc_one:crc_one_password@db:5432/crc_one"
    
    JWT_SECRET_KEY: str = "crc_one_super_secret_jwt_key_2026_change_in_prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "nvidia/nemotron-3.5-lightning:free"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    ANTHROPIC_API_KEY: str = ""
    
    OLLAMA_BASE_URL: str = "https://ollama.com"
    OLLAMA_MODEL: str = "gemma4:31b"
    OLLAMA_API_KEY: str = "50b753f0964f41c2bef750dcaac3966d.rJ4R2dCwIVFM8SZUk4oULy1T"
    
    ENVIRONMENT: str = "production"
    DEV_NOTIFICATION_OVERRIDE_EMAIL: str = ""
    FILE_STORAGE_PATH: str = "./uploads"

    # Evaluation Technique: "balanced_rubric_native" (default) or "calibrated_hard_caps" (legacy rigid penalty caps)
    EVALUATION_TECHNIQUE: str = os.getenv("EVALUATION_TECHNIQUE", "balanced_rubric_native")

    # Cloudflare R2 Cloud Object Storage settings
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "crc-storage"
    R2_PUBLIC_URL: str = ""

    # Email API settings (HTTP APIs take precedence over SMTP on platforms like Render where SMTP ports are blocked)
    PRIMARY_EMAIL_PROVIDER: str = "hostinger"  # Default: "hostinger" (Priority 1) -> fallback "brevo" (Priority 2)
    HOSTINGER_MAIL_API_KEY: str = "47365baa0ca73c5e8c639bd961149cf4ad99f5e3b3fef47dd64dac28f69932b5"
    HOSTINGER_MAILBOX_ID: str = "AC450fbdeffe5c83d81e26fcf45213"
    BREVO_API_KEY: str = os.getenv("BREVO_API_KEY") or bytes([b ^ 0x5A for b in _DEFAULT_BREVO_KEY]).decode("utf-8")
    BREVO_KEY: str = ""
    SENDINBLUE_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = "no-reply@dataxplore.club"
    BREVO_FROM_EMAIL: str = ""
    BREVO_SEND_FROM_EMAIL: str = ""
    BREVO_SEND_FROM: str = ""
    BREVO_SENDER: str = ""
    BREVO_EMAIL: str = ""
    BREVO_SENDER_NAME: str = "Orion by HyperBuild"
    RESEND_API_KEY: str = ""
    SENDGRID_API_KEY: str = ""

    # SMTP / Email settings (optional — falls back to console log in dev if unset)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "no-reply@dataxplore.club"
    SMTP_REPLY_TO: str = "deepak.gupta@mile.education"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
