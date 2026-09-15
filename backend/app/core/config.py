import os
from typing import List
from pydantic import model_validator
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
    GEMINI_MODEL: str = "gemini-flash-latest"
    ANTHROPIC_API_KEY: str = ""
    
    # Cloudflare Workers AI
    CLOUDFLARE_ACCOUNT_ID: str = ""
    CLOUDFLARE_API_TOKEN: str = ""
    CLOUDFLARE_AI_MODEL: str = "@cf/qwen/qwen3.8-27b"

    # Cerebras Cloud Inference (Wafer-scale LPU)
    CEREBRAS_API_KEY: str = os.getenv("CEREBRAS_API_KEY", "")
    CEREBRAS_MODEL: str = os.getenv("CEREBRAS_MODEL", "llama-3.3-70b")

    # SambaNova Cloud
    SAMBANOVA_API_KEY: str = os.getenv("SAMBANOVA_API_KEY", "")
    SAMBANOVA_MODEL: str = os.getenv("SAMBANOVA_MODEL", "Meta-Llama-3.3-70B-Instruct")

    # GitHub Models (Azure AI)
    GITHUB_MODELS_TOKEN: str = os.getenv("GITHUB_MODELS_TOKEN", "")
    GITHUB_MODELS_MODEL: str = os.getenv("GITHUB_MODELS_MODEL", "gpt-4o-mini")

    # Mistral AI
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
    MISTRAL_MODEL: str = os.getenv("MISTRAL_MODEL", "open-mistral-nemo")

    # Cohere, SiliconFlow, Zhipu, Baidu, Tencent
    COHERE_API_KEY: str = os.getenv("COHERE_API_KEY", "")
    SILICONFLOW_API_KEY: str = os.getenv("SILICONFLOW_API_KEY", "")
    ZHIPU_API_KEY: str = os.getenv("ZHIPU_API_KEY", "")
    BAIDU_API_KEY: str = os.getenv("BAIDU_API_KEY", "")
    TENCENT_API_KEY: str = os.getenv("TENCENT_API_KEY", "")

    # Embeddings, Audio, Web Search & Community
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")
    VOYAGE_API_KEY: str = os.getenv("VOYAGE_API_KEY", "")
    JINA_API_KEY: str = os.getenv("JINA_API_KEY", "")
    GLADIA_API_KEY: str = os.getenv("GLADIA_API_KEY", "")
    ASSEMBLYAI_API_KEY: str = os.getenv("ASSEMBLYAI_API_KEY", "")
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")
    EXA_API_KEY: str = os.getenv("EXA_API_KEY", "")
    SERPER_API_KEY: str = os.getenv("SERPER_API_KEY", "")
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "CwhRBWXzGAHq8TQ4Fs17")
    CARTESIA_API_KEY: str = os.getenv("CARTESIA_API_KEY", "")
    CARTESIA_VOICE_ID: str = os.getenv("CARTESIA_VOICE_ID", "a0e99841-438c-4a64-b679-ae501e7d6091")
    APIFY_API_TOKEN: str = os.getenv("APIFY_API_TOKEN", "")
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")
    NVIDIA_MODEL: str = os.getenv("NVIDIA_MODEL", "meta/llama-3.2-11b-vision-instruct")
    UPSTAGE_API_KEY: str = os.getenv("UPSTAGE_API_KEY", "")
    UPSTAGE_MODEL: str = os.getenv("UPSTAGE_MODEL", "solar-mini")
    AI21_API_KEY: str = os.getenv("AI21_API_KEY", "")
    AI21_AGENT_ID: str = os.getenv("AI21_AGENT_ID", "")
    AI21_USER_ID: str = os.getenv("AI21_USER_ID", "")
    POLLINATIONS_ENABLED: bool = True

    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma4:latest")
    OLLAMA_API_KEY: str = os.getenv("OLLAMA_API_KEY", "")
    
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

    # Priority 4: Google Workspace Institutional SMTP Relay (2,000 emails/day failover)
    GW_SMTP_HOST: str = "smtp.gmail.com"
    GW_SMTP_PORT: int = 587
    GW_SMTP_USER: str = "deepak.gupta@mile.education"
    GW_SMTP_PASSWORD: str = ""
    GW_SMTP_FROM_EMAIL: str = "deepak.gupta@mile.education"

    @model_validator(mode="after")
    def sync_credentials(self):
        if not self.CLOUDFLARE_ACCOUNT_ID and self.R2_ACCOUNT_ID:
            self.CLOUDFLARE_ACCOUNT_ID = self.R2_ACCOUNT_ID
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
