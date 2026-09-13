import asyncio
import json
import logging
import os
import re
import time
from typing import Dict, Any, List, Optional, Tuple

import httpx
from app.core.config import settings

logger = logging.getLogger("crc_one.ai_provider_hub")

# Circuit breaker backoff timestamps: provider_name -> unix timestamp until which provider is paused
_circuit_backoffs: Dict[str, float] = {}


def set_backoff(provider: str, seconds: float = 60.0):
    _circuit_backoffs[provider] = time.time() + seconds
    logger.warning(f"[AI Hub] Circuit breaker activated for '{provider}': backed off for {seconds}s.")


def is_available(provider: str) -> bool:
    backoff_until = _circuit_backoffs.get(provider, 0.0)
    return time.time() > backoff_until


def clean_and_parse_json(text: str) -> Dict[str, Any]:
    """Extracts and parses pure JSON from LLM text, stripping markdown code fences."""
    if not text:
        return {}
    cleaned = text.strip()
    if "```" in cleaned:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if m:
            cleaned = m.group(1).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except Exception:
            pass
    return {"raw_response": text}


class AIProviderHub:
    """
    Universal multi-provider AI inference hub for Orion.
    Dynamically discovers all configured zero-cost and free-tier providers,
    enforces sliding-window circuit breakers on HTTP 429s, and routes requests
    according to model specialization.
    """

    @staticmethod
    def get_configured_providers() -> List[str]:
        configured = []
        if settings.CLOUDFLARE_API_TOKEN and settings.CLOUDFLARE_ACCOUNT_ID:
            configured.append("cloudflare")
        if settings.CEREBRAS_API_KEY:
            configured.append("cerebras")
        if settings.SAMBANOVA_API_KEY:
            configured.append("sambanova")
        if settings.GROQ_API_KEY:
            configured.append("groq")
        if settings.GITHUB_MODELS_TOKEN:
            configured.append("github_models")
        if settings.GEMINI_API_KEY:
            configured.append("gemini")
        if settings.OPENROUTER_API_KEY:
            configured.append("openrouter")
        if settings.MISTRAL_API_KEY:
            configured.append("mistral")
        if settings.ZHIPU_API_KEY:
            configured.append("zhipu")
        if settings.SILICONFLOW_API_KEY:
            configured.append("siliconflow")
        if settings.HUGGINGFACE_API_KEY:
            configured.append("huggingface")
        if getattr(settings, "POLLINATIONS_ENABLED", True):
            configured.append("pollinations")
        return configured

    @staticmethod
    async def call_openai_compatible(
        provider_name: str,
        base_url: str,
        api_key: str,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 2500,
        response_format: Optional[Dict[str, Any]] = None,
        timeout: float = 35.0,
    ) -> Dict[str, Any]:
        """Generic async dispatcher for all OpenAI-compatible API providers."""
        if not is_available(provider_name):
            raise RuntimeError(f"Provider '{provider_name}' is currently in cooldown.")

        headers = {
            "Content-Type": "application/json",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        endpoint = f"{base_url.rstrip('/')}/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(endpoint, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_content = data["choices"][0]["message"]["content"].strip()
                    parsed = clean_and_parse_json(raw_content)
                    parsed["model_used"] = f"{provider_name.upper()} ({model})"
                    return parsed
                elif res.status_code == 429:
                    set_backoff(provider_name, seconds=60.0)
                    raise RuntimeError(f"{provider_name} returned 429 Rate Limit.")
                elif res.status_code == 402:
                    set_backoff(provider_name, seconds=86400.0)
                    raise RuntimeError(f"{provider_name} requires payment/billing. Paused for 24h.")
                elif res.status_code == 413:
                    raise RuntimeError(f"{provider_name} returned 413 Request Too Large.")
                else:
                    raise RuntimeError(f"{provider_name} returned status {res.status_code}: {res.text[:120]}")
        except httpx.TimeoutException:
            set_backoff(provider_name, seconds=30.0)
            raise RuntimeError(f"{provider_name} request timed out after {timeout}s.")
        except Exception as e:
            if "429" in str(e):
                set_backoff(provider_name, seconds=60.0)
            raise

    # -------------------------------------------------------------
    # Specialized Provider Dispatchers
    # -------------------------------------------------------------

    @classmethod
    async def call_cloudflare(
        cls,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2500,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Calls Cloudflare Workers AI via official OpenAI-compatible endpoint."""
        token = settings.CLOUDFLARE_API_TOKEN
        account_id = settings.CLOUDFLARE_ACCOUNT_ID
        if not token or not account_id:
            raise ValueError("Cloudflare API Token or Account ID not configured.")

        target_model = model or settings.CLOUDFLARE_AI_MODEL or "@cf/qwen/qwen3.8-27b"
        base_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1"
        return await cls.call_openai_compatible(
            provider_name="cloudflare",
            base_url=base_url,
            api_key=token,
            model=target_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            timeout=45.0,
        )

    @classmethod
    async def call_cerebras(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2500,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Calls Cerebras Cloud (2,000 tokens/sec wafer-scale LPU)."""
        key = settings.CEREBRAS_API_KEY
        if not key:
            raise ValueError("Cerebras API Key not configured.")
        target_model = model or settings.CEREBRAS_MODEL or "llama-3.3-70b"
        return await cls.call_openai_compatible(
            provider_name="cerebras",
            base_url="https://api.cerebras.ai/v1",
            api_key=key,
            model=target_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            timeout=25.0,
        )

    @classmethod
    async def call_sambanova(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2500,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Calls SambaNova Cloud (Reconfigurable Dataflow Unit)."""
        key = settings.SAMBANOVA_API_KEY
        if not key:
            raise ValueError("SambaNova API Key not configured.")
        target_model = model or settings.SAMBANOVA_MODEL or "Meta-Llama-3.3-70B-Instruct"
        return await cls.call_openai_compatible(
            provider_name="sambanova",
            base_url="https://api.sambanova.ai/v1",
            api_key=key,
            model=target_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            timeout=30.0,
        )

    @classmethod
    async def call_github_models(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2500,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Calls GitHub Models (Azure AI) using a standard GitHub Personal Access Token."""
        token = settings.GITHUB_MODELS_TOKEN
        if not token:
            raise ValueError("GitHub Models Token not configured.")
        target_model = model or settings.GITHUB_MODELS_MODEL or "gpt-4o-mini"
        return await cls.call_openai_compatible(
            provider_name="github_models",
            base_url="https://models.inference.ai.azure.com",
            api_key=token,
            model=target_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            timeout=35.0,
        )

    @classmethod
    async def call_groq(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2500,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Calls Groq LPU (Sub-second inference)."""
        key = settings.GROQ_API_KEY
        if not key:
            raise ValueError("Groq API Key not configured.")
        target_model = model or settings.GROQ_MODEL or "llama-3.3-70b-versatile"
        return await cls.call_openai_compatible(
            provider_name="groq",
            base_url="https://api.groq.com/openai/v1",
            api_key=key,
            model=target_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            timeout=30.0,
        )

    @classmethod
    async def call_pollinations(
        cls,
        messages: List[Dict[str, str]],
        model: str = "openai",
        temperature: float = 0.2,
        max_tokens: int = 2000,
    ) -> Dict[str, Any]:
        """Calls Pollinations.ai (100% free, zero authentication required)."""
        return await cls.call_openai_compatible(
            provider_name="pollinations",
            base_url="https://text.pollinations.ai/openai",
            api_key="none",
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=30.0,
        )

    @classmethod
    async def call_huggingface(
        cls,
        messages: List[Dict[str, str]],
        model: str = "Qwen/Qwen3.8-27B",
        temperature: float = 0.2,
        max_tokens: int = 2500,
    ) -> Dict[str, Any]:
        """Calls Hugging Face Serverless Inference Router (100% free with hf_ token)."""
        key = settings.HUGGINGFACE_API_KEY
        if not key:
            raise ValueError("Hugging Face API Key not configured.")
        return await cls.call_openai_compatible(
            provider_name="huggingface",
            base_url="https://router.huggingface.co/v1",
            api_key=key,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=35.0,
        )

    @classmethod
    async def call_mistral(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2500,
    ) -> Dict[str, Any]:
        """Calls Mistral AI (La Plateforme)."""
        key = settings.MISTRAL_API_KEY
        if not key:
            raise ValueError("Mistral API Key not configured.")
        target_model = model or settings.MISTRAL_MODEL or "mistral-small-latest"
        return await cls.call_openai_compatible(
            provider_name="mistral",
            base_url="https://api.mistral.ai/v1",
            api_key=key,
            model=target_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=30.0,
        )

    @classmethod
    async def call_siliconflow(
        cls,
        messages: List[Dict[str, str]],
        model: str = "deepseek-ai/DeepSeek-V4.1-Flash",
        temperature: float = 0.2,
        max_tokens: int = 2500,
    ) -> Dict[str, Any]:
        """Calls SiliconFlow (100% free models, zero credit card)."""
        key = settings.SILICONFLOW_API_KEY
        if not key:
            raise ValueError("SiliconFlow API Key not configured.")
        return await cls.call_openai_compatible(
            provider_name="siliconflow",
            base_url="https://api.siliconflow.com/v1",
            api_key=key,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=30.0,
        )

    # -------------------------------------------------------------
    # Vision & Multimodal OCR
    # -------------------------------------------------------------

    @classmethod
    async def call_vision_ocr(
        cls,
        image_base64: str,
        mime_type: str = "image/jpeg",
        prompt: str = "Transcribe all visible handwriting, formulas, tables, and text from this document accurately.",
    ) -> str:
        """
        Multimodal Vision OCR for scanned PDFs, photos, and diagrams.
        Tries Cloudflare Qwen 3.8-27B Vision first, then Google Gemini Vision.
        """
        # 1. Attempt Cloudflare Workers AI Vision
        if settings.CLOUDFLARE_API_TOKEN and settings.CLOUDFLARE_ACCOUNT_ID and is_available("cloudflare_vision"):
            try:
                base_url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/ai/v1"
                headers = {"Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}"}
                payload = {
                    "model": "@cf/qwen/qwen3.8-27b",
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:{mime_type};base64,{image_base64}"},
                                },
                            ],
                        }
                    ],
                    "max_tokens": 2000,
                }
                async with httpx.AsyncClient(timeout=45.0) as client:
                    res = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
                    if res.status_code == 200:
                        return res.json()["choices"][0]["message"]["content"].strip()
                    elif res.status_code == 429:
                        set_backoff("cloudflare_vision", 60.0)
            except Exception as e:
                logger.warning(f"Cloudflare Vision OCR failed: {e}")

        # 2. Attempt Google Gemini Flash Vision
        gemini_key = settings.GEMINI_API_KEY
        if gemini_key and is_available("gemini_vision"):
            try:
                target_model = settings.GEMINI_MODEL or "gemini-flash-latest"
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={gemini_key}"
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": prompt},
                                {
                                    "inline_data": {
                                        "mime_type": mime_type,
                                        "data": image_base64,
                                    }
                                },
                            ]
                        }
                    ]
                }
                async with httpx.AsyncClient(timeout=45.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    elif res.status_code == 429:
                        set_backoff("gemini_vision", 60.0)
            except Exception as e:
                logger.warning(f"Gemini Vision OCR failed: {e}")

        return ""


# Singleton instance
ai_hub = AIProviderHub()
