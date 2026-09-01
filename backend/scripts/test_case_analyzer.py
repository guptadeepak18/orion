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

def test_case_analyzer():
    print("1. Admin Login (User 1)...")
    status_code, login_resp = api_request("/auth/login", method="POST", data={
        "email": "admin@lexiconmile.com",
        "password": "password123"
    })
    assert status_code == 200, f"Login failed: {status_code}"
    admin_token = login_resp["data"]["access_token"]
    print("   [OK] Admin logged in.")

    print("2. Fetching Framework Lenses (/case-studies/meta/framework-lenses)...")
    status_code, lenses_resp = api_request("/case-studies/meta/framework-lenses", token=admin_token)
    assert status_code == 200, f"Lenses failed: {status_code} {lenses_resp}"
    lenses = lenses_resp["data"]
    print(f"   [OK] Retrieved {len(lenses)} analytical framework lenses.")
    assert len(lenses) >= 10, f"Expected at least 10 lenses, got {len(lenses)}"

    print("3. Fetching Case Studies list...")
    status_code, cs_resp = api_request("/case-studies", token=admin_token)
    assert status_code == 200, f"Cases failed: {status_code} {cs_resp}"
    cases = cs_resp["data"]
    assert len(cases) > 0, "No cases found in library"
    target_case = cases[0]
    case_id = target_case["id"]
    print(f"   [OK] Testing with case: '{target_case['title']}' ({case_id})")

    print(f"4. Checking existing analysis for Admin (User 1)...")
    status_code, existing_resp = api_request(f"/case-studies/{case_id}/ai-analysis", token=admin_token)
    assert status_code == 200
    print(f"   [OK] Initial analysis state: {existing_resp['data'] is not None}")

    print(f"5. Running AI Case Analyzer for Admin with 'porter_competitive' lens + custom prompt...")
    status_code, run_resp = api_request(f"/case-studies/{case_id}/ai-analysis", method="POST", token=admin_token, data={
        "analysis_lens": "porter_competitive",
        "custom_prompt": "Evaluate barrier to entry and pricing power under supply chain constraints."
    })
    assert status_code == 200, f"Run analysis failed: {status_code} {run_resp}"
    analysis_data = run_resp["data"]
    sections = analysis_data["analysis"]["sections"]
    print(f"   [OK] Analysis generated with {len(sections)} structured sections:")
    for s in sections:
        print(f"        - {s['title']}")

    print("6. Verifying Persistence: Fetching saved analysis for Admin without re-running...")
    status_code, fetch_saved_resp = api_request(f"/case-studies/{case_id}/ai-analysis", token=admin_token)
    assert status_code == 200
    assert fetch_saved_resp["data"] is not None
    assert fetch_saved_resp["data"]["analysis_lens"] == "porter_competitive"
    print("   [OK] Successfully retrieved persisted analysis instantly without re-running!")

    print("7. Testing User Isolation: Logging in as Student 1 (User 2)...")
    status_code, st_login = api_request("/auth/login", method="POST", data={
        "email": "student1@lexiconmile.com",
        "password": "password123"
    })
    assert status_code == 200, f"Student login failed: {status_code}"
    student_token = st_login["data"]["access_token"]
    
    print("8. Resetting Student 1's analysis to verify fresh isolation state...")
    api_request(f"/case-studies/{case_id}/ai-analysis", method="DELETE", token=student_token)
    
    print("9. Checking if Student 1 (User 2) sees Admin's analysis...")
    status_code, st_check_resp = api_request(f"/case-studies/{case_id}/ai-analysis", token=student_token)
    assert status_code == 200
    print(f"   [OK] Student 1 initial analysis is None: {st_check_resp['data'] is None}")
    assert st_check_resp["data"] is None, "User isolation failed! Student 1 should not see Admin's analysis."

    print("10. Running Student 1's own analysis with 'financial_turnaround' lens...")
    status_code, st_run_resp = api_request(f"/case-studies/{case_id}/ai-analysis", method="POST", token=student_token, data={
        "analysis_lens": "financial_turnaround",
        "custom_prompt": "Examine EBITDA margins and inventory turnover."
    })
    assert status_code == 200, f"Student run failed: {status_code} {st_run_resp}"
    print(f"   [OK] Student 1 generated their own '{st_run_resp['data']['analysis_lens']}' analysis.")

    print("11. Verifying Admin still has their original 'porter_competitive' analysis unchanged...")
    status_code, admin_verify_resp = api_request(f"/case-studies/{case_id}/ai-analysis", token=admin_token)
    assert status_code == 200
    assert admin_verify_resp["data"]["analysis_lens"] == "porter_competitive"
    print("   [OK] Admin analysis remained 'porter_competitive' (User Isolation Verified 100%)!")

    print("\n[SUCCESS] AI CASE ANALYZER ENDPOINTS & USER ISOLATION VERIFIED PERFECTLY!")

if __name__ == "__main__":
    test_case_analyzer()
