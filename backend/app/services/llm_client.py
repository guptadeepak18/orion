import logging
from typing import Optional, Dict, Any
from app.core.config import settings

logger = logging.getLogger("crc_one.llm_client")


class LLMClient:
    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.provider = settings.LLM_PROVIDER
        if not self.api_key:
            logger.warning(
                "No ANTHROPIC_API_KEY configured. AI agent LLM features will run in fallback/no-op mode."
            )

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def generate_summary(self, prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        if not self.is_configured:
            logger.info("LLM key missing; returning fallback summary.")
            return "[AI Summary Unavailable: ANTHROPIC_API_KEY not configured]"
        
        # In actual execution with key present, call Anthropic API
        try:
            # Placeholder for Anthropic API call structure
            return f"Generated AI Summary for: {prompt[:50]}..."
        except Exception as e:
            logger.error(f"LLM API call failed: {e}")
            return "[AI Summary Error]"

    async def analyze_sentiment(self, text: str) -> float:
        if not self.is_configured:
            logger.info("LLM key missing; returning neutral fallback sentiment score (0.0).")
            return 0.0
        return 0.5


llm_client = LLMClient()
