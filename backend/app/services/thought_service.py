import os
import json
import logging
import httpx
from datetime import datetime, date
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger("crc_one.thought_service")

# Curated high-impact daily thoughts for higher education, leadership, and personal excellence
CURATED_THOUGHTS = [
    {
        "thought": "Excellence is not an act, but a habit. We are what we repeatedly do.",
        "author": "Aristotle"
    },
    {
        "thought": "Education is the most powerful weapon which you can use to change the world.",
        "author": "Nelson Mandela"
    },
    {
        "thought": "Learning gives creativity, creativity leads to thinking, thinking provides knowledge, knowledge makes you great.",
        "author": "Dr. A.P.J. Abdul Kalam"
    },
    {
        "thought": "Arise, awake, and stop not till the goal is reached.",
        "author": "Swami Vivekananda"
    },
    {
        "thought": "The mind is not a vessel to be filled, but a fire to be kindled.",
        "author": "Plutarch"
    },
    {
        "thought": "Cultivate the habit of being grateful for every good thing that comes to you, and give thanks continuously.",
        "author": "Ralph Waldo Emerson"
    },
    {
        "thought": "Live as if you were to die tomorrow. Learn as if you were to live forever.",
        "author": "Mahatma Gandhi"
    },
    {
        "thought": "The beautiful thing about learning is that no one can take it away from you.",
        "author": "B.B. King"
    },
    {
        "thought": "You cannot cross the sea merely by standing and staring at the water.",
        "author": "Rabindranath Tagore"
    },
    {
        "thought": "Wisdom is not a product of schooling but of the lifelong attempt to acquire it.",
        "author": "Albert Einstein"
    },
    {
        "thought": "Cultivation of mind should be the ultimate aim of human existence.",
        "author": "Dr. B.R. Ambedkar"
    },
    {
        "thought": "Success is not final, failure is not fatal: it is the courage to continue that counts.",
        "author": "Winston Churchill"
    },
    {
        "thought": "Do what you can, with what you have, where you are.",
        "author": "Theodore Roosevelt"
    },
    {
        "thought": "The expert in anything was once a beginner.",
        "author": "Helen Hayes"
    },
    {
        "thought": "It does not matter how slowly you go as long as you do not stop.",
        "author": "Confucius"
    },
    {
        "thought": "The only limit to our realization of tomorrow will be our doubts of today.",
        "author": "Franklin D. Roosevelt"
    },
    {
        "thought": "Leadership and learning are indispensable to each other.",
        "author": "John F. Kennedy"
    },
    {
        "thought": "Tell me and I forget. Teach me and I remember. Involve me and I learn.",
        "author": "Benjamin Franklin"
    },
    {
        "thought": "Try not to become a man of success. Rather become a man of value.",
        "author": "Albert Einstein"
    },
    {
        "thought": "If you want to shine like a sun, first burn like a sun.",
        "author": "Dr. A.P.J. Abdul Kalam"
    },
    {
        "thought": "In the middle of difficulty lies opportunity.",
        "author": "Albert Einstein"
    },
    {
        "thought": "Quality is never an accident; it is always the result of intelligent effort.",
        "author": "John Ruskin"
    },
    {
        "thought": "Nothing is impossible, the word itself says 'I\'m possible'!",
        "author": "Audrey Hepburn"
    },
    {
        "thought": "The secret of getting ahead is getting started.",
        "author": "Mark Twain"
    },
    {
        "thought": "Don't let what you cannot do interfere with what you can do.",
        "author": "John Wooden"
    },
    {
        "thought": "Education's purpose is to replace an empty mind with an open one.",
        "author": "Malcolm Forbes"
    },
    {
        "thought": "Your time is limited, don't waste it living someone else's life.",
        "author": "Steve Jobs"
    },
    {
        "thought": "Small daily improvements over time lead to stunning results.",
        "author": "Robin Sharma"
    },
    {
        "thought": "A person who never made a mistake never tried anything new.",
        "author": "Albert Einstein"
    },
    {
        "thought": "Continuous effort — not strength or intelligence — is the key to unlocking our potential.",
        "author": "Winston Churchill"
    },
    {
        "thought": "Dream is not that which you see while sleeping; it is something that does not let you sleep.",
        "author": "Dr. A.P.J. Abdul Kalam"
    }
]


class ThoughtService:
    def __init__(self):
        self.gemini_key = (
            os.getenv("GEMINI_API_KEY")
            or getattr(settings, "GEMINI_API_KEY", None)
            or os.getenv("GOOGLE_API_KEY")
        )
        self.gemini_models = [
            "gemini-2.5-flash",
            "gemini-3.7-flash",
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
            "gemini-pro-latest"
        ]
        # Memory cache: key is date string "YYYY-MM-DD"
        self._cache: Dict[str, Dict[str, Any]] = {}

    def _get_curated_thought_for_date(self, today_str: str) -> Dict[str, Any]:
        """Deterministic thought mapped to the day of the year."""
        try:
            d = datetime.strptime(today_str, "%Y-%m-%d").date()
            day_of_year = d.timetuple().tm_yday
        except Exception:
            day_of_year = datetime.utcnow().timetuple().tm_yday

        item = CURATED_THOUGHTS[day_of_year % len(CURATED_THOUGHTS)]
        return {
            "thought": item["thought"],
            "author": item["author"],
            "date": today_str,
            "source": "curated"
        }

    async def _fetch_from_gemini(self, today_str: str) -> Optional[Dict[str, Any]]:
        """Calls Gemini API to dynamically generate a fresh Thought of the Day."""
        if not self.gemini_key:
            return None

        prompt = (
            f"Generate an inspiring, profound Thought of the Day for {today_str} suited for university students, educators, and leaders. "
            "Return ONLY a valid JSON object with exactly two keys: "
            "'thought' (1-2 sentences of an uplifting inspirational quote or original reflection) and "
            "'author' (the person who said or inspired it, e.g. Dr. A.P.J. Abdul Kalam, Aristotle, Albert Einstein, Swami Vivekananda, etc.)."
        )

        for model in self.gemini_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.gemini_key}"
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        url,
                        headers={"content-type": "application/json"},
                        json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {
                                "temperature": 0.7,
                                "maxOutputTokens": 200,
                                "responseMimeType": "application/json"
                            }
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                text = parts[0]["text"].strip()
                                if text.startswith("```"):
                                    text = text.split("```")[1]
                                    if text.startswith("json"):
                                        text = text[4:]
                                parsed = json.loads(text.strip())
                                if "thought" in parsed and "author" in parsed:
                                    logger.info(f"Thought of the day generated via Gemini ({model}) for {today_str}")
                                    return {
                                        "thought": parsed["thought"].strip(),
                                        "author": parsed["author"].strip(),
                                        "date": today_str,
                                        "source": "gemini"
                                    }
            except Exception as ex:
                logger.debug(f"Gemini {model} call failed for Thought of the Day: {ex}")

        return None

    async def get_thought_of_the_day(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Returns the thought of the day, cached daily."""
        today_str = date.today().isoformat()

        if not force_refresh and today_str in self._cache:
            return self._cache[today_str]

        # 1. Try Gemini API
        gemini_result = await self._fetch_from_gemini(today_str)
        if gemini_result:
            self._cache[today_str] = gemini_result
            return gemini_result

        # 2. Fallback to curated daily thought
        curated_result = self._get_curated_thought_for_date(today_str)
        self._cache[today_str] = curated_result
        return curated_result


thought_service = ThoughtService()
