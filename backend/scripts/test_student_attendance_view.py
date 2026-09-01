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

def test_student_attendance():
    print("1. Logging in as student1@lexiconmile.com...")
    status_code, login_resp = api_request("/auth/login", method="POST", data={
        "email": "student1@lexiconmile.com",
        "password": "password123"
    })
    assert status_code == 200, f"Login failed: {status_code} {login_resp}"
    token = login_resp["data"]["access_token"]
    print("   [OK] Student login successful.")

    print("2. Fetching academic subjects as student (/academic/subjects)...")
    status_code, sub_resp = api_request("/academic/subjects", token=token)
    assert status_code == 200, f"Get subjects failed: {status_code} {sub_resp}"
    subjects = sub_resp["data"]
    print(f"   [OK] Subjects fetched successfully: {len(subjects)} subjects found.")
    for s in subjects[:5]:
        print(f"     - [{s.get('code') or s.get('course_code')}] {s.get('name')} (ID: {s.get('id')})")

    assert len(subjects) > 0, "Expected at least 1 subject in the list"
    first_subject_id = subjects[0]["id"]

    print("3. Fetching subject attendance summary as student (/attendance/subject-summary)...")
    status_code, summary_resp = api_request(
        "/attendance/subject-summary",
        params={"subject_id": first_subject_id},
        token=token
    )
    assert status_code == 200, f"Subject summary failed: {status_code} {summary_resp}"
    summary = summary_resp["data"]
    print(f"   [OK] Subject summary fetched: conducted={summary.get('total_sessions_conducted')}, avg={summary.get('class_average_percentage')}%")

    print("4. Fetching student self profile (/students/me)...")
    status_code, me_resp = api_request("/students/me", token=token)
    assert status_code == 200, f"Profile me failed: {status_code} {me_resp}"
    me = me_resp["data"]
    student_id = me["student"]["id"]
    print(f"   [OK] Self student profile fetched: {me['student']['first_name']} {me['student'].get('last_name')}, PRN: {me['student'].get('prn_number')}")

    print("5. Fetching student attendance dossier (/attendance/student-dossier)...")
    status_code, dossier_resp = api_request(f"/attendance/student-dossier/{student_id}", token=token)
    assert status_code == 200, f"Dossier failed: {status_code} {dossier_resp}"
    dossier = dossier_resp["data"]
    print(f"   [OK] Dossier fetched: Total conducted={dossier.get('total_classes_conducted')}, attended={dossier.get('total_classes_attended')}, overall={dossier.get('overall_attendance_percentage')}%")

    print("\n[SUCCESS] ALL STUDENT ATTENDANCE VIEW CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_student_attendance()
