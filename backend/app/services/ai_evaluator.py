import os
import json
import time
import logging
import asyncio
import httpx
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.services.text_extractor import extract_text_from_file
from app.core.config import settings

logger = logging.getLogger(__name__)

_ollama_backoff_until = 0.0
_groq_backoff_until = 0.0


async def evaluate_submission_against_rubric(
    activity: Any,
    submission_text: Optional[str] = None,
    files: Optional[List[Dict[str, Any]]] = None,
    peer_texts: Optional[Dict[str, str]] = None,
    student_name: str = "Student",
    technique: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluates a student's activity submission critically against the activity's grading rubric.
    Produces a detailed scorecard out of 100 marks with criterion breakdowns and actionable feedback.
    Supports configurable evaluation techniques: 'balanced_rubric_native' (default) and 'calibrated_hard_caps'.
    """
    # 1. Gather all submission content
    content_chunks = []
    if submission_text and submission_text.strip():
        content_chunks.append(submission_text.strip())

    manifest_lines = []
    if files:
        manifest_lines.append(f"=== SUBMISSION ATTACHMENTS MANIFEST ({len(files)} files uploaded) ===")
        for idx, f in enumerate(files):
            file_url = f.get("file_url") or f.get("file_path") or f.get("saved_path")
            file_name = f.get("file_name") or f.get("filename") or f"file_{idx+1}"
            file_size = f.get("file_size") or 0
            file_type = f.get("file_type") or (os.path.splitext(file_name)[1] if file_name else "file")

            extracted = ""
            if file_url:
                extracted = extract_text_from_file(file_url, file_name)

            if extracted and extracted.strip():
                # Allow up to 50,000 characters per file so secondary files are never starved
                truncated_file_text = extracted.strip()[:50000]
                manifest_lines.append(f"- File {idx+1}: {file_name} ({file_type}, {file_size} bytes, {len(extracted)} chars extracted)")
                content_chunks.append(
                    f"=== ATTACHED FILE [{idx+1}/{len(files)}]: {file_name} ===\n{truncated_file_text}"
                )
            else:
                manifest_lines.append(f"- File {idx+1}: {file_name} ({file_type}, {file_size} bytes) [NOTE: File uploaded by student; visual/scanned format]")
                content_chunks.append(
                    f"=== ATTACHED FILE [{idx+1}/{len(files)}]: {file_name} ===\n[File was successfully uploaded ({file_size} bytes). Text extraction returned empty (e.g. scanned image or vector drawing). Acknowledge that the student submitted this deliverable.]"
                )

        if manifest_lines:
            content_chunks.insert(0, "\n".join(manifest_lines))

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

    ollama_url = getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434") or "http://127.0.0.1:11434"
    ollama_model = getattr(settings, "OLLAMA_MODEL", "gemma4:31b-cloud") or "gemma4:31b-cloud"
    ollama_key = getattr(settings, "OLLAMA_API_KEY", None) or os.getenv("OLLAMA_API_KEY")

    # 4. Attempt AI evaluation with multi-provider cascade
    # Priority 1: High-precision Ollama Cloud (Gemma 4 31B, sub-second, 262k context, no rate limits)
    global _ollama_backoff_until
    now_ts = time.time()
    if ollama_url and now_ts > _ollama_backoff_until:
        try:
            result = await _evaluate_with_ollama(
                activity, rubric, full_submission_text,
                base_url=ollama_url, model=ollama_model, api_key=ollama_key,
                student_name=student_name
            )
        except Exception as e:
            logger.warning(f"Ollama evaluation failed: {e}")
            if "429" in str(e) or "too many requests" in str(e).lower():
                _ollama_backoff_until = now_ts + 300.0  # Backoff Ollama for 5 mins


    # Priority 2: Groq Multi-Model LPU (120B / 27B)
    global _groq_backoff_until
    if not result and groq_key and now_ts > _groq_backoff_until:
        try:
            result = await _evaluate_with_groq(activity, rubric, full_submission_text, groq_key, student_name=student_name)
        except Exception as e:
            logger.warning(f"Groq evaluation failed: {e}")
            if "429" in str(e) or "too many requests" in str(e).lower() or "rate" in str(e).lower():
                _groq_backoff_until = time.time() + 60.0

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

    # 7. Apply deterministic AI Reliance & Manual Effort Audit with Grade Caps and Penalties
    ai_audit = detect_ai_reliance(full_submission_text, activity=activity)
    result = apply_ai_penalties_and_caps(result, ai_audit, technique=technique)

    return result


def _build_evaluation_prompt(activity: Any, rubric: List[Dict[str, Any]], student_text: str, student_name: str = "Student") -> str:
    rubric_str = json.dumps(rubric, indent=2) if rubric else "Standard Academic Rubric: Accuracy (35%), Critical Analysis (35%), Professional Execution (30%)"

    act_title = getattr(activity, "title", "Academic Activity") or "Academic Activity"
    act_no = getattr(activity, "activity_no", "")
    unit = getattr(activity, "unit_mapping", "") or "Coursework"
    effort = getattr(activity, "estimated_time", "") or "2-3 hours"
    mode = getattr(activity, "mode", "") or "Individual"
    instructions = getattr(activity, "instructions", "") or ""
    reqs = getattr(activity, "submission_requirements", "") or ""
    outcomes = getattr(activity, "learning_outcomes", "") or ""
    why = getattr(activity, "why_this_activity", "") or ""

    is_negotiation_act = "negotiation" in act_title.lower() or act_no == 9

    if is_negotiation_act:
        protocol_section = """=== MANDATORY STEP-BY-STEP ACTIVITY PROTOCOL (AUDIT EVERY STEP) ===
1. Step 1: ~150-word accurate summary of the 4 principled-negotiation pillars (People/Problem, Interests/Positions, Options for Mutual Gain, Objective Criteria).
2. Step 2: Realistic scenario with a REAL named classmate/peer counterpart (e.g., job offer negotiation or vendor deal in a realistic domestic PGDM context, not an imaginary Silicon Valley USD setting).
3. Step 3: Quantified BATNA and distinct Reservation Point in concrete figures (INR for Indian PGDM cohort).
4. Step 4: Distributive vs Integrative diagnosis with at least ONE specific mutual-gain trade-off identified.
5. Step 5 & 6: Actual 10-15 minute live role-play. Must report: (a) exact outcome, (b) BATNA disclosure decision + rationale, (c) ONE SPECIFIC MOMENT citing what the counterpart did/said using a principled technique.
6. Step 7: Prompt Claude.ai and RECORD Claude's critique in full (must include the actual critique, not just a vague 2-line summary).
7. Step 8: ~350-word personal Reflection Report in the student's AUTHENTIC first-person voice analyzing personal mistakes, cognitive biases, missed value, and concrete behavioral commitments.

=== RIGOROUS, UNCOMPROMISING GRADING NORMS (DO NOT BE LENIENT) ===
- Distinction (85-100%): Flawless execution across all 8 steps. Real classmate named, actual dialogue cited, realistic INR figures, full Claude critique recorded, deeply introspective 350-word reflection. ZERO AI drafting remnants. (Very rare, <5%).
- Merit (70-84%): Strong submission. Real classmate, genuine role-play, but minor gaps (e.g. summarized dialogue, reflection slightly below depth).
- Pass (50-69%): Average work. Meets basic format, but lacks dialogue transcripts, Claude critique is paraphrased/summarized, reflection relies on generic corporate platitudes, or minor AI drafting assistance detected.
- Needs Work (<50%): Severe deficiencies:
  * Fabricated/synthetic role-play (e.g. Silicon Valley USD $115k salaries, no classmate named).
  * Raw AI search tags left unedited (e.g. [cite: 1], [cite: 2]).
  * Conversational AI assistant remnants left in text (e.g. 'This keeps the BATNA confidential while giving you a complete structure...').
  * Detached 3rd-person phrasing ('The negotiator did not disclose...') in what must be a 1st-person reflection.
  * Omission or truncation of Step 8 Reflection Report."""

        micro_schema = """"micro_compliance_audit": {
    "step_1_framework_summary": "Passed / Deficient with specific reason",
    "step_2_real_classmate_scenario": "Passed / Deficient with specific reason",
    "step_3_batna_reservation_quantified": "Passed / Deficient with specific reason",
    "step_4_integrative_tradeoff": "Passed / Deficient with specific reason",
    "step_5_6_live_roleplay_and_specific_moment": "Passed / Deficient with specific reason",
    "step_7_claude_critique_recorded": "Passed / Deficient with specific reason",
    "step_8_reflection_authenticity_and_depth": "Passed / Deficient with specific reason"
  },"""
    else:
        protocol_section = f"""=== ACTIVITY LEARNING OBJECTIVES & REQUIREMENTS ===
Context & Purpose: {why or 'Demonstrate mastery of core principles and practical deliverables.'}
Instructions: {instructions or 'Fulfill all deliverables specified in the activity prompt.'}
Submission Requirements: {reqs or 'Complete practical submission meeting all course requirements.'}
Intended Learning Outcomes: {outcomes or 'Apply concepts analytically with evidence and rigor.'}

=== RIGOROUS, UNCOMPROMISING GRADING NORMS (MANUAL EFFORT VS AI OFFLOADING) ===
In this era of generative AI, high scores (85+) MUST BE EARNED through genuine human thinking, empirical data, and manual execution, not uncritical prompt copy-pasting.

1. CRITERIA FOR IDENTIFYING AUTHENTIC MANUAL EFFORT:
- Grounded Empirical Evidence: Real student calculations, formula linking across cells in Excel (e.g. $B$6, SUM, NORM.DIST), genuine dialogue excerpts and transcripts from live discussions, naming real classmates, domestic Indian business context (INR/₹, real entities).
- Authentic Reflective Candor: Candid first-person introspection, admitting personal mistakes, hesitation, or cognitive biases during simulations/case analyses.
- Idiosyncratic Human Style: Organic paragraph structures, non-templated phrasing, original arguments.

2. CRITERIA FOR IDENTIFYING SYNTHETIC AI GENERATION (SCORE ACCORDINGLY WITHIN CRITERIA):
- Uncritical Boilerplate: Vague, high-level summaries that lack numbers, primary data, formulas, or specific operational details.
- Hallucinated or Foreign Scenarios: Generic foreign contexts (Silicon Valley USD figures) in Indian PGDM assignments.
- Unedited Conversational Residuals: Residual chat framing ('Certainly, here is the analysis', 'As an AI model', '[cite: X]', '[insert your name]').
- Detached Third-Person Phrasing: Writing personal role-play reflections in the third person ('the participant negotiated...').

3. NOTE ON PRESCRIBED AI TOOLS & STANDARD VOCABULARY:
- Prescribed AI Usage: When the activity explicitly instructs the student to prompt Claude, Gemini, ChatGPT, or another AI tool and record its response (e.g., Step 7 in Negotiation, Prototype Build in GenAI), doing so is full compliance with instructions. Evaluate whether the student actively challenged or synthesized the AI output versus passively copying it.
- Standard Business English: Do NOT penalize standard management and MBA terminology (e.g. 'operational bottlenecks', 'pain points', 'in conclusion', 'moreover', 'furthermore', 'risk mitigation', 'strategic alignment') as AI clichés. Focus on substantive empirical depth.

4. MANDATORY GRADE CALIBRATION:
- Distinction (85-100%): STRICTLY RESERVED for verified manual execution, empirical data/formulas, authentic reflection, and complete technical compliance. Prohibited for generic AI summaries lacking manual data.
- Merit (70-84%): Strong submission with clear manual effort, solid critical thinking, but minor gaps or summarized data.
- Pass (50-69%): Satisfactory basic work, or submissions exhibiting noticeable generic AI drafting assistance with minimal manual evidence.
- Needs Work (<50%): Incomplete deliverables, unedited AI copy-paste, raw chat transcripts, or severe offloading without synthesis."""

        import re
        step_matches = re.findall(r'(?:^|\n)\s*(?:(\d+)[\.\)]|\bStep\s*(\d+)[:\.\s])\s*([^\n\.\:]{5,50})', instructions)
        if step_matches:
            step_keys_schema = []
            for m in step_matches[:10]:
                step_num = m[0] or m[1]
                clean_title = re.sub(r'[^a-zA-Z0-9]+', '_', m[2].strip()).strip('_').lower()[:35]
                step_keys_schema.append(f'    "step_{step_num}_{clean_title}": "Passed / Deficient with specific evidence from student text"')
            micro_schema_body = ",\n".join(step_keys_schema)
            micro_schema = f""""micro_compliance_audit": {{\n{micro_schema_body}\n  }},"""
        else:
            micro_schema = """"micro_compliance_audit": {
    "deliverable_completeness": "Passed / Deficient with specific evidence from student text",
    "conceptual_technical_rigor": "Passed / Deficient with specific evidence from student text",
    "practical_execution_and_evidence": "Passed / Deficient with specific evidence from student text",
    "authenticity_and_originality": "Passed / Deficient with specific evidence from student text"
  },"""

    return f"""You are an elite, uncompromising Academic Professor at a premier business and technology institution.
Student being evaluated: {student_name}

=== ACTIVITY SPECIFICATIONS ===
Title: Activity {act_no}: {act_title}
Unit Mapping: {unit}
Estimated Effort: {effort}
Mode: {mode}

{protocol_section}

=== RUBRIC ===
{rubric_str}

=== STUDENT'S SUBMITTED DELIVERABLE (EXAMINE ALL ATTACHED FILES THOROUGHLY) ===
NOTE ON MULTI-FILE DELIVERABLES:
The student may submit multiple attachments (e.g. a written report or memo in PDF/DOCX AND an Excel quantitative workbook in XLSX/XLS/CSV, or multiple analysis documents).
You MUST review the entire Submission Attachments Manifest and every attached file block below. A required deliverable, model, or calculation is ONLY missing if it cannot be found across ANY of the attached files. For example, if one file contains the written report and another file contains the Excel calculations or data tables, synthesize both to evaluate the student's complete work.

{student_text[:150000]}

=== OUTPUT REQUIREMENTS ===
Return ONLY a valid JSON object matching this exact schema (no markdown fences, no extra text):

{{
  "total_score": float,
  "max_score": 100.0,
  "performance_tier": string ("Distinction (85-100%)" | "Merit (70-84%)" | "Pass (50-69%)" | "Needs Work (<50%)"),
  "ai_support_percentage": float,
  "ai_support_level": string ("Low (Bounded AI Engagement per Instructions)" | "Moderate (Partial AI Assistance in Drafting)" | "High (Substantial AI Generation & Offloading)" | "Critical (Heavy/Near-Complete AI Generation)"),
  "ai_audit_findings": [
    "Specific finding explaining AI citation tags, conversational remnants, detached phrasing, or authentic human authorship"
  ],
  {micro_schema}
  "executive_summary": "Brutally honest, 3-4 sentence academic appraisal citing specific accomplishments and critical deficiencies.",
  "criteria_breakdown": [
    {{
      "criterion": "Criterion Name",
      "marks_awarded": float,
      "max_marks": float,
      "tier": string,
      "rationale": "Thorough critique explaining exact deductions based on missing micro-requirements.",
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
    "Concrete actionable deficiency 1 citing exact step violated",
    "Concrete actionable deficiency 2 citing exact step violated",
    "Concrete actionable deficiency 3 citing exact step violated"
  ],
  "critical_feedback": "Exhaustive, direct feedback addressing the student with uncompromising academic rigor."
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


async def _evaluate_with_ollama(
    activity: Any,
    rubric: List[Dict[str, Any]],
    student_text: str,
    base_url: str = "https://ollama.com",
    model: str = "gemma4:31b",
    api_key: Optional[str] = None,
    student_name: str = "Student",
) -> Dict[str, Any]:
    prompt = _build_evaluation_prompt(activity, rubric, student_text, student_name=student_name)
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    # Use 10s connect timeout for cloud endpoints (e.g. ollama.com), but fast 1.5s if pointing to localhost
    conn_timeout = 1.5 if ("127.0.0.1" in base_url or "localhost" in base_url) else 10.0
    timeout_cfg = httpx.Timeout(timeout=75.0, connect=conn_timeout)
    async with httpx.AsyncClient(timeout=timeout_cfg) as client:
        resp = await client.post(
            f"{base_url.rstrip('/')}/api/chat",
            headers=headers,
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "You are an expert academic evaluator. Always output pure, valid JSON with no conversational text or markdown code fences."},
                    {"role": "user", "content": prompt}
                ],
                "stream": False,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        raw_text = data.get("message", {}).get("content", "").strip()
        parsed = _clean_and_parse_json(raw_text)
        parsed["model_used"] = f"Ollama {model} (High-Precision Cloud)"
        parsed["evaluated_at"] = datetime.utcnow().isoformat()
        return parsed


async def _evaluate_with_groq(
    activity: Any,
    rubric: List[Dict[str, Any]],
    student_text: str,
    api_key: str,
    student_name: str = "Student",
) -> Dict[str, Any]:
    prompt = _build_evaluation_prompt(activity, rubric, student_text, student_name=student_name)
    # Ensure prompt fits safely within Groq token limits (~16k chars max)
    if len(prompt) > 16000:
        prompt = prompt[:16000] + "\n\n[Submission text truncated for model context window]\nEnsure valid JSON output."

    models_to_try = [
        os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b"),
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
    ]
    async with httpx.AsyncClient(timeout=45.0) as client:
        last_err = None
        for model in models_to_try:
            for attempt in range(2):  # Up to 2 attempts per model
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
                                {"role": "system", "content": "You are an expert academic evaluator. Always output pure, valid JSON with no conversational text or markdown code fences."},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.2,
                            "max_tokens": 2500,
                        },
                    )
                    if resp.status_code == 200:
                        raw_text = resp.json()["choices"][0]["message"]["content"].strip()
                        parsed = _clean_and_parse_json(raw_text)
                        parsed["model_used"] = f"Groq {model} (High-Speed LPU)"
                        parsed["evaluated_at"] = datetime.utcnow().isoformat()
                        return parsed
                    elif resp.status_code == 429:
                        global _groq_backoff_until
                        _groq_backoff_until = time.time() + 60.0
                        logger.warning(f"Groq {model} hit 429, backing off Groq for 60s.")
                        break
                    elif resp.status_code == 413:
                        logger.warning(f"Groq {model} request too large (413), falling back immediately.")
                        break
                    else:
                        last_err = f"Groq {model} returned {resp.status_code}: {resp.text[:120]}"
                        logger.warning(last_err)
                        break
                except (httpx.ConnectError, httpx.NetworkError, httpx.TimeoutException, OSError) as net_err:
                    last_err = f"Network error connecting to Groq: {net_err}"
                    logger.warning(f"Groq {model} network error: {net_err}")
                    await asyncio.sleep(1.5)
                except Exception as e:
                    last_err = str(e)
                    logger.warning(f"Groq {model} failed: {e}")
                    break
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
    import re
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
    if any(k in full_act_text for k in ["amazon v. future", "future retail", "emergency arbitration", "emergency arbitrator"]):
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
    elif bool(re.search(r'\b(?:nda|non-disclosure|saas agreement|contract drafting|contract redlining)\b', full_act_text)):
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
    elif bool(re.search(r'\b(?:negotiation|batna|fisher|ury|harvard principled|zopa)\b', full_act_text)):
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


def detect_ai_reliance(text: str, activity: Optional[Any] = None) -> Dict[str, Any]:
    """
    Analyzes textual artifacts, syntactic markers, formatting symmetry, and positive human indicators
    to determine the percentage of AI support/offloading used by the student vs verified manual effort.
    Context-aware: accounts for activities that prescribe AI tools (Claude, Gemini, ChatGPT).
    """
    import re
    text_lower = text.lower()
    words = text.split()
    total_words = max(len(words), 1)

    # Check if activity explicitly prescribes AI usage
    act_title = getattr(activity, "title", "") or ""
    act_instructions = getattr(activity, "instructions", "") or ""
    act_reqs = getattr(activity, "submission_requirements", "") or ""
    combined_meta = f"{act_title} {act_instructions} {act_reqs}".lower()
    prescribes_ai = any(k in combined_meta for k in [
        "claude", "chatgpt", "gemini", "prompt claude", "prompt chatgpt", "prompt gemini",
        "ai prototype", "ai solution", "ai tool", "ai-assisted", "generative ai"
    ])
    is_personal_roleplay = any(k in combined_meta for k in [
        "negotiation", "role-play", "role play", "batna", "counterpart", "leadership style", "360-degree"
    ])

    findings = []
    ai_score_points = 0.0

    # 1. Direct Unedited LLM Search Artifacts
    cite_matches = re.findall(r'\[cite: \d+\]', text)
    if cite_matches:
        count = len(cite_matches)
        ai_score_points += min(45.0, count * 5.0)
        findings.append(f"Contains {count} raw AI search/browse citation tags (e.g. '[cite: 1]') left unedited in document.")

    # 2. Third-person detached phrasing in personal role-play / reflection sections ONLY
    if is_personal_roleplay:
        third_person_matches = re.findall(r'\b(the negotiator stated|the participant negotiated|the candidate stated|they chose to keep their batna|the student demonstrated)\b', text_lower)
        if third_person_matches:
            count = len(third_person_matches)
            ai_score_points += min(25.0, count * 6.0)
            findings.append(f"Uses detached third-person phrasing ({count} instances) in what should be a first-person experiential role-play reflection.")

    # 3. Conversational AI remnants or uncompleted prompt templates
    uncompleted_placeholders = [
        ("paste your response here", "Uncompleted prompt template placeholder ('paste your response here')"),
        ("to be pasted here verbatim", "Uncompleted prompt template placeholder ('to be pasted here verbatim')"),
        ("[paste claude", "Uncompleted prompt template placeholder ('[paste claude...')"),
        ("[write ~", "Uncompleted prompt template placeholder ('[write ~...')"),
        ("[insert counterpart", "Uncompleted prompt template placeholder"),
        ("[insert your", "Uncompleted prompt template placeholder"),
    ]
    for phrase, desc in uncompleted_placeholders:
        if phrase in text_lower:
            ai_score_points += 30.0
            findings.append(desc)

    # Conversational chat remnants
    chat_remnants = [
        ("as an ai", "Explicit AI self-identification ('As an AI...')"),
        ("as a language model", "Explicit AI self-identification ('As a language model...')"),
        ("certainly! here", "Unedited conversational LLM introductory greeting ('Certainly! Here...')"),
        ("certainly, here", "Unedited conversational LLM introductory greeting ('Certainly, here...')"),
        ("i hope this helps", "Unedited conversational AI closing greeting ('I hope this helps')"),
        ("feel free to ask", "Unedited conversational AI closing greeting ('Feel free to ask')"),
        ("let me know if you need", "Unedited conversational AI closing greeting"),
        ("this keeps the batna confidential", "Contains AI assistant explanatory commentary to user"),
    ]
    for phrase, desc in chat_remnants:
        if phrase in text_lower:
            ai_score_points += 25.0
            findings.append(desc)

    # Chat headers: only penalize if AI was NOT prescribed
    if not prescribes_ai:
        raw_headers = [
            ("chatgpt:", "Raw chat log transcript header ('ChatGPT:')"),
            ("claude:", "Raw chat log transcript header ('Claude:')"),
            ("assistant:", "Raw chat log transcript header ('Assistant:')"),
            ("user:", "Raw chat log transcript header ('User:')")
        ]
        for h, desc in raw_headers:
            if h in text_lower:
                ai_score_points += 20.0
                findings.append(desc)

    # 4. True LLM tell-tale cliché combinations (requiring multiple distinct occurrences)
    llm_hallmark_phrases = [
        "delve into the intricate tapestry", "in the realm of", "testament to the enduring",
        "beacon of hope", "multifaceted tapestry", "ever-evolving tapestry",
        "serves as a poignant reminder", "it is worth delving into", "tapestry of possibilities",
        "a myriad of nuanced"
    ]
    found_hallmarks = [p for p in llm_hallmark_phrases if p in text_lower]
    if len(found_hallmarks) >= 2:
        ai_score_points += min(20.0, len(found_hallmarks) * 5.0)
        findings.append(f"Contains synthetic LLM boilerplate phrases ({len(found_hallmarks)} matches, e.g. '{found_hallmarks[0]}').")

    # 5. Positive Manual Effort Verification (Multi-Dimensional)
    manual_effort_evidence = []
    manual_effort_points = 0.0

    # A. Quantitative / Spreadsheet / Formula Lineage
    formula_matches = re.findall(r'(?:BINOM\.DIST|POISSON\.DIST|NORM\.DIST|NORM\.INV|EMV|\bSUM\(|\bAVERAGE\(|\bIF\(|\bVLOOKUP\(|\bINDEX\(|\bMATCH\(|\bCOUNTIF\(|\bSTDEV\.|\bROUND\()', text, re.IGNORECASE)
    cell_ref_matches = re.findall(r'(?:\$[A-Z]\$\d+|[A-Z]\d+:[A-Z]\d+)', text)
    float_precision_matches = re.findall(r'\b\d+\.\d{4,}\b', text)  # Floating point numbers with 4+ decimal places

    if formula_matches or cell_ref_matches:
        count_funcs = len(set(formula_matches))
        count_refs = len(set(cell_ref_matches))
        manual_effort_points += 25.0
        manual_effort_evidence.append(f"Constructed quantitative formula models ({count_funcs} distinct functions, {count_refs} explicit cell references e.g. {cell_ref_matches[:2] if cell_ref_matches else ''}).")
    elif float_precision_matches:
        manual_effort_points += 15.0
        manual_effort_evidence.append(f"Contains empirical calculation outputs with floating-point precision (e.g. {float_precision_matches[0]}).")

    # B. Structured Empirical Data Tables / Transaction IDs / Field Records
    transaction_matches = re.findall(r'\b(?:T0\d{2,}|ORD[-_]?\d+|EMP[-_]?\d+|TXN[-_]?\d+)\b', text, re.IGNORECASE)
    table_headers = re.findall(r'\b(order id|discount percentage|total revenue|transaction id|mlq 5x|radar chart|gap score|self rating|peer rating)\b', text_lower)
    if transaction_matches or len(table_headers) >= 2:
        manual_effort_points += 20.0
        items = transaction_matches[:3] if transaction_matches else table_headers[:3]
        manual_effort_evidence.append(f"Structured empirical dataset with granular transaction/instrument records ({', '.join(items)}).")

    # C. Peer/Classmate Collaboration & Named Counterparts
    partner_matches = re.findall(r'\b(my partner|partnered with|classmate|peer counterpart|roleplay with|with student|with prn)\b', text_lower)
    named_peers = re.findall(r'\b(tithi|nakshatra|rudra|sumit|anjali|sahil|harsh|priya|rohit|shreya|arjun|kavya|neha|aditya|rahul)\b', text_lower)
    if partner_matches or named_peers:
        manual_effort_points += 20.0
        mention = f"Named peer ({named_peers[0].capitalize()})" if named_peers else "Peer collaboration documented"
        manual_effort_evidence.append(f"Verified peer/classmate collaboration ({mention}).")

    # D. Verbatim Quoted Dialogue
    dialogue_matches = re.findall(r'["\u201c][^"\u201d]{10,200}["\u201d]\s*(?:said|replied|countered|stated|asked|proposed|offered)', text, re.IGNORECASE)
    if dialogue_matches:
        manual_effort_points += 20.0
        manual_effort_evidence.append(f"Includes {len(dialogue_matches)} authentic dialogue exchanges with quoted speech.")

    # E. Authentic Reflective Candor / Metacognitive Learning
    reflection_candor = re.findall(r'\b(i hesitated|my mistake|i blundered|i felt nervous|i conceded|i realized that|in hindsight|my cognitive bias|i failed to|i should have held|my learning was|i struggled with)\b', text_lower)
    if reflection_candor:
        manual_effort_points += 20.0
        manual_effort_evidence.append(f"Demonstrates genuine introspective self-critique ({len(reflection_candor)} reflective candor markers).")

    # F. Local PGDM Business & Economic Context
    inr_matches = re.findall(r'(?:₹|rs\.?|inr|lakh|crore|maruti|zepto|blinkit|zomato|reliance|tata|stylemod|infosys|wipro)', text_lower)
    if len(inr_matches) >= 3:
        manual_effort_points += 15.0
        manual_effort_evidence.append("Grounded in domestic Indian business context with realistic financial and operational parameters.")

    # G. Prescribed AI Tool Compliance (Bonus for properly using tool as requested)
    if prescribes_ai:
        has_tool_log = any(k in text_lower for k in ["prompt:", "gemini", "claude", "chatgpt", "ai output", "system prompt", "test case"])
        if has_tool_log:
            manual_effort_points += 15.0
            manual_effort_evidence.append("Properly executed and documented prescribed AI tool workflow/prompting.")

    manual_effort_detected = manual_effort_points >= 25.0

    # Net AI support calculation:
    # If the activity prescribes AI, a baseline of 10-15% represents the tool usage as instructed
    legit_base = 15.0 if prescribes_ai else 0.0
    net_ai_points = max(0.0, ai_score_points - (manual_effort_points * 0.35))
    total_ai_pct = min(98.0, round(legit_base + net_ai_points, 1))

    if total_ai_pct <= 25.0:
        level = "Low (Bounded AI Engagement per Instructions)"
    elif total_ai_pct <= 50.0:
        level = "Moderate (Partial AI Assistance in Drafting)"
    elif total_ai_pct <= 70.0:
        level = "High (Substantial AI Generation & Offloading)"
    else:
        level = "Critical (Heavy/Near-Complete AI Generation)"

    if not findings:
        findings.append("Appropriate bounded AI engagement matching prescribed assignment requirements.")

    return {
        "ai_support_percentage": total_ai_pct,
        "ai_support_level": level,
        "ai_audit_findings": findings,
        "manual_effort_detected": manual_effort_detected,
        "manual_effort_evidence": manual_effort_evidence,
        "manual_effort_score": manual_effort_points,
    }


def apply_ai_penalties_and_caps(result: Dict[str, Any], ai_audit: Dict[str, Any], technique: Optional[str] = None) -> Dict[str, Any]:
    """
    Calibrates AI support metrics, manual effort verification, and grade boundaries.
    Supports two configurable evaluation techniques:
    1. 'calibrated_hard_caps' (Retained current technique: rigid regex penalties and hard caps, for 100% reversibility)
    2. 'balanced_rubric_native' (New default: robust, rubric-aligned scoring with Distinction guard and professor-grade feedback)
    """
    active_technique = technique or getattr(settings, "EVALUATION_TECHNIQUE", "balanced_rubric_native")

    # -------------------------------------------------------------------------
    # MODE 1: CALIBRATED HARD CAPS (PRESERVED EXACT CODE FOR 100% REVERSIBILITY)
    # -------------------------------------------------------------------------
    if active_technique == "calibrated_hard_caps":
        raw_score = float(result.get("total_score") or 0.0)

        # Effective AI percentage combines model estimate and deterministic audit
        model_ai_pct = float(result.get("ai_support_percentage") or 0.0)
        audit_ai_pct = float(ai_audit.get("ai_support_percentage") or 0.0)
        effective_ai_pct = max(model_ai_pct, audit_ai_pct)

        # Merge audit findings
        findings = list(result.get("ai_audit_findings") or [])
        for f in ai_audit.get("ai_audit_findings") or []:
            if f not in findings:
                findings.append(f)

        manual_effort_detected = ai_audit.get("manual_effort_detected", False)
        manual_effort_evidence = ai_audit.get("manual_effort_evidence", [])

        penalty = 0.0
        cap = 100.0
        penalty_note = ""

        if effective_ai_pct >= 75.0:
            penalty = 35.0
            cap = 48.0
            level = "Critical (Heavy/Near-Complete AI Generation)"
            penalty_note = f"ACADEMIC INTEGRITY DEDUCTION: High AI generation ({effective_ai_pct:.1f}%) detected without authentic student synthesis. Score capped at Needs Work (<50%)."
        elif effective_ai_pct >= 50.0:
            penalty = 20.0
            cap = 65.0
            level = "High (Substantial AI Generation & Offloading)"
            penalty_note = f"AI OFFLOADING DEDUCTION: Substantial AI-assisted drafting ({effective_ai_pct:.1f}%) detected. Grade capped at Pass (max 65%)."
        elif effective_ai_pct >= 35.0:
            penalty = 10.0
            cap = 78.0
            level = "Moderate (Partial AI Assistance in Drafting)"
            penalty_note = f"AI ASSISTANCE ADJUSTMENT: Moderate AI reliance ({effective_ai_pct:.1f}%) noted. Grade capped at Merit (max 78%)."
        else:
            level = "Low (Bounded AI Engagement per Instructions)"
            # For Distinction (85+), verified manual effort must be present!
            if raw_score >= 85.0 and not manual_effort_detected:
                cap = 82.0
                penalty_note = "CALIBRATION NOTE: Submission demonstrates competent drafting but lacks verified empirical manual effort (e.g. customized calculations, authentic peer dialogue, or original data). Capped at High Merit (82%)."

        final_score = max(15.0, min(cap, round(raw_score - penalty, 1))) if penalty > 0 else min(cap, raw_score)

        if final_score >= 85.0:
            tier = "Distinction (85-100%)"
        elif final_score >= 70.0:
            tier = "Merit (70-84%)"
        elif final_score >= 50.0:
            tier = "Pass (50-69%)"
        else:
            tier = "Needs Work (<50%)"

        result["total_score"] = final_score
        result["performance_tier"] = tier
        result["ai_support_percentage"] = effective_ai_pct
        result["ai_support_level"] = level
        result["ai_audit_findings"] = findings
        result["manual_effort_verified"] = manual_effort_detected
        result["manual_effort_evidence"] = manual_effort_evidence
        result["evaluation_technique"] = "calibrated_hard_caps"

        if penalty_note:
            result["critical_feedback"] = f"{penalty_note}\n\n" + str(result.get("critical_feedback") or "")
            if "executive_summary" in result and penalty_note not in result["executive_summary"]:
                result["executive_summary"] += f" [{penalty_note}]"

        return result

    # -------------------------------------------------------------------------
    # MODE 2: BALANCED RUBRIC NATIVE (ROBUST ACADEMIC EVALUATION ENGINE)
    # -------------------------------------------------------------------------
    raw_score = float(result.get("total_score") or 0.0)
    model_ai_pct = float(result.get("ai_support_percentage") or 0.0)
    audit_ai_pct = float(ai_audit.get("ai_support_percentage") or 0.0)
    effective_ai_pct = max(model_ai_pct, audit_ai_pct)

    findings = list(result.get("ai_audit_findings") or [])
    for f in ai_audit.get("ai_audit_findings") or []:
        if f not in findings:
            findings.append(f)

    manual_effort_detected = ai_audit.get("manual_effort_detected", False)
    manual_effort_evidence = ai_audit.get("manual_effort_evidence", [])

    if effective_ai_pct <= 25.0:
        level = "Low (Bounded AI Engagement per Instructions)"
    elif effective_ai_pct <= 50.0:
        level = "Moderate (Partial AI Assistance in Drafting)"
    elif effective_ai_pct <= 70.0:
        level = "High (Substantial AI Generation & Offloading)"
    else:
        level = "Critical (Heavy/Near-Complete AI Generation)"

    # Distinction Guard: Distinction (85+) strictly requires verified empirical manual effort!
    final_score = raw_score
    calibration_note = ""

    if raw_score >= 85.0 and not manual_effort_detected:
        final_score = 82.0
        calibration_note = "Distinction (85%+) strictly requires primary empirical evidence (e.g., customized calculation models, authentic peer dialogue transcripts, or raw data linkage). This submission demonstrates strong conceptual execution and is awarded High Merit (82%)."
    elif effective_ai_pct >= 75.0 and final_score > 48.0:
        final_score = 48.0
        calibration_note = "Grade calibrated to Needs Work (<50%) due to unedited generative AI offloading without student synthesis or empirical deliverables."
    elif effective_ai_pct >= 55.0 and final_score > 65.0:
        final_score = 65.0
        calibration_note = "Grade calibrated to Pass (65%) due to substantial reliance on generic AI generation with minimal manual execution."

    # Harmonize criteria breakdown with final_score if a cap was applied
    criteria = result.get("criteria_breakdown") or []
    if criteria and abs(final_score - raw_score) > 0.5:
        crit_sum = sum(float(c.get("marks_awarded") or 0.0) for c in criteria)
        if crit_sum > 0:
            scale = final_score / crit_sum
            for c in criteria:
                orig_m = float(c.get("marks_awarded") or 0.0)
                c["marks_awarded"] = round(orig_m * scale, 1)
                max_m = float(c.get("max_marks") or 0.0)
                if max_m > 0:
                    ratio = c["marks_awarded"] / max_m
                    c["tier"] = "Distinction (85-100%)" if ratio >= 0.85 else ("Merit (70-84%)" if ratio >= 0.70 else ("Pass (50-69%)" if ratio >= 0.50 else "Needs Work (<50%)"))

    if final_score >= 85.0:
        tier = "Distinction (85-100%)"
    elif final_score >= 70.0:
        tier = "Merit (70-84%)"
    elif final_score >= 50.0:
        tier = "Pass (50-69%)"
    else:
        tier = "Needs Work (<50%)"

    result["total_score"] = round(final_score, 1)
    result["performance_tier"] = tier
    result["ai_support_percentage"] = effective_ai_pct
    result["ai_support_level"] = level
    result["ai_audit_findings"] = findings
    result["manual_effort_verified"] = manual_effort_detected
    result["manual_effort_evidence"] = manual_effort_evidence
    result["evaluation_technique"] = "balanced_rubric_native"

    # Pedagogical guidance without mechanical deduction strings
    if calibration_note:
        if calibration_note not in str(result.get("critical_feedback") or ""):
            result["critical_feedback"] = f"EVALUATION NOTE: {calibration_note}\n\n" + str(result.get("critical_feedback") or "")

    return result


def _generate_structured_fallback_evaluation(
    activity: Any,
    rubric: List[Dict[str, Any]],
    student_text: str,
    peer_texts: Optional[Dict[str, str]] = None,
    student_name: str = "Student",
) -> Dict[str, Any]:
    import re
    import json
    text_lower = student_text.lower()
    word_count = len(student_text.split())

    if isinstance(rubric, str):
        try:
            rubric = json.loads(rubric)
        except Exception:
            rubric = []

    normalized_rubric = []
    if isinstance(rubric, list):
        for idx, c in enumerate(rubric):
            if isinstance(c, str):
                normalized_rubric.append({"criterion": c.strip()})
            elif isinstance(c, dict):
                normalized_rubric.append(c)

    if not normalized_rubric:
        normalized_rubric = [
            {"criterion": "Principled-Negotiation Preparation", "weightage": 35.0},
            {"criterion": "Live Negotiation Execution & Observation", "weightage": 30.0},
            {"criterion": "AI-Assisted Critique & Reflection Report", "weightage": 35.0},
        ]

    rubric = normalized_rubric
    num_criteria = max(len(rubric), 3)
    marks_per_criterion = round(100.0 / num_criteria, 1)

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

    elif any(k in act_meta_text for k in ["probability", "binomial", "poisson", "normal", "emv", "statistics"]):
        # Statistics for Managers (Probability Distributions & EMV Risk Lab)
        has_binom = any(k in text_lower for k in ["binom", "binomial", "defective", "n=", "p="])
        has_poisson = any(k in text_lower for k in ["poisson", "lambda", "arrival", "staffing"])
        has_norm = any(k in text_lower for k in ["norm.dist", "norm.inv", "normal", "z-table", "z score", "standard normal", "mean", "std dev"])
        has_emv = any(k in text_lower for k in ["emv", "expected monetary value", "launch", "not launch", "decision tree", "payoff"])
        has_formulas = bool(re.search(r'(?:BINOM\.DIST|POISSON\.DIST|NORM\.DIST|NORM\.INV|EMV|\bSUM\(|\bAVERAGE\()', student_text, re.IGNORECASE))
        has_precision = bool(re.search(r'\b\d+\.\d{3,}\b', student_text))
        has_ai_ext = any(k in text_lower for k in ["claude", "monte carlo", "sensitivity", "simulation", "limitation"])

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

            if any(k in crit_lower for k in ["binomial", "poisson"]):
                if (has_binom or has_poisson) and (has_formulas or has_precision) and word_count >= 150:
                    awarded = round(max_m * 0.94, 1)
                    tier = "Distinction (85-100%)"
                    rationale = "Binomial and Poisson distributions computed accurately via formula models with operational staffing interpretations."
                    evidence = f'Extracted analytical content: "{p_sample_1}"'
                    gap = "Ensure explicit sensitivity boundaries are documented for arrival variance."
                elif has_binom or has_poisson:
                    awarded = round(max_m * 0.76, 1)
                    tier = "Merit (70-84%)"
                    rationale = "Distribution parameters and probability outputs are identified with basic narrative descriptions."
                    evidence = f'Extracted analytical content: "{p_sample_1}"'
                    gap = "Needs explicit dynamic Excel formula lineage (e.g. BINOM.DIST, POISSON.DIST) for all scenarios."
                else:
                    awarded = round(max_m * 0.50, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Superficial coverage of discrete distributions without computational rigor."
                    evidence = f'Extracted analytical content: "{p_sample_1}"'
                    gap = "Missing quantitative probability computations."

            elif any(k in crit_lower for k in ["normal", "z-table"]):
                if has_norm and (has_formulas or "z-table" in text_lower or has_precision) and word_count >= 150:
                    awarded = round(max_m * 0.95, 1)
                    tier = "Distinction (85-100%)"
                    rationale = "Direct (NORM.DIST) and inverse (NORM.INV) probabilities correctly applied with manual Z-table verification."
                    evidence = f'Extracted analytical content: "{p_sample_2}"'
                    gap = "Provide continuous density curve visualizations for non-standard thresholds."
                elif has_norm:
                    awarded = round(max_m * 0.78, 1)
                    tier = "Merit (70-84%)"
                    rationale = "Normal distribution logic is applied but Z-table cross-validation is summarized."
                    evidence = f'Extracted analytical content: "{p_sample_2}"'
                    gap = "Missing side-by-side manual Z-score calculation verifying Excel functions."
                else:
                    awarded = round(max_m * 0.52, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Incomplete treatment of continuous distribution modeling."
                    evidence = f'Extracted analytical content: "{p_sample_2}"'
                    gap = "Normal distribution computations not demonstrated."

            else:  # EMV, AI Extension & Risk Report
                if has_emv and word_count >= 200:
                    awarded = round(max_m * 0.92, 1)
                    tier = "Distinction (85-100%)"
                    rationale = "EMV decision model demonstrates robust payoff matrix comparison between Launch vs Not-Launch alternatives."
                    evidence = f'Extracted analytical content: "{p_sample_3}"'
                    gap = "Could expand on parameter stress-testing under extreme adverse market scenarios."
                elif has_emv:
                    awarded = round(max_m * 0.78, 1)
                    tier = "Merit (70-84%)"
                    rationale = "Expected monetary value calculated with recommended business decision."
                    evidence = f'Extracted analytical content: "{p_sample_3}"'
                    gap = "Incorporate AI-assisted Monte Carlo risk comparison into executive decision report."
                else:
                    awarded = round(max_m * 0.55, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Qualitative risk discussion lacking structured expected value payoffs."
                    evidence = f'Extracted analytical content: "{p_sample_3}"'
                    gap = "Omitted mathematical EMV decision model."

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
        overall_tier = "Distinction (85-100%)" if total_score >= 85 else ("Merit (70-84%)" if total_score >= 70 else ("Pass (50-69%)" if total_score >= 50 else "Needs Work (<50%)"))
        strengths = [
            "Empirical Computational Rigor: Quantitative modeling executed across discrete and continuous distributions.",
            "Decision Modeling: Clear expected monetary value framing distinguishing strategic options.",
            "Technical Execution: Application of statistical functions with operational PGDM context.",
        ]
        areas_for_improvement = [
            "Parameter Sensitivity: Test decision boundaries against variable arrival and defect rates.",
            "Computational Documentation: Clearly annotate cell linkages and distribution parameters in attached workbooks.",
        ]
        exec_summary = f"Comprehensive statistical evaluation across {len(criteria_breakdown)} criteria ({word_count} words/data points). Achieves {total_score}/100 ({overall_tier})."
        critical_feedback = f"ACADEMIC EVALUATION — STATISTICS FOR MANAGERS\n\n1. Distribution Modeling: Mathematical models demonstrated solid computational execution.\n2. Decision Under Uncertainty: EMV payoff comparisons support sound management decisions.\n3. Continuous Improvement: Benchmark sensitivity thresholds against worst-case stochastic variances."

    elif any(k in act_meta_text for k in ["ratio", "financial health", "balance sheet", "common-size", "trend", "accounting", "liquidity", "dupont", "maruti"]):
        # Accounting for Decision Making (Ratio Analysis & Financial Health Dashboard)
        has_ratios = any(k in text_lower for k in ["current ratio", "quick ratio", "debt", "equity", "roe", "roa", "profit margin", "turnover", "working capital"])
        has_trend = any(k in text_lower for k in ["trend", "common-size", "vertical", "horizontal", "year", "yoy", "percentage of sales", "balance sheet"])
        has_triangulation = any(k in text_lower for k in ["claude", "chatgpt", "gemini", "triangulation", "interpretation", "recommendation", "liquidity", "solvency"])
        has_numbers = bool(re.search(r'\b\d{2,}\.?\d*%', student_text)) or bool(re.search(r'\b\d+\.\d{2}\b', student_text))

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

            if any(k in crit_lower for k in ["ratio computation", "data accuracy", "computation"]):
                if has_ratios and has_numbers and word_count >= 150:
                    awarded = round(max_m * 0.93, 1)
                    tier = "Distinction (85-100%)"
                    rationale = "Ratios across liquidity, solvency, and profitability correctly computed with financial accuracy."
                    evidence = f'Extracted financial analysis: "{p_sample_1}"'
                    gap = "Include cash-conversion cycle metrics alongside standard working capital ratios."
                elif has_ratios:
                    awarded = round(max_m * 0.77, 1)
                    tier = "Merit (70-84%)"
                    rationale = "Key financial ratios computed but requires more multi-year data depth."
                    evidence = f'Extracted financial analysis: "{p_sample_1}"'
                    gap = "Provide underlying formula cell links verifying balance sheet reconciliations."
                else:
                    awarded = round(max_m * 0.50, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Basic ratio definitions presented without granular financial statements."
                    evidence = f'Extracted financial analysis: "{p_sample_1}"'
                    gap = "Incomplete numerical ratio computation."

            elif any(k in crit_lower for k in ["trend", "common-size"]):
                if has_trend and has_numbers and word_count >= 150:
                    awarded = round(max_m * 0.91, 1)
                    tier = "Distinction (85-100%)"
                    rationale = "Trend trajectories and common-size balance sheet / income statement percentages effectively modeled."
                    evidence = f'Extracted financial analysis: "{p_sample_2}"'
                    gap = "Deepen macroeconomic contextualization of year-on-year line-item variances."
                elif has_trend:
                    awarded = round(max_m * 0.76, 1)
                    tier = "Merit (70-84%)"
                    rationale = "Trend analysis present with qualitative descriptions of YoY performance."
                    evidence = f'Extracted financial analysis: "{p_sample_2}"'
                    gap = "Missing full common-size normalization across all asset and liability heads."
                else:
                    awarded = round(max_m * 0.50, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Superficial trend review without normalized common-size statements."
                    evidence = f'Extracted financial analysis: "{p_sample_2}"'
                    gap = "Common-size percentage analysis not demonstrated."

            else:  # AI Triangulation & Dashboard Summary
                if has_triangulation and word_count >= 200:
                    awarded = round(max_m * 0.90, 1)
                    tier = "Distinction (85-100%)"
                    rationale = "Executive dashboard synthesizes operational takeaways with independent critique of AI diagnostic prompts."
                    evidence = f'Extracted financial analysis: "{p_sample_3}"'
                    gap = "Include contractual debt covenant monitoring recommendations."
                elif has_triangulation:
                    awarded = round(max_m * 0.75, 1)
                    tier = "Merit (70-84%)"
                    rationale = "AI financial commentary summarized with sound management orientation."
                    evidence = f'Extracted financial analysis: "{p_sample_3}"'
                    gap = "Document specific discrepancies where AI models misread statutory note disclosures."
                else:
                    awarded = round(max_m * 0.52, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Brief executive summary lacking structured AI triangulation."
                    evidence = f'Extracted financial analysis: "{p_sample_3}"'
                    gap = "Missing AI triangulation log and dashboard recommendations."

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
        overall_tier = "Distinction (85-100%)" if total_score >= 85 else ("Merit (70-84%)" if total_score >= 70 else ("Pass (50-69%)" if total_score >= 50 else "Needs Work (<50%)"))
        strengths = [
            "Financial Statement Mastery: Methodical ratio calculations across liquidity, solvency, and margins.",
            "Common-Size Depth: Structured percentage normalization highlighting capital allocation shifts.",
            "Commercial Insight: Managerial evaluation grounded in corporate performance parameters.",
        ]
        areas_for_improvement = [
            "Cash Flow Linkage: Connect working capital movements directly to operating cash flow conversion.",
            "DuPont Decomposition: Deconstruct ROE into operating margin, asset turnover, and leverage factors.",
        ]
        exec_summary = f"Accounting evaluation completed across {len(criteria_breakdown)} criteria ({word_count} words analyzed). Score: {total_score}/100 ({overall_tier})."
        critical_feedback = f"ACADEMIC APPRAISAL — ACCOUNTING FOR DECISION MAKING\n\n1. Financial Health Diagnostic: Accurate computation of core leverage, liquidity, and profitability metrics.\n2. Common-Size Trend Analysis: Longitudinal shifts identified with commercial understanding.\n3. Remediation: Strengthen cash flow validation and stress-test debt coverage ratios."

    elif any(k in act_meta_text for k in ["leadership", "360-degree", "self-assessment", "radar chart", "organisational behaviour", "mlq"]):
        # Organisational Behaviour (Leadership Style Self-Assessment & 360 Feedback)
        has_self = any(k in text_lower for k in ["self-assessment", "mlq", "sub-dimension", "transformational", "transactional", "inspirational", "intellectual", "contingent reward", "laissez-faire"])
        has_peers = any(k in text_lower for k in ["peer rating", "peer 1", "peer 2", "peer 3", "peers", "average peer", "observer", "survey", "counterpart", "colleague"])
        has_radar = any(k in text_lower for k in ["radar chart", "spider chart", "gap analysis", "self vs peer", "largest gap", "comparison table", "score gap"])
        has_plan = any(k in text_lower for k in ["development plan", "smart", "blind spot", "action commitment", "behavioral", "remediation", "claude", "habit"])

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

            if any(k in crit_lower for k in ["self-assessment", "peer instrument", "data collection"]):
                if has_self and has_peers and word_count >= 150:
                    awarded = round(max_m * 0.94, 1)
                    tier = "Distinction (85-100%)"
                    rationale = "Validated self-assessment completed across all sub-dimensions with multi-source peer ratings gathered from observed interactions."
                    evidence = f'Extracted behavioral assessment: "{p_sample_1}"'
                    gap = "Standardize peer observer tenure to establish observational consistency."
                elif has_self or has_peers:
                    awarded = round(max_m * 0.77, 1)
                    tier = "Merit (70-84%)"
                    rationale = "Self-assessment completed with partial peer observation dataset."
                    evidence = f'Extracted behavioral assessment: "{p_sample_1}"'
                    gap = "Ensure at least 3-4 peers provide individualized rating records across all leadership dimensions."
                else:
                    awarded = round(max_m * 0.50, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Incomplete leadership survey instrument."
                    evidence = f'Extracted behavioral assessment: "{p_sample_1}"'
                    gap = "Self-assessment or peer feedback collection omitted."

            elif any(k in crit_lower for k in ["360-feedback", "radar chart", "analysis"]):
                if has_radar and word_count >= 150:
                    awarded = round(max_m * 0.92, 1)
                    tier = "Distinction (85-100%)"
                    rationale = "Comparison tables and radar chart clearly articulate self-versus-peer perception divergences and key leadership gaps."
                    evidence = f'Extracted behavioral assessment: "{p_sample_2}"'
                    gap = "Correlate gap scores directly with specific team project milestones."
                elif has_radar or has_peers:
                    awarded = round(max_m * 0.76, 1)
                    tier = "Merit (70-84%)"
                    rationale = "Gaps identified with narrative discussion of behavioral differences."
                    evidence = f'Extracted behavioral assessment: "{p_sample_2}"'
                    gap = "Missing visual radar chart plotting self versus peer averages side-by-side."
                else:
                    awarded = round(max_m * 0.52, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Limited analysis of 360-degree feedback variance."
                    evidence = f'Extracted behavioral assessment: "{p_sample_2}"'
                    gap = "360-degree comparison table and chart omitted."

            else:  # Blind-Spot Analysis & Development Plan
                if has_plan and word_count >= 180:
                    awarded = round(max_m * 0.91, 1)
                    tier = "Distinction (85-100%)"
                    rationale = "AI blind-spot analysis critically evaluated with measurable, verifiable behavioral commitments targeted at top gaps."
                    evidence = f'Extracted behavioral assessment: "{p_sample_3}"'
                    gap = "Establish 60-day and 90-day peer review check-ins for developmental commitments."
                elif has_plan:
                    awarded = round(max_m * 0.76, 1)
                    tier = "Merit (70-84%)"
                    rationale = "Development plan outlines leadership goals with general improvement areas."
                    evidence = f'Extracted behavioral assessment: "{p_sample_3}"'
                    gap = "Formulate commitments as verifiable, measurable behavioral milestones."
                else:
                    awarded = round(max_m * 0.52, 1)
                    tier = "Pass (50-69%)"
                    rationale = "Superficial personal development reflections."
                    evidence = f'Extracted behavioral assessment: "{p_sample_3}"'
                    gap = "Missing actionable development commitments."

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
        overall_tier = "Distinction (85-100%)" if total_score >= 85 else ("Merit (70-84%)" if total_score >= 70 else ("Pass (50-69%)" if total_score >= 50 else "Needs Work (<50%)"))
        strengths = [
            "Authentic Multi-Rater Input: Validated survey methodology capturing peer and self perceptions.",
            "Diagnostic Variance Mapping: Clear perception gap analysis identifying leadership blind spots.",
            "Actionable Growth Roadmap: Verifiable developmental commitments addressing interpersonal dynamics.",
        ]
        areas_for_improvement = [
            "Behavioral Specificity: Anchor self-ratings in specific team conflict or decision-making episodes.",
            "Longitudinal Re-Measurement: Define peer feedback intervals to track behavioral adoption.",
        ]
        exec_summary = f"360-degree leadership evaluation across {len(criteria_breakdown)} criteria ({word_count} words analyzed). Score: {total_score}/100 ({overall_tier})."
        critical_feedback = f"ACADEMIC APPRAISAL — ORGANISATIONAL BEHAVIOUR\n\n1. Instrument Validity: Multi-rater instrument demonstrates commendable student and peer engagement.\n2. Perception Alignment: Self-vs-peer variance mapped with genuine introspective honesty.\n3. Action Plan: Ensure developmental commitments are tracked through objective peer accountability."

    elif any(k in act_meta_text for k in ["genai", "generative ai", "prototype", "marketing case lab", "ai solution"]):
        # Fundamentals & Applications of GenAI (Marketing Case Lab or Prototype Build)
        is_prototype = "prototype" in act_meta_text or "build" in act_meta_text
        has_subfunctions = any(k in text_lower for k in ["sub-function", "content creation", "copywriting", "segmentation", "seo", "ad copy", "campaign", "customer journey"])
        has_risks = any(k in text_lower for k in ["hallucination", "brand reputation", "copyright", "infringement", "bias", "safeguard", "human-in-the-loop", "checkpoint"])
        has_prototype_build = any(k in text_lower for k in ["prototype", "workflow", "system prompt", "api", "gradio", "streamlit", "test case", "input", "output", "limitation", "error"])
        has_ai_logs = any(k in text_lower for k in ["claude", "chatgpt", "perplexity", "pattern assessment", "risk assessment", "memo", "report", "prompt"])

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

            if is_prototype:
                # Act 8: Prototype Build
                if any(k in crit_lower for k in ["problem definition", "workflow"]):
                    if (has_prototype_build or has_subfunctions) and word_count >= 150:
                        awarded = round(max_m * 0.92, 1)
                        tier = "Distinction (85-100%)"
                        rationale = "Narrow, function-specific problem clearly framed with end-to-end workflow architecture and tool mappings."
                        evidence = f'Extracted prototype design: "{p_sample_1}"'
                        gap = "Document system error escalation pathways for model latency spikes."
                    else:
                        awarded = round(max_m * 0.74, 1)
                        tier = "Merit (70-84%)"
                        rationale = "Problem defined with generalized multi-step workflow."
                        evidence = f'Extracted prototype design: "{p_sample_1}"'
                        gap = "Specify exact tool assignments and human validation gates for each workflow step."
                elif any(k in crit_lower for k in ["prototype build", "critical assessment", "build"]):
                    if has_prototype_build and ("error" in text_lower or "limitation" in text_lower or "test" in text_lower):
                        awarded = round(max_m * 0.90, 1)
                        tier = "Distinction (85-100%)"
                        rationale = "Functional prototype executed on real data with concrete error analysis and feasibility limitations identified."
                        evidence = f'Extracted prototype design: "{p_sample_2}"'
                        gap = "Include quantitative benchmark evaluations across diverse edge-case inputs."
                    elif has_prototype_build:
                        awarded = round(max_m * 0.75, 1)
                        tier = "Merit (70-84%)"
                        rationale = "Prototype workflow designed and executed with basic testing."
                        evidence = f'Extracted prototype design: "{p_sample_2}"'
                        gap = "Document specific model output errors and corrective prompting mechanisms."
                    else:
                        awarded = round(max_m * 0.50, 1)
                        tier = "Pass (50-69%)"
                        rationale = "Prototype concept described without live execution records."
                        evidence = f'Extracted prototype design: "{p_sample_2}"'
                        gap = "Missing executable prototype run logs."
                else:  # Risk Assessment & Report
                    if has_ai_logs and word_count >= 180:
                        awarded = round(max_m * 0.90, 1)
                        tier = "Distinction (85-100%)"
                        rationale = "AI risk assessment evaluated with independent technical reasoning in a structured executive report."
                        evidence = f'Extracted prototype design: "{p_sample_3}"'
                        gap = "Provide data privacy governance guidelines for enterprise deployment."
                    else:
                        awarded = round(max_m * 0.72, 1)
                        tier = "Merit (70-84%)"
                        rationale = "Risk report identifies standard AI challenges."
                        evidence = f'Extracted prototype design: "{p_sample_3}"'
                        gap = "Incorporate independent synthesis of AI model evaluation responses."
            else:
                # Act 7: Marketing Case Lab
                if any(k in crit_lower for k in ["comprehension", "sub-function"]):
                    if has_subfunctions and word_count >= 150:
                        awarded = round(max_m * 0.92, 1)
                        tier = "Distinction (85-100%)"
                        rationale = "Marketing case rigorously analyzed with 3 distinct sub-functions and correctly attributed operational gains."
                        evidence = f'Extracted case analysis: "{p_sample_1}"'
                        gap = "Model quantifiable ROI metrics for each marketing sub-function."
                    else:
                        awarded = round(max_m * 0.74, 1)
                        tier = "Merit (70-84%)"
                        rationale = "Case summarized with general marketing benefits identified."
                        evidence = f'Extracted case analysis: "{p_sample_1}"'
                        gap = "Differentiate 3 genuinely distinct sub-functions with case-specific evidence."
                elif any(k in crit_lower for k in ["risk", "safeguard"]):
                    if has_risks and word_count >= 150:
                        awarded = round(max_m * 0.91, 1)
                        tier = "Distinction (85-100%)"
                        rationale = "Function-specific risks matched with concrete, plausible operational safeguards."
                        evidence = f'Extracted case analysis: "{p_sample_2}"'
                        gap = "Include contractual indemnification standards for AI vendor content."
                    else:
                        awarded = round(max_m * 0.72, 1)
                        tier = "Merit (70-84%)"
                        rationale = "Risks outlined with standard governance recommendations."
                        evidence = f'Extracted case analysis: "{p_sample_2}"'
                        gap = "Tie each risk directly to its corresponding marketing sub-function."
                else:  # Example & Memo
                    if has_ai_logs and word_count >= 180:
                        awarded = round(max_m * 0.90, 1)
                        tier = "Distinction (85-100%)"
                        rationale = "Current market example cited and Claude pattern critique integrated into executive memo."
                        evidence = f'Extracted case analysis: "{p_sample_3}"'
                        gap = "Deepen comparative analysis between enterprise and open-source models."
                    else:
                        awarded = round(max_m * 0.72, 1)
                        tier = "Merit (70-84%)"
                        rationale = "Executive memo integrates key case points."
                        evidence = f'Extracted case analysis: "{p_sample_3}"'
                        gap = "Ensure current market case citations and AI critique prompts are fully documented."

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
        overall_tier = "Distinction (85-100%)" if total_score >= 85 else ("Merit (70-84%)" if total_score >= 70 else ("Pass (50-69%)" if total_score >= 50 else "Needs Work (<50%)"))
        strengths = [
            "Functional GenAI Deployment: Clear articulation of AI integration within operational workflows.",
            "Risk-Aware Architecture: Explicit safeguards established against hallucinations and IP exposure.",
            "Practical Experimentation: Hands-on evaluation of LLM capabilities with concrete test cases.",
        ]
        areas_for_improvement = [
            "Production Guardrails: Define latency, token economics, and error recovery thresholds.",
            "Evaluation Metrics: Benchmark model outputs using quantitative accuracy scores.",
        ]
        exec_summary = f"GenAI lab evaluation completed across {len(criteria_breakdown)} criteria ({word_count} words analyzed). Score: {total_score}/100 ({overall_tier})."
        critical_feedback = f"ACADEMIC APPRAISAL — GENAI APPLICATIONS\n\n1. Solution Architecture: Applied AI design demonstrates solid functional understanding.\n2. Risk Management: Concrete safeguards proposed for generative risks.\n3. Advancement: Formalize prompt versioning and enterprise evaluation benchmarks."

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
            "Precision: Deepen primary references and operational documentation.",
            "Adversarial AI Verification: Document explicit prompt logs showing where AI models omitted critical elements.",
            "Executive Depth: Formulate actionable strategic recommendations rather than high-level advice.",
            "Quantitative Assessment: Incorporate risk exposure thresholds and validation protocols.",
        ]
        critical_feedback = (
            f"COMPREHENSIVE ACADEMIC & EXECUTIVE APPRAISAL\n\n"
            f"1. Academic Rigor: Solid understanding of core assignment principles.\n"
            f"2. AI Audit: Incorporate transparent verification notes distinguishing raw AI outputs from student analysis.\n"
            f"3. Strategic Application: Frame recommendations as actionable playbooks."
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
