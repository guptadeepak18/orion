import asyncio
import asyncpg
import docx
import json
import re
import uuid

import os
import sys
from pathlib import Path

# Dynamically load from backend/.env if present
env_file = Path(__file__).resolve().parent.parent / '.env'
if env_file.exists():
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

DOCX_PATH = os.environ.get('DOCX_PATH', 'd:/Applications/crc-one/HyperBuild_AI_Activities_LegalAspectsOfBusiness_1GNC03.docx')
AIVEN_URL = os.environ.get('DATABASE_URL', '')
NEON_URL = os.environ.get('NEON_DATABASE_URL', '')

def clean_text(s: str) -> str:
    if not s:
        return ""
    s = s.replace('\u2013', '–').replace('\u2014', '—').replace('\ufffd', '—')
    s = s.replace('\xa0', ' ')
    s = re.sub(r'[\t ]+', ' ', s)
    return s.strip()

def parse_docx(path: str):
    doc = docx.Document(path)
    activities = []
    
    current_act = None
    current_section = None
    
    for elem in doc.element.body:
        tag = elem.tag.split('}')[-1]
        
        if tag == 'tbl':
            for t in doc.tables:
                if t._tbl == elem:
                    table = t
                    break
            else:
                continue
                
            first_row_cells = [clean_text(c.text) for c in table.rows[0].cells]
            first_row_txt = " /// ".join([c for c in first_row_cells if c])
            upper_row = first_row_txt.upper()
            
            # Check for Activity Header table
            if re.search(r'ACTIVITY\s*\d+', upper_row) and not any(h in upper_row for h in ["WHY THIS ACTIVITY", "STEP-BY-STEP", "AI TOOLS", "LEARNING OUTCOMES", "ASSESSMENT TASK", "GRADING RUBRIC"]):
                if current_act:
                    activities.append(current_act)
                    
                m = re.search(r'ACTIVITY\s*(\d+)', upper_row)
                act_num = int(m.group(1)) if m else len(activities) + 1
                
                full_title_cell = table.rows[0].cells[-1].text.strip()
                lines = [clean_text(l) for l in full_title_cell.split('\n') if l.strip()]
                
                title = lines[0] if lines else ""
                unit_mapping = ""
                for l in lines[1:]:
                    if l.upper().startswith("UNIT"):
                        unit_mapping = l
                    else:
                        title += " " + l
                        
                title = re.sub(r'^ACTIVITY\s*\d+[:\s—\-]*', '', title, flags=re.IGNORECASE).strip()
                
                current_act = {
                    "activity_no": act_num,
                    "title": title,
                    "unit_mapping": unit_mapping,
                    "estimated_time": "",
                    "mode": "Individual",
                    "file_naming": f"[RollNo]_LAW_Act{act_num:02d}",
                    "why_this_activity": [],
                    "instructions": [],
                    "ai_tools": [],
                    "learning_outcomes": [],
                    "submission_requirements": [],
                    "rubric": [],
                    "is_released": False
                }
                current_section = None
                continue
                
            if current_act and "ESTIMATED TIME:" in upper_row:
                for cell in table.rows[0].cells:
                    txt = clean_text(cell.text)
                    if "ESTIMATED TIME:" in txt.upper():
                        current_act["estimated_time"] = re.sub(r'ESTIMATED TIME:\s*', '', txt, flags=re.IGNORECASE).strip()
                    elif "MODE:" in txt.upper():
                        current_act["mode"] = re.sub(r'MODE:\s*', '', txt, flags=re.IGNORECASE).strip()
                    elif "FILE NAMING:" in txt.upper():
                        current_act["file_naming"] = re.sub(r'FILE NAMING:\s*', '', txt, flags=re.IGNORECASE).strip()
                continue
                
            if current_act:
                if "WHY THIS ACTIVITY" in upper_row:
                    current_section = "why_this_activity"
                    continue
                elif "STEP-BY-STEP INSTRUCTIONS" in upper_row or "CAPSTONE STRUCTURE" in upper_row:
                    current_section = "instructions"
                    continue
                elif "AI TOOLS & PLATFORMS" in upper_row:
                    current_section = "ai_tools"
                    continue
                elif "LEARNING OUTCOMES" in upper_row:
                    current_section = "learning_outcomes"
                    continue
                elif "ASSESSMENT TASK & SUBMISSION REQUIREMENTS" in upper_row or "ASSESSMENT TASK" in upper_row:
                    current_section = "submission_requirements"
                    continue
                elif "GRADING RUBRIC" in upper_row:
                    current_section = "rubric"
                    continue
                    
            if current_act and current_section == "ai_tools":
                if len(table.rows[0].cells) >= 4 and "TOOL" in table.rows[0].cells[0].text.upper():
                    tools = []
                    for r in table.rows[1:]:
                        if len(r.cells) >= 4:
                            tool_name = clean_text(r.cells[0].text)
                            cat = clean_text(r.cells[1].text)
                            purp = clean_text(r.cells[2].text)
                            acc = clean_text(r.cells[3].text)
                            if tool_name:
                                tools.append({
                                    "tool": tool_name,
                                    "category": cat,
                                    "purpose": purp,
                                    "access": acc
                                })
                    current_act["ai_tools"] = tools
                    current_section = None
                    continue
                    
            if current_act and current_section == "rubric":
                if len(table.rows[0].cells) >= 5 and "DISTINCTION" in table.rows[0].cells[1].text.upper():
                    rubric = []
                    for r in table.rows[1:]:
                        if len(r.cells) >= 5:
                            crit = clean_text(r.cells[0].text)
                            dist = clean_text(r.cells[1].text)
                            merit = clean_text(r.cells[2].text)
                            pass_g = clean_text(r.cells[3].text)
                            needs_w = clean_text(r.cells[4].text)
                            
                            weightage = None
                            if len(r.cells) >= 6:
                                wt_text = clean_text(r.cells[5].text)
                                wt_m = re.search(r'(\d+)', wt_text)
                                if wt_m:
                                    weightage = int(wt_m.group(1))
                                    
                            if crit:
                                row_dict = {
                                    "criterion": crit,
                                    "distinction": dist,
                                    "merit": merit,
                                    "pass_grade": pass_g,
                                    "needs_work": needs_w,
                                }
                                if weightage is not None:
                                    row_dict["weightage"] = weightage
                                rubric.append(row_dict)
                    current_act["rubric"] = rubric
                    current_section = None
                    continue
                    
        elif tag == 'p':
            p = docx.text.paragraph.Paragraph(elem, doc)
            txt = clean_text(p.text)
            if not txt:
                continue
                
            # Check for Capstone trigger
            if txt.upper().startswith("CAPSTONE —") or txt.upper().startswith("CAPSTONE -"):
                if current_act:
                    activities.append(current_act)
                title = txt
                current_act = {
                    "activity_no": 16,
                    "title": title,
                    "unit_mapping": "Integrative Capstone (Units 1–5)",
                    "estimated_time": "15–20 hours (self-paced over 2 weeks)",
                    "mode": "Individual (report) / In-class presentation",
                    "file_naming": "[RollNo]_LAW_Capstone",
                    "why_this_activity": [],
                    "instructions": [],
                    "ai_tools": [],
                    "learning_outcomes": [],
                    "submission_requirements": [],
                    "rubric": [],
                    "is_released": False
                }
                current_section = None
                continue
                
            if current_act and current_section:
                if current_section in ["why_this_activity", "instructions", "learning_outcomes", "submission_requirements"]:
                    current_act[current_section].append(txt)
                    
    if current_act:
        activities.append(current_act)
        
    return activities

def format_activity_data(act):
    """Format activity fields with proper bullet points, numbering, and validated weights."""
    clean_instructions = []
    for idx, inst in enumerate(act["instructions"], start=1):
        cleaned_inst = re.sub(r'^\(?\d+\)?[\.\:]?\s*', '', inst).strip()
        cleaned_inst = cleaned_inst.replace('\t', ' ')
        clean_instructions.append(f"{idx}.\t{cleaned_inst}")
    formatted_instructions = "\n".join(clean_instructions)
    
    clean_why = []
    for line in act["why_this_activity"]:
        cleaned_line = re.sub(r'^[•\-\*]\s*', '', line).strip()
        cleaned_line = cleaned_line.replace('\t', ' ')
        clean_why.append(f"•\t{cleaned_line}")
    formatted_why = "\n".join(clean_why)
    
    clean_lo = []
    for line in act["learning_outcomes"]:
        cleaned_line = re.sub(r'^[•\-\*]\s*', '', line).strip()
        cleaned_line = cleaned_line.replace('\t', ' ')
        clean_lo.append(f"•\t{cleaned_line}")
    formatted_lo = "\n".join(clean_lo)
    
    clean_sr = []
    for line in act["submission_requirements"]:
        cleaned_line = re.sub(r'^[•\-\*]\s*', '', line).strip()
        cleaned_line = cleaned_line.replace('\t', ' ')
        clean_sr.append(f"•\t{cleaned_line}")
    formatted_sr = "\n".join(clean_sr)
    
    rubric = act["rubric"]
    total_wt = sum(r.get("weightage", 0) for r in rubric)
    if total_wt != 100 and len(rubric) > 0:
        print(f"Warning: Act #{act['activity_no']} rubric total weight is {total_wt}%. Balancing...")
        base = 100 // len(rubric)
        rem = 100 % len(rubric)
        for i, r in enumerate(rubric):
            r["weightage"] = base + (rem if i == 0 else 0)
            
    return {
        "activity_no": act["activity_no"],
        "title": act["title"],
        "unit_mapping": act["unit_mapping"],
        "estimated_time": act["estimated_time"],
        "mode": act["mode"],
        "file_naming": act["file_naming"],
        "why_this_activity": formatted_why,
        "instructions": formatted_instructions,
        "learning_outcomes": formatted_lo,
        "submission_requirements": formatted_sr,
        "ai_tools": act["ai_tools"],
        "rubric": rubric,
    }

async def sync_database(db_url: str, db_name: str, parsed_activities):
    print(f"\n=======================================================")
    print(f"SYNCING DATABASE: {db_name}")
    print(f"=======================================================")
    conn = await asyncpg.connect(db_url, ssl='require')
    try:
        subject = await conn.fetchrow("""
            SELECT id, name, code, course_code FROM subjects
            WHERE code = 'LAB' OR course_code = '1GNC03' OR name ILIKE '%Legal Aspects%'
        """)
        if not subject:
            print("ERROR: Legal Aspects of Business subject not found!")
            return
        subject_id = subject["id"]
        print(f"Subject found: {subject['name']} ({subject['code']}) - ID: {subject_id}")
        
        cs_rows = await conn.fetch("SELECT * FROM case_studies")
        cs_map = {r["title"]: r for r in cs_rows}
        
        def build_cs_payload(cs_titles):
            payload = []
            for t in cs_titles:
                for db_title, r in cs_map.items():
                    if t.lower() in db_title.lower():
                        payload.append({
                            "id": str(r["id"]),
                            "case_study_id": str(r["id"]),
                            "title": r["title"],
                            "author": r.get("author") or "",
                            "publisher_source": r.get("publisher_source") or "Harvard Business School",
                            "industry_domain": r.get("industry_domain") or "General Management",
                            "concept": r.get("concept") or "",
                            "learning_objectives": r.get("learning_objectives") or "",
                            "file_url": r.get("file_url") or "",
                            "file_name": r.get("file_name") or "",
                            "file_size": r.get("file_size") or 0,
                            "external_link": r.get("external_link") or "",
                            "is_manual": False
                        })
                        break
            return payload

        cs_links = {
            4: ["Uber: Competing Globally"],
            10: [
                "Corporate Governance Failure at Satyam",
                "Tech Mahindra and the Acquisition of Satyam Computers"
            ],
            14: [
                "Facebook Confronts a Crisis of Trust",
                "Facebook, Cambridge Analytica, and the (Uncertain) Future of Online Privacy"
            ]
        }
        
        existing_rows = await conn.fetch("""
            SELECT id, activity_no, is_released, released_at, released_by
            FROM subject_activities
            WHERE subject_id = $1
            ORDER BY activity_no
        """, subject_id)
        existing_map = {r["activity_no"]: r for r in existing_rows}
        print(f"Existing activities in {db_name}: {len(existing_map)}")
        
        for raw_act in parsed_activities:
            act_data = format_activity_data(raw_act)
            act_no = act_data["activity_no"]
            
            linked_cs = []
            cs_id = None
            if act_no in cs_links:
                linked_cs = build_cs_payload(cs_links[act_no])
                if linked_cs:
                    cs_id = uuid.UUID(linked_cs[0]["id"])
                    
            ai_tools_json = json.dumps(act_data["ai_tools"])
            rubric_json = json.dumps(act_data["rubric"])
            case_studies_json = json.dumps(linked_cs) if linked_cs else None
            
            if act_no in existing_map:
                existing = existing_map[act_no]
                row_id = existing["id"]
                await conn.execute("""
                    UPDATE subject_activities
                    SET title = $1,
                        unit_mapping = $2,
                        estimated_time = $3,
                        mode = $4,
                        file_naming = $5,
                        why_this_activity = $6,
                        instructions = $7,
                        learning_outcomes = $8,
                        submission_requirements = $9,
                        ai_tools = $10::json,
                        rubric = $11::json,
                        case_study_id = $12,
                        case_studies = $13::json,
                        updated_at = NOW()
                    WHERE id = $14
                """,
                    act_data["title"],
                    act_data["unit_mapping"],
                    act_data["estimated_time"],
                    act_data["mode"],
                    act_data["file_naming"],
                    act_data["why_this_activity"],
                    act_data["instructions"],
                    act_data["learning_outcomes"],
                    act_data["submission_requirements"],
                    ai_tools_json,
                    rubric_json,
                    cs_id,
                    case_studies_json,
                    row_id
                )
                print(f"Updated Act #{act_no}: {act_data['title'][:45]}... (ID: {row_id})")
            else:
                new_id = uuid.uuid4()
                is_released = act_no <= 3
                await conn.execute("""
                    INSERT INTO subject_activities (
                        id, subject_id, activity_no, title, unit_mapping, estimated_time,
                        mode, file_naming, why_this_activity, instructions, learning_outcomes,
                        submission_requirements, ai_tools, rubric, is_released, is_locked,
                        case_study_id, case_studies, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                        $13::json, $14::json, $15, $16, $17, $18::json, NOW(), NOW()
                    )
                """,
                    new_id,
                    subject_id,
                    act_no,
                    act_data["title"],
                    act_data["unit_mapping"],
                    act_data["estimated_time"],
                    act_data["mode"],
                    act_data["file_naming"],
                    act_data["why_this_activity"],
                    act_data["instructions"],
                    act_data["learning_outcomes"],
                    act_data["submission_requirements"],
                    ai_tools_json,
                    rubric_json,
                    is_released,
                    False,
                    cs_id,
                    case_studies_json
                )
                print(f"Inserted NEW Act #{act_no}: {act_data['title'][:45]}... (ID: {new_id})")
                
        total_now = await conn.fetchval("SELECT count(*) FROM subject_activities WHERE subject_id = $1", subject_id)
        released_now = await conn.fetchval("SELECT count(*) FROM subject_activities WHERE subject_id = $1 AND is_released = true", subject_id)
        print(f"Successfully synced {db_name}! Total activities: {total_now} ({released_now} released)")
        
    finally:
        await conn.close()

async def main():
    print(f"Parsing Word Document: {DOCX_PATH}")
    parsed = parse_docx(DOCX_PATH)
    print(f"Extracted {len(parsed)} activities from docx.")
    
    if AIVEN_URL:
        await sync_database(AIVEN_URL, "Primary Database", parsed)
    if NEON_URL:
        await sync_database(NEON_URL, "Secondary Database", parsed)
    
    print("\nAll databases synchronized successfully!")

if __name__ == '__main__':
    asyncio.run(main())
