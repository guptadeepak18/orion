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

def test_ai_intelligence():
    print("1. Logging in as admin@lexiconmile.com...")
    status_code, login_resp = api_request("/auth/login", method="POST", data={
        "email": "admin@lexiconmile.com",
        "password": "password123"
    })
    assert status_code == 200, f"Login failed: {status_code} {login_resp}"
    token = login_resp["data"]["access_token"]
    print("   [OK] Admin login successful.")

    print("2. Fetching Proactive Early Warning Sentinel (/ai/early-warnings)...")
    status_code, ewis_resp = api_request("/ai/early-warnings", token=token)
    assert status_code == 200, f"EWIS failed: {status_code} {ewis_resp}"
    ewis_data = ewis_resp["data"]
    summary = ewis_data["summary"]
    print(f"   [OK] EWIS Dashboard: Total={summary['total_students']}, Imminent={summary['imminent_debarment']}, Critical={summary['critical_risk']}, HealthScore={summary['batch_health_score']}")

    print("3. Fetching Academic Subjects for Syllabus Benchmark...")
    status_code, sub_resp = api_request("/academic/subjects", token=token)
    assert status_code == 200, f"Subjects failed: {status_code} {sub_resp}"
    subjects = sub_resp["data"]
    assert len(subjects) > 0, "No subjects found"
    subject_id = subjects[0]["id"]
    subject_name = subjects[0]["name"]

    print(f"4. Running AI Syllabus & Industry Alignment Benchmark for '{subject_name}' (/ai/syllabus-benchmark/{subject_id})...")
    status_code, bench_resp = api_request(f"/ai/syllabus-benchmark/{subject_id}", token=token)
    assert status_code == 200, f"Benchmark failed: {status_code} {bench_resp}"
    bench = bench_resp["data"]
    print(f"   [OK] Industry Alignment Score: {bench['industry_alignment_score']}% ({bench['industry_alignment_rating']})")
    print(f"   [OK] Bloom's Cognitive Dist: {bench['blooms_cognitive_distribution']}")
    print(f"   [OK] Matched Competencies: {bench['matched_industry_competencies']}")
    print(f"   [OK] AI Recommended Enrichments: {len(bench['ai_enrichment_recommendations'])} modules suggested")

    print("5. Fetching Institutional Health Pulse (/ai/institutional-health-pulse)...")
    status_code, pulse_resp = api_request("/ai/institutional-health-pulse", token=token)
    assert status_code == 200, f"Pulse failed: {status_code} {pulse_resp}"
    pulse = pulse_resp["data"]
    print(f"   [OK] Institute Health Score: {pulse['institutional_health_score']} | Attendance Rate: {pulse['overall_attendance_rate']} | Compliance: {pulse['accreditation_compliance_index']}")

    print("\n[SUCCESS] ALL PROACTIVE AI INTELLIGENCE CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_ai_intelligence()
