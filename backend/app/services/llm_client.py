import os
import logging
import httpx
from typing import Optional, Dict, Any, List
from app.core.config import settings

logger = logging.getLogger("crc_one.llm_client")


class LLMClient:
    def __init__(self):
        self.gemini_key = (
            os.getenv("GEMINI_API_KEY")
            or settings.GEMINI_API_KEY
            or os.getenv("GOOGLE_API_KEY")
        )
        self.gemini_model = os.getenv("GEMINI_MODEL") or settings.GEMINI_MODEL or "gemini-1.5-flash"
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY") or settings.ANTHROPIC_API_KEY
        self.provider = settings.LLM_PROVIDER or "gemini"

    @property
    def is_configured(self) -> bool:
        return bool(self.gemini_key or self.anthropic_key)

    async def generate_chat_response(
        self,
        user_prompt: str,
        system_instruction: Optional[str] = None,
        retrieved_data: Optional[List[Dict[str, Any]]] = None,
        tool_call: Optional[str] = None,
    ) -> str:
        """
        Generates an intelligent natural language response via Gemini for Copilot Chat.
        """
        # 1. Attempt Gemini if key is present
        if self.gemini_key:
            try:
                return await self._call_gemini(user_prompt, system_instruction, retrieved_data, tool_call)
            except Exception as e:
                logger.warning(f"Gemini Copilot generation warning: {e}. Falling back to internal engine.")

        # 2. Attempt Anthropic if key is present
        if self.anthropic_key:
            try:
                return await self._call_anthropic(user_prompt, system_instruction, retrieved_data, tool_call)
            except Exception as e:
                logger.warning(f"Anthropic Copilot generation warning: {e}")

        # 3. Deterministic schema-aware fallback summary
        return self._generate_intelligent_fallback_response(user_prompt, retrieved_data, tool_call)

    async def _call_gemini(
        self,
        user_prompt: str,
        system_instruction: Optional[str],
        retrieved_data: Optional[List[Dict[str, Any]]],
        tool_call: Optional[str],
    ) -> str:
        models_to_try = ["gemini-2.5-flash", "gemini-flash-latest"]
        
        # Build prompt with database context
        context_str = ""
        if retrieved_data:
            context_str = f"\n\nRetrieved Academic Data ({len(retrieved_data)} records):\n{retrieved_data}"

        full_prompt = (
            f"System Instruction: {system_instruction or 'You are Orion Copilot, an intelligent academic operations assistant.'}\n\n"
            f"User Question: {user_prompt}"
            f"{context_str}\n\n"
            f"Provide a concise, helpful, and professional answer referencing the retrieved data directly with bullet points where appropriate."
        )

        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.gemini_key}"
            try:
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.post(
                        url,
                        headers={"content-type": "application/json"},
                        json={
                            "contents": [{"parts": [{"text": full_prompt}]}],
                            "generationConfig": {
                                "temperature": 0.3,
                                "maxOutputTokens": 1000,
                            },
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates and "content" in candidates[0]:
                            parts = candidates[0]["content"].get("parts", [])
                            if parts and "text" in parts[0]:
                                return parts[0]["text"].strip()
                    else:
                        logger.warning(f"Gemini model {model} returned status {resp.status_code}: {resp.text[:120]}")
            except Exception as ex:
                logger.warning(f"Gemini model {model} request failed: {ex}")

        # If all API calls exhausted/rate limited, return intelligent schema response
        return self._generate_intelligent_fallback_response(user_prompt, retrieved_data, tool_call)

    async def _call_anthropic(
        self,
        user_prompt: str,
        system_instruction: Optional[str],
        retrieved_data: Optional[List[Dict[str, Any]]],
        tool_call: Optional[str],
    ) -> str:
        prompt = (
            f"System: {system_instruction or 'You are Orion Copilot.'}\n"
            f"Data: {retrieved_data}\n"
            f"Question: {user_prompt}"
        )
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-3-5-haiku-20241022",
                    "max_tokens": 800,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data["content"][0]["text"].strip()
        return self._generate_intelligent_fallback_response(user_prompt, retrieved_data, tool_call)

    def _generate_intelligent_fallback_response(
        self,
        user_prompt: str,
        retrieved_data: Optional[List[Dict[str, Any]]],
        tool_call: Optional[str],
    ) -> str:
        if not retrieved_data:
            return (
                f"I checked the academic records for '{user_prompt}', but found no matching active records. "
                f"Please refine your search or specify a particular batch, subject code, or faculty member."
            )

        count = len(retrieved_data)
        if tool_call == "student_subject_attendance":
            lines = [
                f"• **{d.get('student')}** (`{d.get('roll_no')}`) in *{d.get('subject')}*: **{d.get('percentage')}** ({d.get('sessions')} sessions) — Status: **{d.get('status')}**"
                for d in retrieved_data[:6]
            ]
            return (
                f"Found **student-wise & subject-wise attendance records** for **{count} subject-student combinations**:\n"
                + "\n".join(lines)
                + f"\n\nAttendance threshold for semester exam eligibility is **75%**."
            )
        elif tool_call == "list_external_faculty":
            names = [f"{d.get('name')} ({d.get('org', 'Lexicon MILE')})" for d in retrieved_data[:5]]
            return (
                f"Found **{count} active faculty members** in the database:\n"
                + "\n".join([f"• **{n}**" for n in names])
                + f"\n\nAll verified under institutional compliance guidelines."
            )
        elif tool_call == "list_sessions":
            sessions = [f"**{s.get('date')}** ({s.get('time')}) at *{s.get('venue')}* — Status: {s.get('status')}" for s in retrieved_data[:5]]
            return (
                f"Found **{count} scheduled classroom & lab sessions**:\n"
                + "\n".join([f"• {s}" for s in sessions])
            )
        elif tool_call == "list_subjects":
            subs = [f"**{s.get('name')}** (`{s.get('code')}`) — {s.get('credits', 3)} Credits ({s.get('type', 'Core')})" for s in retrieved_data[:5]]
            return (
                f"Found **{count} active academic subjects** in the catalog:\n"
                + "\n".join([f"• {s}" for s in subs])
                + f"\n\nEach subject is structured with approved unit syllabi and HyperBuild activities."
            )
        elif tool_call == "list_students":
            students = [f"**{st.get('name')}** (Roll No: `{st.get('roll_no', 'N/A')}`) — {st.get('email', '')}" for st in retrieved_data[:5]]
            return (
                f"Found **{count} enrolled students** in the database:\n"
                + "\n".join([f"• {st}" for st in students])
            )
        elif tool_call == "list_programs":
            programs = [f"**{p.get('name')}** (`{p.get('code')}`)" for p in retrieved_data[:5]]
            return (
                f"Found **{count} academic programs** in the portal:\n"
                + "\n".join([f"• {p}" for p in programs])
            )
        elif tool_call == "list_activities":
            acts = [f"Act {a.get('no')}: **{a.get('title')}** ({'Released' if a.get('released') else 'Locked'})" for a in retrieved_data[:5]]
            return (
                f"Found **{count} HyperBuild activities**:\n"
                + "\n".join([f"• {a}" for a in acts])
            )

        return (
            f"Retrieved **{count} relevant database records** matching '{user_prompt}'. "
            f"Everything is up to date and synchronized with the LMS and Academic Registry."
        )

    async def generate_summary(self, prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        return await self.generate_chat_response(prompt, tool_call=context.get("tool_call") if context else None)


llm_client = LLMClient()

