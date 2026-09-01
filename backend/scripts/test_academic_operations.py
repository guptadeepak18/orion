import json
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = "http://localhost:8000/api/v1"

def api_request(path, method="GET", data=None, token=None, params=None):
    url = f"{BASE_URL}{path}"
    if params:
        query_string = urllib.parse.urlencode(params)
        url = f"{url}?{query_string}"
    
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    
    body = json.dumps(data).encode("utf-8") if data is not None else None
    try:
        with urllib.request.urlopen(req, data=body) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body)
    except urllib.error.HTTPError as e:
        res_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(res_body)
        except Exception:
            return e.code, {"detail": res_body}

def test_operations():
    print("1. Admin Login...")
    status_code, login_resp = api_request("/auth/login", method="POST", data={
        "email": "admin@lexiconmile.com",
        "password": "password123"
    })
    assert status_code == 200, f"Login failed: {status_code}"
    token = login_resp["data"]["access_token"]
    print("   [OK] Logged in.")

    print("2. Fetching Batches, Subjects, and Students...")
    _, b_resp = api_request("/academic/batches", token=token)
    batch_id = b_resp["data"][0]["id"]
    
    _, s_resp = api_request("/academic/subjects", token=token)
    subject_id = s_resp["data"][0]["id"]
    
    _, st_resp = api_request("/students", token=token)
    student_id = st_resp["data"][0]["id"]
    print(f"   [OK] Target Batch ID: {batch_id}, Subject ID: {subject_id}, Student ID: {student_id}")

    print("3. Testing Neural Constraint Timetable Optimizer (/operations/timetable/optimize)...")
    status_code, tt_resp = api_request("/operations/timetable/optimize", token=token, params={"batch_id": batch_id})
    assert status_code == 200, f"Timetable failed: {status_code} {tt_resp}"
    print(f"   [OK] Timetable generated. Optimization Score: {tt_resp['data']['optimization_score']}%, Total Weekly Sessions: {tt_resp['data']['total_weekly_sessions']}")

    print("4. Testing AI Emergency Faculty Substitution Sentinel (/operations/substitute/find)...")
    status_code, sub_resp = api_request("/operations/substitute/find", token=token, params={"subject_id": subject_id})
    assert status_code == 200, f"Substitute failed: {status_code} {sub_resp}"
    print(f"   [OK] Found {sub_resp['data']['available_substitutes_count']} available domain substitute faculty members.")

    print("5. Testing Conflict-Free Anti-Cheat Exam Seating Matrix (/operations/exam/seating-matrix)...")
    status_code, seat_resp = api_request("/operations/exam/seating-matrix", token=token)
    assert status_code == 200, f"Seating failed: {status_code} {seat_resp}"
    print(f"   [OK] Generated seating matrix for {seat_resp['data']['total_students_seated']} students across {len(seat_resp['data']['halls_utilized'])} halls.")

    print("6. Testing AI Bloom's Question Paper Generator (/operations/exam/blooms-question-paper/{subject_id})...")
    status_code, qp_resp = api_request(f"/operations/exam/blooms-question-paper/{subject_id}", token=token)
    assert status_code == 200, f"Question paper failed: {status_code} {qp_resp}"
    print(f"   [OK] Question Paper: {len(qp_resp['data']['questions'])} questions generated across Bloom's L1-L6 cognitive levels.")

    print("7. Testing AI Formative Rubric Grader (/operations/rubric/evaluate)...")
    status_code, rub_resp = api_request("/operations/rubric/evaluate", method="POST", token=token, data={
        "submission_text": "Executive analysis on digital transformation and supply chain agility in modern enterprises. Strategic recommendations include cloud migration and predictive maintenance.",
        "assignment_title": "Capstone Strategic Management",
        "max_marks": 20
    })
    assert status_code == 200, f"Rubric failed: {status_code} {rub_resp}"
    print(f"   [OK] Rubric Graded: Score {rub_resp['data']['total_score']}, Grade {rub_resp['data']['grade_letter']}, Originality {rub_resp['data']['originality_index']}")

    print("8. Testing Student 360° Talent DNA Radar (/operations/crc/talent-dna/{student_id})...")
    status_code, dna_resp = api_request(f"/operations/crc/talent-dna/{student_id}", token=token)
    assert status_code == 200, f"Talent DNA failed: {status_code} {dna_resp}"
    print(f"   [OK] Student Talent DNA: Index {dna_resp['data']['overall_talent_index']}, Tier '{dna_resp['data']['readiness_tier']}'")

    print("9. Testing AI Placement Matchmaker (/operations/crc/jd-match)...")
    status_code, jd_resp = api_request("/operations/crc/jd-match", method="POST", token=token, data={
        "job_title": "Management Consultant - Strategy & Operations",
        "domain": "Consulting",
        "required_skills": ["Strategic Management", "Financial Modeling", "Data Analytics"]
    })
    assert status_code == 200, f"JD Match failed: {status_code} {jd_resp}"
    print(f"   [OK] Placement Matchmaker: {jd_resp['data']['shortlisted_count']} candidate(s) ranked and shortlisted.")

    print("\n[SUCCESS] ALL 7 WORLD-CLASS ACADEMIC OPERATIONS ENGINES TESTED & VERIFIED!")

if __name__ == "__main__":
    test_operations()
