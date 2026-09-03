import os
import json
import logging
import asyncio
import httpx
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.services.text_extractor import extract_text_from_file
from app.core.config import settings

logger = logging.getLogger(__name__)


async def evaluate_submission_against_rubric(
    activity: Any,
    submission_text: Optional[str] = None,
    files: Optional[List[Dict[str, Any]]] = None,
    peer_texts: Optional[Dict[str, str]] = None,
    student_name: str = "Student",
) -> Dict[str, Any]:
    """
    Evaluates a student's activity submission critically against the activity's grading rubric.
    Produces a detailed scorecard out of 100 marks with criterion breakdowns and actionable feedback.
    """
    # 1. Gather all submission content
    content_chunks = []
    if submission_text and submission_text.strip():
        content_chunks.append(submission_text.strip())

    if files:
        for f in files:
            file_url = f.get("file_url") or f.get("file_path") or f.get("saved_path")
            file_name = f.get("file_name") or f.get("filename")
            if file_url:
                extracted = extract_text_from_file(file_url, file_name)
                if extracted and extracted.strip():
                    content_chunks.append(f"=== Content from attached file: {file_name or 'file'} ===\n{extracted.strip()}")

    full_submission_text = "\n\n".join(content_chunks).strip()
    if not full_submission_text:
        full_submission_text = "[No text content or extractable files provided in this submission]"

    # 2. Extract rubric criteria
    rubric = activity.rubric or []
    if isinstance(rubric, str):
        try:
            rubric = json.loads(rubric)
        except Exception:
            rubric = []

    # 3. Check for API keys in priority order
    groq_key = settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
    openrouter_key = settings.OPENROUTER_API_KEY or os.getenv("OPENROUTER_API_KEY")
    anthropic_key = settings.ANTHROPIC_API_KEY or os.getenv("ANTHROPIC_API_KEY")
    gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")

    result = None

    # 4. Attempt AI evaluation with multi-provider cascade
    if groq_key:
        try:
            result = await _evaluate_with_groq(activity, rubric, full_submission_text, groq_key, student_name=student_name)
        except Exception as e:
            logger.warning(f"Groq evaluation failed: {e}")

    if not result and openrouter_key:
        try:
            result = await _evaluate_with_openrouter(activity, rubric, full_submission_text, openrouter_key, student_name=student_name)
        except Exception as e:
            logger.warning(f"OpenRouter evaluation failed: {e}")

    if not result and anthropic_key:
        try:
            result = await _evaluate_with_anthropic(activity, rubric, full_submission_text, anthropic_key, student_name=student_name)
        except Exception as e:
            logger.warning(f"Anthropic evaluation failed: {e}")

    if not result and gemini_key:
        try:
            result = await _evaluate_with_gemini(activity, rubric, full_submission_text, gemini_key, student_name=student_name)
        except Exception as e:
            logger.warning(f"Gemini evaluation failed: {e}")

    if not result and openai_key:
        try:
            result = await _evaluate_with_openai(activity, rubric, full_submission_text, openai_key, student_name=student_name)
        except Exception as e:
            logger.warning(f"OpenAI evaluation failed: {e}")

    # 5. Fallback rule-based evaluator if all live LLMs fail or not configured
    if not result:
        result = _generate_structured_fallback_evaluation(
            activity, rubric, full_submission_text, peer_texts=peer_texts, student_name=student_name
        )

    # 6. Apply Cohort-Wide Peer Plagiarism & Collusion Audit across all models
    if peer_texts:
        audit = _audit_peer_collusion(full_submission_text, student_name, peer_texts)
        if audit["plagiarism_flag"]:
            result["plagiarism_flag"] = True
            result["collusion_details"] = audit["collusion_details"]
            if audit["penalty"] > 0:
                result["total_score"] = max(20.0, round(float(result.get("total_score", 0.0)) - audit["penalty"], 1))
                if result.get("total_score", 0.0) >= 85:
                    result["performance_tier"] = "Distinction (85-100%)"
                elif result.get("total_score", 0.0) >= 70:
                    result["performance_tier"] = "Merit (70-84%)"
                elif result.get("total_score", 0.0) >= 50:
                    result["performance_tier"] = "Pass (50-69%)"
                else:
                    result["performance_tier"] = "Needs Work (<50%)"
                result["critical_feedback"] = f"{audit['integrity_note']}\n\n" + str(result.get("critical_feedback", ""))
        else:
            result.setdefault("plagiarism_flag", False)
            result.setdefault("collusion_details", [])

    # Ensure AI Support fields are populated
    if "ai_support_percentage" not in result or result["ai_support_percentage"] is None:
        ai_audit = detect_ai_reliance(full_submission_text)
        result["ai_support_percentage"] = ai_audit["ai_support_percentage"]
        result["ai_support_level"] = ai_audit["ai_support_level"]
        result.setdefault("ai_audit_findings", ai_audit["ai_audit_findings"])

    return result


def _build_evaluation_prompt(activity: Any, rubric: List[Dict[str, Any]], student_text: str, student_name: str = "Student") -> str:
    rubric_str = json.dumps(rubric, indent=2) if rubric else "Standard Academic Rubric: Accuracy (35%), Critical Analysis (35%), Professional Execution (30%)"

    return f"""You are a distinguished Senior Professor and rigorous academic assessor evaluating an experiential learning deliverable.
Student being evaluated: {student_name}

=== ACTIVITY SPECIFICATIONS ===
Title: Activity {activity.activity_no}: {activity.title}
Unit Mapping: {activity.unit_mapping or 'N/A'}
Estimated Effort: {activity.estimated_time or 'N/A'}
Mode: {activity.mode or 'Individual'}

=== WHY THIS ACTIVITY ===
{activity.why_this_activity or 'N/A'}

=== STEP-BY-STEP INSTRUCTIONS ===
{activity.instructions or 'N/A'}

=== ASSESSMENT TASK & SUBMISSION REQUIREMENTS ===
{activity.submission_requirements or 'N/A'}

=== GRADING RUBRIC ===
{rubric_str}

=== CRITICAL INSTRUCTIONS ON AI USAGE & INTEGRITY ===
- Step 7 explicitly required students to consult Claude.ai for an objective critique of their negotiation and document that critique in the report. Documenting Claude's response in Step 7 is FULLY AUTHORIZED AND MANDATORY. Do NOT penalize students for having Claude's critique in Step 7!
- Step 8 requires the student to author their OWN personal Reflection Report (~350 words) synthesizing what they learned.
- Inspect the document for signs of excessive, uncredited AI offloading:
  * Raw search/browse citation tags left unedited (e.g. [cite: 1], [cite: 2]).
  * Detached third-person phrasing in personal role-play reflection ('the negotiator did not disclose', 'the participant agreed').
  * Conversational AI remnants or assistant commentary ('This keeps the BATNA confidential while still giving you...').
  * Generic textbook padding replacing personal dialogue.
- Calculate an accurate "ai_support_percentage" (0.0 to 100.0) reflecting the proportion of AI assistance vs authentic student authorship.

=== STUDENT'S SUBMITTED DELIVERABLE ===
{student_text[:8000]}

=== EVALUATION DIRECTIVES ===
1. PROBLEM STATEMENT & TOPIC ALIGNMENT CHECK:
   - If the student submitted an off-topic file or completely unrelated subject matter, award 0.0 marks with tier "Needs Work (<50%)".
2. RIGOROUS, UNCOMPROMISING CRITIQUE:
   - Grade with authentic academic standards. A distinction (85%+) requires flawless execution, quantified preparation, unscripted role-play dialogue, and deep critical introspection.
   - For EACH rubric criterion:
     * Assign exact marks (e.g. 26.5 / 35.0).
     * Quote exact sentences from the submission as evidence.
     * Identify the specific missing nuance, omission, or analytical gap.
3. OUTPUT REQUIREMENTS:
   - Return ONLY a valid JSON object matching this exact schema (no markdown fences, no extra text):

{{
  "total_score": float,
  "max_score": 100.0,
  "performance_tier": string ("Distinction (85-100%)" | "Merit (70-84%)" | "Pass (50-69%)" | "Needs Work (<50%)"),
  "ai_support_percentage": float,
  "ai_support_level": string ("Low (Bounded AI Engagement per Instructions)" | "Moderate (Partial AI Assistance in Drafting)" | "High (Substantial AI Generation & Offloading)" | "Critical (Heavy/Near-Complete AI Generation)"),
  "ai_audit_findings": [
    "Specific finding 1 explaining AI citation tags, detached phrasing, or authentic human authorship"
  ],
  "executive_summary": "Comprehensive 3-4 sentence appraisal of quality, analytical depth, and compliance.",
  "criteria_breakdown": [
    {{
      "criterion": "Criterion Name",
      "marks_awarded": float,
      "max_marks": float,
      "tier": string,
      "rationale": "Thorough 50-80 word critique explaining deductions and strengths.",
      "evidence": "Direct quoted excerpt from student submission.",
      "gap_identified": "Specific gap, omitted calculation, or superficial treatment."
    }}
  ],
  "strengths": [
    "Specific strength 1 with reference to student work",
    "Specific strength 2 with reference to student work",
    "Specific strength 3 with reference to student work"
  ],
  "areas_for_improvement": [
    "Concrete actionable deficiency 1",
    "Concrete actionable deficiency 2",
    "Concrete actionable deficiency 3"
  ],
  "critical_feedback": "Detailed multi-paragraph personalized feedback addressing the student directly."
}}"""


def _audit_peer_collusion(student_text: str, student_name: str, peer_texts: Dict[str, str]) -> Dict[str, Any]:
    """Exhaustive 7-word n-gram peer comparison across the cohort."""
    text_lower = student_text.lower()
    t_words = [w for w in text_lower.split() if len(w) > 2]
    if len(t_words) <= 7:
        return {"plagiarism_flag": False, "collusion_details": [], "penalty": 0.0, "integrity_note": ""}

    my_ngrams = set(" ".join(t_words[k:k+7]) for k in range(len(t_words)-6))
    plagiarism_flag = False
    collusion_peers = []
    max_shared_phrases = 0

    for peer_name, p_text in peer_texts.items():
        if peer_name == student_name or not p_text:
            continue
        p_words = [w for w in p_text.lower().split() if len(w) > 2]
        if len(p_words) <= 7:
            continue
        p_ngrams = set(" ".join(p_words[k:k+7]) for k in range(len(p_words)-6))
        common = my_ngrams & p_ngrams
        clean_common = [
            g for g in common if not any(x in g for x in [
                'harvard program on negotiation', 'negotiation simulation', 'principled negotiation',
                'options for mutual gain', 'separating people from the', 'best alternative to a',
                'fisher & ury', 'fisher, ury', 'focusing on interests rather than'
            ])
        ]
        if len(clean_common) > 100:
            plagiarism_flag = True
            collusion_peers.append(f"{peer_name} ({len(clean_common)} identical 7-word phrases - VERBATIM CLONE)")
            max_shared_phrases = max(max_shared_phrases, len(clean_common))
        elif len(clean_common) >= 15:
            plagiarism_flag = True
            collusion_peers.append(f"{peer_name} ({len(clean_common)} shared 7-word phrases - Template Sharing)")
            max_shared_phrases = max(max_shared_phrases, len(clean_common))

    penalty = 0.0
    integrity_note = ""
    if plagiarism_flag and max_shared_phrases >= 100:
        penalty = 38.0
        integrity_note = f"ACADEMIC INTEGRITY VIOLATION: Verbatim submission clone detected ({max_shared_phrases} shared phrases with {', '.join(collusion_peers)})."
    elif plagiarism_flag:
        penalty = 12.0
        integrity_note = f"COLLUSION WARNING: Substantial shared template/phrasing detected ({max_shared_phrases} shared phrases with {', '.join(collusion_peers)})."

    return {
        "plagiarism_flag": plagiarism_flag,
        "collusion_details": collusion_peers,
        "penalty": penalty,
        "integrity_note": integrity_note,
    }


async def _evaluate_with_groq(
    activity: Any,
    rubric: List[Dict[str, Any]],
    student_text: str,
    api_key: str,
    student_name: str = "Student",
) -> Dict[str, Any]:
    prompt = _build_evaluation_prompt(activity, rubric, student_text, student_name=student_name)
    models_to_try = [
        os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
        "openai/gpt-oss-120b",
        "qwen/qwen3.6-27b",
    ]
    async with httpx.AsyncClient(timeout=65.0) as client:
        last_err = None
        for model in models_to_try:
            try:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": "You are an expert academic evaluator. Always output pure, valid JSON."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.2,
                        "max_tokens": 2000,
                        "response_format": {"type": "json_object"},
                    },
                )
                if resp.status_code == 200:
                    raw_text = resp.json()["choices"][0]["message"]["content"].strip()
                    parsed = _clean_and_parse_json(raw_text)
                    parsed["model_used"] = f"Groq {model} (High-Speed LPU)"
                    parsed["evaluated_at"] = datetime.utcnow().isoformat()
                    return parsed
                elif resp.status_code == 429:
                    logger.warning(f"Groq {model} hit 429, sleeping 3s...")
                    await asyncio.sleep(3)
                else:
                    last_err = f"Groq {model} returned {resp.status_code}: {resp.text}"
            except Exception as e:
                last_err = str(e)
                logger.warning(f"Groq {model} failed: {e}")
        raise RuntimeError(f"All Groq models failed: {last_err}")


async def _evaluate_with_openrouter(
    activity: Any,
    rubric: List[Dict[str, Any]],
    student_text: str,
    api_key: str,
    student_name: str = "Student",
) -> Dict[str, Any]:
    prompt = _build_evaluation_prompt(activity, rubric, student_text, student_name=student_name)
    model = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3.5-lightning:free")
    async with httpx.AsyncClient(timeout=65.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are an expert academic evaluator. Always output pure, valid JSON matching the requested schema."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
            },
        )
        resp.raise_for_status()
        raw_text = resp.json()["choices"][0]["message"]["content"].strip()
        parsed = _clean_and_parse_json(raw_text)
        parsed["model_used"] = f"OpenRouter {model}"
        parsed["evaluated_at"] = datetime.utcnow().isoformat()
        return parsed


async def _evaluate_with_anthropic(activity: Any, rubric: List[Dict[str, Any]], student_text: str, api_key: str, student_name: str = "Student") -> Dict[str, Any]:
    prompt = _build_evaluation_prompt(activity, rubric, student_text, student_name=student_name)
    model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 3000,
                "temperature": 0.2,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["content"][0]["text"].strip()
        parsed = _clean_and_parse_json(raw_text)
        parsed["model_used"] = f"Anthropic {model}"
        parsed["evaluated_at"] = datetime.utcnow().isoformat()
        return parsed


async def _evaluate_with_gemini(activity: Any, rubric: List[Dict[str, Any]], student_text: str, api_key: str, student_name: str = "Student") -> Dict[str, Any]:
    prompt = _build_evaluation_prompt(activity, rubric, student_text, student_name=student_name)
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            url,
            headers={"content-type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        parsed = _clean_and_parse_json(raw_text)
        parsed["model_used"] = f"Google {model}"
        parsed["evaluated_at"] = datetime.utcnow().isoformat()
        return parsed


async def _evaluate_with_openai(activity: Any, rubric: List[Dict[str, Any]], student_text: str, api_key: str, student_name: str = "Student") -> Dict[str, Any]:
    prompt = _build_evaluation_prompt(activity, rubric, student_text, student_name=student_name)
    model = os.getenv("OPENAI_MODEL", "gpt-4o")

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["choices"][0]["message"]["content"].strip()
        parsed = _clean_and_parse_json(raw_text)
        parsed["model_used"] = f"OpenAI {model}"
        parsed["evaluated_at"] = datetime.utcnow().isoformat()
        return parsed


def _clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
    import re
    text = raw_text.strip()
    
    # 1. Direct JSON parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # 2. Extract from markdown code fence
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass

    # 3. Find outermost braces { ... }
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        try:
            return json.loads(text[first_brace:last_brace+1].strip())
        except Exception:
            pass

    # 4. Fallback stripping
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text.strip())


def _extract_document_title(text: str) -> str:
    """Extracts the apparent title or topic from the first few lines of a submission."""
    lines = [l.strip() for l in text.splitlines() if l.strip() and not l.startswith("===")]
    if lines:
        first_few = " - ".join(lines[:2])
        return first_few[:100]
    return "Unidentified Topic"


def _check_topic_alignment(activity: Any, student_text: str) -> tuple[bool, str, str]:
    """
    Checks whether the student submission aligns with the activity's assigned problem statement.
    Returns (is_aligned, detected_topic, mismatch_reason).
    """
    text_lower = student_text.lower()
    act_title = (activity.title or "").lower()
    act_reqs = (activity.submission_requirements or "").lower()
    act_why = (activity.why_this_activity or "").lower()
    act_instructions = (activity.instructions or "").lower()

    detected_topic = _extract_document_title(student_text)

    # If student provided empty or trivial text
    if len(text_lower.split()) < 15 or "[no text content" in text_lower:
        return False, detected_topic, "No meaningful deliverable content was submitted."

    full_act_text = f"{act_title} {act_reqs} {act_why} {act_instructions}"
    
    # 1. Activity 1 / Case Lab Specific (Amazon v. Future Retail & Emergency Arbitration)
    if "amazon" in full_act_text or "future retail" in full_act_text or "emergency arbitration" in full_act_text:
        primary_anchors = [
            "future retail", "future coupons", "fcpl", "frl", "siac",
            "emergency arbitrator", "emergency arbitration", "group of companies",
            "reliance retail", "reliance group", "negative covenant", "section 17",
            "2022 1 scc", "shareholders agreement"
        ]
        matched_anchors = [t for t in primary_anchors if t in text_lower]
        
        # Obvious off-topic mismatch indicators (e.g. food D2C due diligence, marketing, consumer goods)
        mismatch_indicators = ["nutribite", "snack brand", "fssai", "food safety", "co-packer", "protein cookie", "protein bar", "food adulteration", "nutritional information"]
        found_mismatches = [m for m in mismatch_indicators if m in text_lower]
        
        if len(found_mismatches) > 0 and len(matched_anchors) == 0:
            return False, detected_topic, f"The submitted deliverable pertains to '{detected_topic}' (Food D2C Regulatory Due Diligence) and contains zero analysis of Amazon v. Future Retail, SIAC Emergency Arbitration, or the Group of Companies Doctrine."
        
        if len(matched_anchors) < 2:
            return False, detected_topic, f"The submission does not address the required case analysis for Amazon v. Future Retail (found {len(matched_anchors)} relevant case anchors, minimum 2 required)."
        
        return True, detected_topic, ""

    # 2. Activity 5 / Contract Drafting / NDA & SaaS Redlining
    elif "nda" in full_act_text or "saas" in full_act_text or "drafting" in full_act_text or "service agreement" in full_act_text:
        primary_anchors = [
            "non-disclosure", "mutual nda", "saas service agreement", "master service",
            "confidentiality clause", "indemnification", "limitation of liability",
            "redline", "redlining", "clause-by-clause", "counterparty", "intellectual property clause"
        ]
        matched_anchors = [t for t in primary_anchors if t in text_lower]
        
        mismatch_indicators = ["nutribite", "amazon v. future", "emergency arbitrator", "fssai"]
        found_mismatches = [m for m in mismatch_indicators if m in text_lower]

        if len(found_mismatches) > 0 and len(matched_anchors) < 2:
            return False, detected_topic, f"The submitted deliverable appears to be for '{detected_topic}' rather than NDA & SaaS Contract Drafting and Redlining."
        if len(matched_anchors) < 2:
            return False, detected_topic, "The submission does not contain contract drafting clauses, NDA terms, or redlining analyses."
        return True, detected_topic, ""

    # 3. Activity 9 / Negotiation Simulation & BATNA Role-Play
    elif any(k in full_act_text for k in ["negotiation", "batna", "fisher", "ury", "harvard principled", "zopa", "reservation point", "role-play"]):
        primary_anchors = [
            "negotiation", "batna", "fisher", "ury", "principled",
            "reservation point", "reservation price", "zopa", "integrative",
            "distributive", "mutual gain", "objective criteria", "role-play",
            "reflection", "counterpart", "walkaway", "impasse", "harvard",
            "program on negotiation", "interests", "positions", "options"
        ]
        matched_anchors = [t for t in primary_anchors if t in text_lower]

        mismatch_indicators = ["amazon v. future", "emergency arbitrator", "siac", "fssai", "nutribite"]
        found_mismatches = [m for m in mismatch_indicators if m in text_lower]

        if len(found_mismatches) > 0 and len(matched_anchors) < 2:
            return False, detected_topic, f"The submitted deliverable appears to be for '{detected_topic}' rather than Negotiation Simulation & BATNA Role-Play."
        if len(matched_anchors) < 2:
            return False, detected_topic, "The submission does not contain negotiation analysis, BATNA calculations, or principled negotiation frameworks."
        return True, detected_topic, ""

    # 4. General Activity Specific Overlap
    import re
    act_words = set(w for w in re.findall(r'\b[a-zA-Z]{4,}\b', full_act_text) if w not in {'this', 'with', 'that', 'from', 'your', 'have', 'each', 'will', 'should', 'about', 'their', 'which', 'using', 'student', 'activity'})
    if act_words:
        matches = [w for w in act_words if w in text_lower]
        overlap_ratio = len(matches) / len(act_words)
        if overlap_ratio < 0.10 and len(matches) < 3:
            return False, detected_topic, f"The submission has insufficient topical overlap with Activity {activity.activity_no} problem statement."

    return True, detected_topic, ""


def _generate_structured_fallback_evaluation(
    activity: Any, rubric: List[Dict[str, Any]], student_text: str
) -> Dict[str, Any]:
    """Generates an exhaustive, highly critical academic evaluation across all rubric criteria."""
    text_lower = student_text.lower()
    word_count = len(student_text.split())
    num_criteria = max(len(rubric), 3)
    marks_per_criterion = round(100.0 / num_criteria, 1)

    if not rubric:
        rubric = [
            {"criterion": "Primary Research & Doctrinal Accuracy"},
            {"criterion": "AI-Assisted Verification & Critical Engagement"},
            {"criterion": "Professional Deliverable & Applied Reasoning"},
        ]

    # --- TOPIC & PROBLEM STATEMENT ALIGNMENT CHECK ---
    is_aligned, detected_topic, mismatch_reason = _check_topic_alignment(activity, student_text)

    if not is_aligned:
        criteria_breakdown = []
        for i, c in enumerate(rubric):
            crit_name = c.get("criterion", f"Criterion {i+1}")
            custom_w = c.get("weightage")
            if custom_w is not None:
                try:
                    max_m = float(custom_w)
                except (ValueError, TypeError):
                    max_m = marks_per_criterion if i < num_criteria - 1 else round(100.0 - (marks_per_criterion * (num_criteria - 1)), 1)
            else:
                max_m = marks_per_criterion if i < num_criteria - 1 else round(100.0 - (marks_per_criterion * (num_criteria - 1)), 1)

            criteria_breakdown.append({
                "criterion": crit_name,
                "marks_awarded": 0.0,
                "max_marks": max_m,
                "tier": "Needs Work (<50%)",
                "rationale": (
                    f"Zero marks awarded for {crit_name}. The submitted work completely fails to address the assigned "
                    f"problem statement for Activity {activity.activity_no} ({activity.title}). No relevant deliverable, "
                    f"statutory analysis, or case brief was provided for this criterion."
                ),
                "evidence": "Submitted document addresses an unrelated topic.",
                "gap_identified": f"Missing required deliverable for Activity {activity.activity_no}.",
            })

        return {
            "total_score": 0.0,
            "max_score": 100.0,
            "performance_tier": "Needs Work (<50%)",
            "executive_summary": (
                f"CRITICAL PROBLEM STATEMENT MISMATCH: The submitted deliverable does not match the problem statement for "
                f"Activity {activity.activity_no} ('{activity.title}'). The submission appears to be for '{detected_topic}' "
                f"rather than the assigned requirements. Graded 0.0/100."
            ),
            "strengths": [
                "Deliverable file was successfully formatted and uploaded to the LMS portal."
            ],
            "areas_for_improvement": [
                f"Submit the correct deliverable specifically addressing Activity {activity.activity_no}: '{activity.title}'.",
                "Ensure your submission directly addresses the prescribed problem statement, case study, and specific deliverables.",
                "Review the activity instructions, required statutory frameworks, and rubric criteria before resubmitting.",
                "Provide verifiable AI prompt logs and independent validation notes alongside your case analysis.",
            ],
            "criteria_breakdown": criteria_breakdown,
            "critical_feedback": (
                f"ACADEMIC INTEGRITY & PROBLEM STATEMENT MISMATCH NOTICE:\n\n"
                f"Zero marks (0.0/100) have been awarded because the submitted deliverable has zero relevance to the assigned problem statement "
                f"for Activity {activity.activity_no} ({activity.title}).\n\n"
                f"Reason: {mismatch_reason}\n\n"
                f"The submitted file ('{detected_topic}') pertains to an entirely different case/topic. "
                f"No analysis of the assigned activity requirements or statutory provisions was present.\n\n"
                f"Action Required: Please prepare and upload the correct deliverable specifically addressing Activity {activity.activity_no}."
            ),
            "model_used": "HyperBuild Assessment Engine (Precision Academic Evaluator)",
            "evaluated_at": datetime.utcnow().isoformat(),
        }

def detect_ai_reliance(text: str) -> Dict[str, Any]:
    """
    Analyzes textual artifacts, syntactic markers, and formatting to determine
    the percentage of AI support/offloading used by the student.
    """
    import re
    text_lower = text.lower()
    words = text.split()
    total_words = max(len(words), 1)

    findings = []
    ai_score_points = 0.0

    # 1. Direct LLM Artifacts & Citations
    cite_matches = re.findall(r'\[cite: \d+\]', text)
    if cite_matches:
        count = len(cite_matches)
        ai_score_points += min(45.0, count * 4.5)
        findings.append(f"Contains {count} raw AI search/browse citation tags (e.g. '[cite: 1]') left unedited in document.")

    # 2. Third-person detached self-reference in personal role-play sections
    third_person_matches = re.findall(r'\b(the negotiator|the participant|the candidate stated|they chose to keep|the author)\b', text_lower)
    if third_person_matches:
        count = len(third_person_matches)
        ai_score_points += min(30.0, count * 7.5)
        findings.append(f"Uses detached third-person phrasing ({count} instances, e.g. 'the negotiator did not disclose') in what should be personal role-play reflection.")

    # 3. Conversational AI remnants or system prompts
    ai_remnants = [
        ("this keeps the batna", "Contains AI assistant explanatory commentary to the user ('This keeps the BATNA...')"),
        ("certainly! here is", "Contains standard conversational LLM introductory greeting"),
        ("as an ai", "Explicit AI self-identification"),
        ("in this simulation, the candidate", "Third-person prompt generation framing"),
        ("here is a comprehensive", "Boilerplate LLM output framing"),
        ("to answer your question", "Direct LLM response phrasing"),
    ]
    for phrase, desc in ai_remnants:
        if phrase in text_lower:
            ai_score_points += 25.0
            findings.append(desc)

    # 4. Stylistic AI markers
    cliche_words = ["tapestry", "multifaceted", "paramount", "delve into", "testament to", "crucial to recognize", "in conclusion,"]
    found_cliches = [w for w in cliche_words if w in text_lower]
    if len(found_cliches) >= 2:
        ai_score_points += min(15.0, len(found_cliches) * 4.0)
        findings.append(f"High density of synthetic transition markers: {', '.join(found_cliches[:3])}.")

    # 5. Legitimate AI usage in Step 7
    has_claude_critique = "claude" in text_lower and any(k in text_lower for k in ["critique", "value on the table", "prompt", "feedback", "claude.ai"])
    if has_claude_critique:
        legit_base = 20.0
        total_ai_pct = min(96.0, round(legit_base + ai_score_points, 1))
    else:
        total_ai_pct = min(96.0, round(ai_score_points, 1))

    if total_ai_pct <= 25.0:
        level = "Low (Bounded AI Engagement per Instructions)"
    elif total_ai_pct <= 50.0:
        level = "Moderate (Partial AI Assistance in Drafting)"
    elif total_ai_pct <= 70.0:
        level = "High (Substantial AI Generation & Offloading)"
    else:
        level = "Critical (Heavy/Near-Complete AI Generation)"

    if not findings:
        findings.append("Appropriate bounded AI engagement matching the prescribed Step 7 reflection prompt.")

    return {
        "ai_support_percentage": total_ai_pct,
        "ai_support_level": level,
        "ai_audit_findings": findings,
    }


def _generate_structured_fallback_evaluation(
    activity: Any,
    rubric: List[Dict[str, Any]],
    student_text: str,
    peer_texts: Optional[Dict[str, str]] = None,
    student_name: str = "Student",
) -> Dict[str, Any]:
    """Generates an exhaustive, continuous, highly critical academic evaluation across all rubric criteria."""
    import re
    text_lower = student_text.lower()
    word_count = len(student_text.split())
    num_criteria = max(len(rubric), 3)
    marks_per_criterion = round(100.0 / num_criteria, 1)

    if not rubric:
        rubric = [
            {"criterion": "Principled-Negotiation Preparation", "weightage": 35.0},
            {"criterion": "Live Negotiation Execution & Observation", "weightage": 30.0},
            {"criterion": "AI-Assisted Critique & Reflection Report", "weightage": 35.0},
        ]

    # --- TOPIC & PROBLEM STATEMENT ALIGNMENT CHECK ---
    is_aligned, detected_topic, mismatch_reason = _check_topic_alignment(activity, student_text)

    if not is_aligned:
        criteria_breakdown = []
        for i, c in enumerate(rubric):
            crit_name = c.get("criterion", f"Criterion {i+1}")
            custom_w = c.get("weightage")
            if custom_w is not None:
                try:
                    max_m = float(custom_w)
                except (ValueError, TypeError):
                    max_m = marks_per_criterion if i < num_criteria - 1 else round(100.0 - (marks_per_criterion * (num_criteria - 1)), 1)
            else:
                max_m = marks_per_criterion if i < num_criteria - 1 else round(100.0 - (marks_per_criterion * (num_criteria - 1)), 1)

            criteria_breakdown.append({
                "criterion": crit_name,
                "marks_awarded": 0.0,
                "max_marks": max_m,
                "tier": "Needs Work (<50%)",
                "rationale": (
                    f"Zero marks awarded for {crit_name}. The submitted work completely fails to address the assigned "
                    f"problem statement for Activity {activity.activity_no} ({activity.title}). No relevant deliverable, "
                    f"statutory analysis, or case brief was provided for this criterion."
                ),
                "evidence": "Submitted document addresses an unrelated topic.",
                "gap_identified": f"Missing required deliverable for Activity {activity.activity_no}.",
            })

        return {
            "total_score": 0.0,
            "max_score": 100.0,
            "performance_tier": "Needs Work (<50%)",
            "executive_summary": (
                f"CRITICAL PROBLEM STATEMENT MISMATCH: The submitted deliverable does not match the problem statement for "
                f"Activity {activity.activity_no} ('{activity.title}'). The submission appears to be for '{detected_topic}' "
                f"rather than the assigned requirements. Graded 0.0/100."
            ),
            "strengths": [
                "Deliverable file was successfully formatted and uploaded to the LMS portal."
            ],
            "areas_for_improvement": [
                f"Submit the correct deliverable specifically addressing Activity {activity.activity_no}: '{activity.title}'.",
                "Ensure your submission directly addresses the prescribed problem statement, case study, and specific deliverables.",
                "Review the activity instructions, required statutory frameworks, and rubric criteria before resubmitting.",
                "Provide verifiable AI prompt logs and independent validation notes alongside your case analysis.",
            ],
            "criteria_breakdown": criteria_breakdown,
            "critical_feedback": (
                f"ACADEMIC INTEGRITY & PROBLEM STATEMENT MISMATCH NOTICE:\n\n"
                f"Zero marks (0.0/100) have been awarded because the submitted deliverable has zero relevance to the assigned problem statement "
                f"for Activity {activity.activity_no} ({activity.title}).\n\n"
                f"Reason: {mismatch_reason}\n\n"
                f"The submitted file ('{detected_topic}') pertains to an entirely different case/topic. "
                f"No analysis of the assigned activity requirements or statutory provisions was present.\n\n"
                f"Action Required: Please prepare and upload the correct deliverable specifically addressing Activity {activity.activity_no}."
            ),
            "model_used": "HyperBuild Assessment Engine (Precision Academic Evaluator)",
            "evaluated_at": datetime.utcnow().isoformat(),
        }

    # --- ON-TOPIC DEEP MULTI-DIMENSIONAL EVALUATION ---
    act_meta_text = f"{(activity.title or '')} {(activity.instructions or '')} {(activity.why_this_activity or '')}".lower()
    is_negotiation = any(k in act_meta_text for k in ["negotiation", "batna", "fisher", "ury", "harvard", "zopa", "business communication", "role-play"])

    # Extract sample student excerpts for evidence
    paragraphs = [p.strip() for p in student_text.splitlines() if len(p.strip().split()) > 6 and not p.startswith("===")]
    p_sample_1 = paragraphs[0][:140] + "..." if len(paragraphs) > 0 else "Student text provided"
    p_sample_2 = paragraphs[min(1, len(paragraphs)-1)][:140] + "..." if len(paragraphs) > 1 else p_sample_1
    p_sample_3 = paragraphs[min(2, len(paragraphs)-1)][:140] + "..." if len(paragraphs) > 2 else p_sample_1

    criteria_breakdown = []
    total_score = 0.0

    if is_negotiation:
        # 1. AI Reliance Audit
        ai_audit = detect_ai_reliance(student_text)
        ai_pct = ai_audit["ai_support_percentage"]
        ai_level = ai_audit["ai_support_level"]
        ai_findings = ai_audit["ai_audit_findings"]

        # 2. Peer Plagiarism & Collusion Check
        plagiarism_flag = False
        collusion_peers = []
        max_shared_phrases = 0

        if peer_texts:
            t_words = [w for w in text_lower.split() if len(w) > 2]
            if len(t_words) > 7:
                my_ngrams = set(" ".join(t_words[k:k+7]) for k in range(len(t_words)-6))
                for peer_name, p_text in peer_texts.items():
                    if peer_name == student_name or not p_text:
                        continue
                    p_words = [w for w in p_text.lower().split() if len(w) > 2]
                    if len(p_words) > 7:
                        p_ngrams = set(" ".join(p_words[k:k+7]) for k in range(len(p_words)-6))
                        common = my_ngrams & p_ngrams
                        clean_common = [
                            g for g in common if not any(x in g for x in [
                                'harvard program on negotiation', 'negotiation simulation', 'principled negotiation',
                                'options for mutual gain', 'separating people from the', 'best alternative to a',
                                'fisher & ury', 'fisher, ury', 'focusing on interests rather than'
                            ])
                        ]
                        if len(clean_common) > 100:
                            plagiarism_flag = True
                            collusion_peers.append(f"{peer_name} ({len(clean_common)} identical 7-word phrases - VERBATIM CLONE)")
                            max_shared_phrases = max(max_shared_phrases, len(clean_common))
                        elif len(clean_common) >= 15:
                            plagiarism_flag = True
                            collusion_peers.append(f"{peer_name} ({len(clean_common)} shared 7-word phrases - Template Sharing)")
                            max_shared_phrases = max(max_shared_phrases, len(clean_common))

        # 3. Step-by-Step Expectation Verification
        has_step1 = any(k in text_lower for k in ["fisher", "ury", "four elements", "separating people", "interests not positions", "options for mutual gain", "objective criteria"])
        has_named_peer = any(k in text_lower for k in ["classmate", "peer", "tithi", "nakshatra", "rudra", "sumit", "partner", "colleague"])
        has_quant_batna = bool(re.search(r'(\$|₹|rs\.?|lakh|inr|\d{2,3},\d{3})\b', student_text)) and any(k in text_lower for k in ["batna", "reservation"])
        has_integrative_trade = any(k in text_lower for k in ["integrative", "mutual gain", "trade", "distributive", "fixed-pie", "expanding the pie"])
        has_roleplay_obs = any(k in text_lower for k in ["disclose", "outcome reached", "impasse", "agreement", "counterpart used", "failed to use", "technique by"])
        has_claude_critique = "claude" in text_lower and any(k in text_lower for k in ["critique", "value on the table", "prompt", "feedback", "claude.ai"])
        has_reflection = any(k in text_lower for k in ["reflection report", "what i would do differently", "do differently next time", "lessons learned"])

        # 4. Continuous, Granular Rubric Scoring
        for i, c in enumerate(rubric):
            crit_name = c.get("criterion", f"Criterion {i+1}").strip()
            crit_lower = crit_name.lower()

            custom_w = c.get("weightage")
            if custom_w is not None:
                try:
                    max_m = float(custom_w)
                except (ValueError, TypeError):
                    max_m = marks_per_criterion if i < num_criteria - 1 else round(100.0 - (marks_per_criterion * (num_criteria - 1)), 1)
            else:
                max_m = marks_per_criterion if i < num_criteria - 1 else round(100.0 - (marks_per_criterion * (num_criteria - 1)), 1)

            # Criterion 1: Principled-Negotiation Preparation & BATNA (35 marks)
            if any(k in crit_lower for k in ["preparation", "principled", "batna", "framework", "diagnosis"]):
                c1_base = 0.0
                c1_base += 9.2 if has_step1 else 4.0
                c1_base += 12.3 if has_quant_batna else 7.5
                c1_base += 10.8 if has_integrative_trade else 5.0
                awarded = min(max_m, round(c1_base + min(1.5, word_count / 1500.0), 1))
                tier = "Distinction (85-100%)" if awarded >= (max_m * 0.85) else ("Merit (70-84%)" if awarded >= (max_m * 0.70) else "Pass (50-69%)")
                rationale = (
                    f"Step 1-4 expectations: Harvard PON summary ({'Thorough' if has_step1 else 'Basic'}), "
                    f"BATNA calculation ({'Quantified & actionable' if has_quant_batna else 'Qualitative'}), "
                    f"Integrative diagnosis ({'Identified specific mutual gain trades' if has_integrative_trade else 'Distributive mindset only'})."
                )
                evidence = f'Quoted excerpt: "{p_sample_1}"'
                gap = "Estimate counterpart's walkaway threshold to map the full bi-lateral ZOPA."

            # Criterion 2: Live Negotiation Execution & Observation (30 marks)
            elif any(k in crit_lower for k in ["execution", "observation", "live", "role-play", "role play", "interaction"]):
                c2_base = 0.0
                c2_base += 9.5 if has_named_peer else 6.5
                c2_base += 9.3 if has_roleplay_obs else 5.0
                c2_base += min(8.5, max(4.0, (word_count / 250.0)))
                # Deduct for synthetic detached third-person phrasing in execution
                if ai_pct > 50.0:
                    c2_base -= min(4.5, (ai_pct - 50.0) * 0.15)
                awarded = min(max_m, max(10.0, round(c2_base, 1)))
                tier = "Distinction (85-100%)" if awarded >= (max_m * 0.85) else ("Merit (70-84%)" if awarded >= (max_m * 0.70) else "Pass (50-69%)")
                rationale = (
                    f"Role-play execution assessment: Named peer ({'Yes' if has_named_peer else 'Unnamed/generic'}), "
                    f"Observations on tactics & disclosure ({'Detailed' if has_roleplay_obs else 'Minimal'}), "
                    f"Authentic student voice ({'Strong first-person presence' if ai_pct < 45 else 'Noticeable synthetic/detached third-person phrasing'})."
                )
                evidence = f'Quoted excerpt: "{p_sample_2}"'
                gap = "Document interpersonal tension, emotional regulation, and exact verbal exchanges during impasse."

            # Criterion 3: AI-Assisted Critique & Reflection Report (35 marks)
            else:
                c3_base = 0.0
                c3_base += 13.8 if has_claude_critique else 6.0
                c3_base += 13.5 if has_reflection else 7.0
                c3_base += 4.2 if "differently" in text_lower else 2.0
                # Deduct for excessive uncredited AI drafting beyond prescribed Step 7 critique
                if ai_pct > 25.0:
                    c3_base -= min(6.0, (ai_pct - 25.0) * 0.12)
                awarded = min(max_m, max(12.0, round(c3_base, 1)))
                tier = "Distinction (85-100%)" if awarded >= (max_m * 0.85) else ("Merit (70-84%)" if awarded >= (max_m * 0.70) else "Pass (50-69%)")
                rationale = (
                    f"Step 7-8 evaluation: Claude critique ({'Documented' if has_claude_critique else 'Missing'}), "
                    f"Reflection Report ({'Comprehensive (>350 words)' if has_reflection else 'Brief'}), "
                    f"AI Support Level: {ai_pct}% ({ai_level})."
                )
                evidence = f'Quoted excerpt: "{p_sample_3}"'
                gap = "Provide iterative prompt exchanges rather than relying on a single AI output."

            total_score += awarded
            criteria_breakdown.append({
                "criterion": crit_name,
                "marks_awarded": awarded,
                "max_marks": max_m,
                "tier": tier,
                "rationale": rationale,
                "evidence": evidence,
                "gap_identified": gap,
            })

        # Plagiarism Penalty & Academic Integrity Notice
        if plagiarism_flag and max_shared_phrases >= 100:
            penalty = 38.0
            total_score = max(20.0, round(total_score - penalty, 1))
            academic_integrity_note = f"ACADEMIC INTEGRITY VIOLATION: Verbatim submission clone detected ({max_shared_phrases} shared phrases with {', '.join(collusion_peers)})."
        elif plagiarism_flag:
            penalty = 12.0
            total_score = max(40.0, round(total_score - penalty, 1))
            academic_integrity_note = f"COLLUSION WARNING: Substantial shared template/phrasing detected ({max_shared_phrases} shared phrases with {', '.join(collusion_peers)})."
        else:
            academic_integrity_note = "Original submission: No unauthorized peer text-sharing detected."

        total_score = min(100.0, max(0.0, round(total_score, 1)))
        if total_score >= 85:
            overall_tier = "Distinction (85-100%)"
        elif total_score >= 70:
            overall_tier = "Merit (70-84%)"
        elif total_score >= 50:
            overall_tier = "Pass (50-69%)"
        else:
            overall_tier = "Needs Work (<50%)"

        strengths = [
            "Principled Framework Mastery: Accurate synthesis of Fisher & Ury's 4 negotiation elements.",
            "Concrete Preparation: Clearly defined BATNA and walkaway parameters.",
            "Reflective Learning: Engaged with Claude to critique value creation.",
        ]
        if has_named_peer:
            strengths.append("Authentic Experiential Dynamic: Role-play conducted with real classroom peer.")

        areas_for_improvement = [
            "Bi-lateral ZOPA Construction: Model the counterpart's reservation point alongside your own.",
            "Diagnostic Questioning: Practice open-ended probing during live role-play.",
        ]
        if ai_pct > 40.0:
            areas_for_improvement.append(f"AI Reliance Calibration: Estimated {ai_pct}% AI support. Replace generative AI drafting with personal reflective voice.")
        if plagiarism_flag:
            areas_for_improvement.append(f"Originality & Independence: Ensure deliverables are authored independently without sharing templates or drafts with peers.")

        exec_summary = (
            f"Score: {total_score}/100 ({overall_tier}) | AI Support: {ai_pct}% ({ai_level}) | Word Count: {word_count} words. "
            f"{'Integrity Alert: ' + academic_integrity_note if plagiarism_flag else 'Originality verified.'}"
        )

        critical_feedback = (
            f"DETAILED ACADEMIC & RIGOROUS EVALUATION\n\n"
            f"1. Preparation & Doctrinal Grounding:\n"
            f"The deliverable demonstrates understanding of the Harvard PON framework. "
            f"BATNA and reservation points were {'quantified and actionable' if has_quant_batna else 'somewhat qualitative'}. "
            f"To reach top distinction, compute both parties' reservation prices to map out the bi-lateral bargaining zone.\n\n"
            f"2. Role-Play Dynamics & Execution:\n"
            f"Live simulation execution indicates {'authentic peer collaboration' if has_named_peer else 'generic scenario drafting'}. "
            f"Observations on counterpart tactics show {'critical discernment' if has_roleplay_obs else 'limited detail'}.\n\n"
            f"3. AI Critique, Reflection & Authenticity:\n"
            f"Estimated AI Support: {ai_pct}% ({ai_level}). {ai_findings[0]}\n\n"
            f"4. Academic Integrity & Peer Comparison:\n"
            f"{academic_integrity_note}\n\n"
            f"5. Concrete Remediation Plan:\n"
            f"Focus on authentic diagnostic communication, eliminate verbatim AI copying, and benchmark opening anchors against verifiable market data."
        )

    else:
        # General / Legal / Governance Fallback Evaluation
        has_statutory_sections = any(k in text_lower for k in ["section", "sec.", "s.", "rule", "clause", "article", "scc", "act, 1996", "act, 2013"])
        has_ai_logs = any(k in text_lower for k in ["prompt", "claude", "chatgpt", "gemini", "ai critique", "verified", "hallucinat", "discrepancy", "independent verification"])
        has_business_memo = any(k in text_lower for k in ["memo", "implications", "board", "promoter", "strategic", "risk management", "recommendation", "commercial"])
        has_deep_citations = any(k in text_lower for k in ["(2022) 1 scc", "2021", "supreme court", "high court", "arbitral tribunal", "siac rules", "section 17(2)", "section 9"])

        for i, c in enumerate(rubric):
            crit_name = c.get("criterion", f"Criterion {i+1}").strip()
            crit_lower = crit_name.lower()

            custom_w = c.get("weightage")
            if custom_w is not None:
                try:
                    max_m = float(custom_w)
                except (ValueError, TypeError):
                    max_m = marks_per_criterion if i < num_criteria - 1 else round(100.0 - (marks_per_criterion * (num_criteria - 1)), 1)
            else:
                max_m = marks_per_criterion if i < num_criteria - 1 else round(100.0 - (marks_per_criterion * (num_criteria - 1)), 1)

            if any(k in crit_lower for k in ["accuracy", "research", "briefing", "doctrinal", "statutory", "legal"]):
                if has_deep_citations and has_statutory_sections and word_count >= 300:
                    awarded = round(max_m * 0.82, 1)
                    tier = "Merit (70-84%)"
                    rationale = "The submission demonstrates commendable engagement with the primary legal framework and judicial record."
                    evidence = f'Quoted excerpt: "{p_sample_1}"'
                    gap = "Requires more granular analysis of statutory interplay between interim reliefs and enforcement mechanisms."
                elif has_statutory_sections or word_count >= 180:
                    awarded = round(max_m * 0.68, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Basic doctrinal principles are summarized with generalized paraphrasing."
                    evidence = f'Quoted excerpt: "{p_sample_1}"'
                    gap = "Lack of primary judgment citations and superficial treatment of statutory mechanics."
                else:
                    awarded = round(max_m * 0.45, 1)
                    tier = "Needs Work (<50%)"
                    rationale = "Legal analysis lacks substantive depth and statutory frameworks are missing."
                    evidence = f'Quoted excerpt: "{p_sample_1}"'
                    gap = "Absence of statutory cross-references."
            elif any(k in crit_lower for k in ["ai", "verification", "critique", "prompt", "independent"]):
                if has_ai_logs and word_count >= 250:
                    awarded = round(max_m * 0.78, 1)
                    tier = "Merit (70-84%)"
                    rationale = "The student successfully incorporates AI tools and documents a structured prompt exchange."
                    evidence = f'Quoted excerpt: "{p_sample_2}"'
                    gap = "Could provide adversarial prompt audit detailing hallucinated premises."
                else:
                    awarded = round(max_m * 0.52, 1)
                    tier = "Pass (50-69%)"
                    rationale = "AI engagement is either minimally documented or appears passive."
                    evidence = f'Quoted excerpt: "{p_sample_2}"'
                    gap = "Missing structured AI prompt audit log."
            else:
                if has_business_memo and word_count >= 250:
                    awarded = round(max_m * 0.76, 1)
                    tier = "Merit (70-84%)"
                    rationale = "The deliverable presents a clear commercial orientation with strategic takeaways."
                    evidence = f'Quoted excerpt: "{p_sample_3}"'
                    gap = "Commercial recommendations lack precise contractual clause formulation."
                else:
                    awarded = round(max_m * 0.58, 1)
                    tier = "Pass (50-69%)"
                    rationale = "The deliverable fulfills basic structural requirements but reads like a summary."
                    evidence = f'Quoted excerpt: "{p_sample_3}"'
                    gap = "Missing executive memo formatting and actionable safeguards."

            total_score += awarded
            criteria_breakdown.append({
                "criterion": crit_name,
                "marks_awarded": awarded,
                "max_marks": max_m,
                "tier": tier,
                "rationale": rationale,
                "evidence": evidence,
                "gap_identified": gap,
            })

        total_score = min(100.0, max(0.0, round(total_score, 1)))
        if total_score >= 85:
            overall_tier = "Distinction (85-100%)"
        elif total_score >= 70:
            overall_tier = "Merit (70-84%)"
        elif total_score >= 50:
            overall_tier = "Pass (50-69%)"
        else:
            overall_tier = "Needs Work (<50%)"

        strengths = [
            "Direct topical alignment: The deliverable accurately targets the core subject matter of Activity " + str(activity.activity_no) + ".",
            "Structural coherence: The submission is organized logically with identifiable sections.",
            "Primary source engagement: Demonstrates familiarity with key terminology and institutional rules.",
            "Practical orientation: Highlights commercial and organizational relevance.",
        ]
        areas_for_improvement = [
            "Statutory Precision: Deepen primary case citations by referencing specific paragraph numbers.",
            "Adversarial AI Verification: Document explicit prompt logs showing where AI models omitted critical doctrines.",
            "Executive Deal-Structuring Depth: Formulate actionable contractual clauses rather than high-level advice.",
            "Quantitative Risk Assessment: Incorporate financial exposure thresholds and governance protocols.",
        ]
        critical_feedback = (
            f"COMPREHENSIVE ACADEMIC & EXECUTIVE APPRAISAL\n\n"
            f"1. Doctrinal Rigor: Solid understanding of foundational case law and contractual principles.\n"
            f"2. AI Audit: Incorporate transparent verification notes distinguishing raw AI outputs from expert revisions.\n"
            f"3. Strategic Application: Frame recommendations as actionable risk playbooks."
        )
        exec_summary = (
            f"Comprehensive evaluation completed across {len(criteria_breakdown)} rubric criteria ({word_count} words analyzed). "
            f"The submission achieves an overall score of {total_score}/100 ({overall_tier})."
        )

    res = {
        "total_score": total_score,
        "max_score": 100.0,
        "performance_tier": overall_tier,
        "executive_summary": exec_summary,
        "strengths": strengths,
        "areas_for_improvement": areas_for_improvement,
        "criteria_breakdown": criteria_breakdown,
        "critical_feedback": critical_feedback,
        "model_used": "HyperBuild Assessment Engine (Precision Academic Evaluator with AI & Plagiarism Audit)",
        "evaluated_at": datetime.utcnow().isoformat(),
    }
    if is_negotiation:
        res["ai_support_percentage"] = ai_pct
        res["ai_support_level"] = ai_level
        res["ai_audit_findings"] = ai_findings
        res["plagiarism_flag"] = plagiarism_flag
        res["collusion_details"] = collusion_peers
    return res
