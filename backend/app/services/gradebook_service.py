import io
import csv
import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.academic import Subject, Program, Batch, Division, SubjectProgram, SubjectBatch
from app.models.student import Student, StudentDivision
from app.models.lms import ActivitySubmission, SubjectAssessment, AssessmentSubmission
from app.models.activity import SubjectActivity
from app.models.gradebook import StudentSubjectGrade
from app.core.config import settings
from fastapi import HTTPException
from app.services.email_service import send_custom_html_email

logger = logging.getLogger(__name__)


def calculate_grade_letter_and_points(percentage: float):
    if percentage >= 90.0:
        return "A+", 10.0, "Distinction (85-100%)"
    elif percentage >= 80.0:
        return "A", 9.0, "Distinction (85-100%)" if percentage >= 85.0 else "Merit (70-84%)"
    elif percentage >= 70.0:
        return "B+", 8.0, "Merit (70-84%)"
    elif percentage >= 60.0:
        return "B", 7.0, "Pass (50-69%)"
    elif percentage >= 50.0:
        return "C", 6.0, "Pass (50-69%)"
    else:
        return "F", 0.0, "Needs Work (<50%)"


def extract_subject_max_marks(subj) -> tuple[float, float]:
    """Extracts CCE and End Term (TEE) max marks as defined in the subject's curriculum."""
    cce_max = 50.0
    end_term_max = 50.0
    if subj and getattr(subj, "syllabus", None):
        try:
            data = json.loads(subj.syllabus)
            if isinstance(data, dict):
                if "cce_marks" in data and data["cce_marks"]:
                    cce_max = float(data["cce_marks"])
                if "tee_marks" in data and data["tee_marks"]:
                    end_term_max = float(data["tee_marks"])
                elif "end_term_marks" in data and data["end_term_marks"]:
                    end_term_max = float(data["end_term_marks"])
        except Exception:
            pass
    return cce_max, end_term_max


def _build_student_result_email_html(
    student_name: str,
    prn: str,
    program_name: str,
    batch_name: str,
    subjects_summary: List[Dict[str, Any]],
    portal_url: str = "https://crc-one.onrender.com/gradebook",
) -> str:
    """
    Renders an engaging, clean, sectioned HTML email notification for academic results.
    Structured into:
    - Header
    - Student Credentials Box
    - Course-by-Course 3-Component Scorecard (CCE, HyperBuild Labs, Term End, Total %)
    - Evaluator Insights & Strengths/Remediation
    - Call to Action Button linking to Orion
    """
    subject_rows_html = ""
    for s in subjects_summary:
        cce_disp = f"{s.get('cce_score')} / {s.get('cce_max', 50)}" if s.get('cce_score') is not None else "Pending"
        hb_disp = f"{s.get('hb_total', '-')} pts ({s.get('hb_avg', '-')}/100 avg)" if s.get('hb_avg') is not None else "No Labs"
        te_disp = f"{s.get('term_end_score')} / {s.get('term_end_max', 50)}" if s.get('term_end_score') is not None else "Scheduled"
        tot_disp = f"{s.get('total_percentage')}%" if s.get('total_percentage') is not None else "In Progress"
        grade_disp = s.get('grade_letter', 'IP')
        tier_disp = s.get('performance_tier', 'In Progress')

        if "Distinction" in tier_disp:
            badge_bg = "#f3e8ff"
            badge_color = "#6b21a8"
        elif "Merit" in tier_disp:
            badge_bg = "#e0e7ff"
            badge_color = "#3730a3"
        elif "Pass" in tier_disp:
            badge_bg = "#dcfce7"
            badge_color = "#166534"
        else:
            badge_bg = "#fee2e2"
            badge_color = "#991b1b"

        subject_rows_html += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 14px; font-weight: 700; color: #0f172a; font-size: 13px;">
            {s.get('code')}<br/>
            <span style="font-weight: 500; color: #64748b; font-size: 11px;">{s.get('name')}</span>
          </td>
          <td style="padding: 12px 10px; color: #334155; font-size: 12px; font-weight: 600; text-align: center;">
            {cce_disp}
          </td>
          <td style="padding: 12px 10px; color: #4338ca; font-size: 12px; font-weight: 700; text-align: center;">
            {hb_disp}
          </td>
          <td style="padding: 12px 10px; color: #334155; font-size: 12px; font-weight: 600; text-align: center;">
            {te_disp}
          </td>
          <td style="padding: 12px 10px; color: #0f172a; font-size: 13px; font-weight: 800; text-align: center;">
            {tot_disp}
          </td>
          <td style="padding: 12px 14px; text-align: right;">
            <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: {badge_bg}; color: {badge_color}; font-size: 11px; font-weight: 700;">
              {grade_disp} • {tier_disp.split('(')[0].strip()}
            </span>
          </td>
        </tr>
        """

    feedback_blocks_html = ""
    for s in subjects_summary:
        strengths = s.get("strengths", [])
        gaps = s.get("areas_for_improvement", [])
        crit = s.get("critical_feedback") or s.get("feedback")
        if strengths or gaps or crit:
            strengths_items = "".join([f"<li style='margin-bottom: 4px;'>{st}</li>" for st in strengths[:3]])
            gaps_items = "".join([f"<li style='margin-bottom: 4px;'>{gp}</li>" for gp in gaps[:3]])
            
            feedback_blocks_html += f"""
            <div style="margin-top: 14px; padding: 14px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
              <div style="font-weight: 800; font-size: 12px; color: #4338ca; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                Feedback & Appraisal: {s.get('code')} — {s.get('name')}
              </div>
              {f'<div style="margin-bottom: 8px;"><strong style="font-size: 11px; color: #166534; text-transform: uppercase;">Key Strengths:</strong><ul style="margin: 4px 0 8px 18px; padding: 0; font-size: 12px; color: #334155;">{strengths_items}</ul></div>' if strengths_items else ''}
              {f'<div style="margin-bottom: 8px;"><strong style="font-size: 11px; color: #991b1b; text-transform: uppercase;">Growth & Remediation Focus:</strong><ul style="margin: 4px 0 8px 18px; padding: 0; font-size: 12px; color: #334155;">{gaps_items}</ul></div>' if gaps_items else ''}
              {f'<p style="margin: 6px 0 0; font-size: 12px; color: #475569; line-height: 1.5; font-style: italic;">"{crit}"</p>' if crit else ''}
            </div>
            """

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Academic Gradebook Results</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 28px 12px; color: #1e293b;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);">
    
    <!-- Header -->
    <div style="background: #0f172a; padding: 24px 28px; border-bottom: 3px solid #4f46e5;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #818cf8; margin-bottom: 4px;">
        Orion Academic Portal • Official Grade Notification
      </div>
      <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        Academic Evaluation & Marksheet Results
      </h1>
      <p style="margin: 4px 0 0; font-size: 12.5px; color: #94a3b8;">
        Continuous Evaluation (CCE) • HyperBuild Practical Labs • Term End Examination
      </p>
    </div>

    <!-- Student Credentials Box -->
    <div style="padding: 20px 28px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">{student_name}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              PRN: <span style="font-family: monospace; font-weight: 700; color: #4f46e5;">{prn}</span> • {program_name}
            </div>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <span style="display: inline-block; padding: 4px 10px; background: #e0e7ff; color: #3730a3; border-radius: 8px; font-size: 11px; font-weight: 700;">
              {batch_name}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Main Body -->
    <div style="padding: 24px 28px;">
      <p style="font-size: 13.5px; line-height: 1.6; color: #334155; margin: 0 0 18px;">
        Dear <strong>{student_name}</strong>,<br/><br/>
        Your official performance evaluation and marksheet results across Continuous Comprehensive Evaluation (CCE), HyperBuild practical simulation labs, and Term End examination are detailed below.
      </p>

      <!-- Section: Marks Breakdown Card / Table -->
      {f'''<div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; margin-bottom: 22px;">
        <div style="font-size: 11px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
          Subject Performance Card
        </div>
        <h2 style="margin: 0 0 14px; font-size: 18px; font-weight: 800; color: #0f172a;">
          {subjects_summary[0].get('name')} ({subjects_summary[0].get('code')})
        </h2>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
          <tr>
            <td width="25%" style="padding: 12px 6px; border-right: 1px solid #e2e8f0;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">CCE Marks</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 4px;">{f"{subjects_summary[0].get('cce_score')} / {subjects_summary[0].get('cce_max', 50)}" if subjects_summary[0].get('cce_score') is not None else "Pending"}</div>
            </td>
            <td width="25%" style="padding: 12px 6px; border-right: 1px solid #e2e8f0;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #4338ca;">HyperBuild Avg</div>
              <div style="font-size: 14px; font-weight: 800; color: #4338ca; margin-top: 4px;">{f"{subjects_summary[0].get('hb_avg')}/100" if subjects_summary[0].get('hb_avg') is not None else "No Labs Graded"}</div>
            </td>
            <td width="25%" style="padding: 12px 6px; border-right: 1px solid #e2e8f0;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">End Term</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 4px;">{f"{subjects_summary[0].get('term_end_score')} / {subjects_summary[0].get('term_end_max', 50)}" if subjects_summary[0].get('term_end_score') is not None else "Scheduled"}</div>
            </td>
            <td width="25%" style="padding: 12px 6px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #0f172a;">Composite %</div>
              <div style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 4px;">{f"{subjects_summary[0].get('total_percentage')}%" if subjects_summary[0].get('total_percentage') is not None else "In Progress"} ({subjects_summary[0].get('grade_letter', 'IP')})</div>
            </td>
          </tr>
        </table>
      </div>''' if len(subjects_summary) == 1 else f'''<div style="margin-bottom: 22px;">
        <div style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #475569; margin-bottom: 8px;">
          Course Performance Summary
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left; font-size: 10.5px; text-transform: uppercase; color: #475569; font-weight: 800; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 10px 12px;">Course</th>
              <th style="padding: 10px 8px; text-align: center;">CCE</th>
              <th style="padding: 10px 8px; text-align: center;">HyperBuild</th>
              <th style="padding: 10px 8px; text-align: center;">End Term</th>
              <th style="padding: 10px 8px; text-align: center;">Total</th>
              <th style="padding: 10px 12px; text-align: right;">Grade</th>
            </tr>
          </thead>
          <tbody>
            {subject_rows_html}
          </tbody>
        </table>
      </div>'''}

      <!-- Section: Qualitative Feedback & Guidance -->
      {f'''<div style="margin-bottom: 24px;">
        <div style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #475569; margin-bottom: 6px;">
          Evaluator Feedback & Academic Insights
        </div>
        {feedback_blocks_html}
      </div>''' if feedback_blocks_html else ''}

      <!-- Call to Action Button -->
      <div style="text-align: center; padding: 20px 0 12px; border-top: 1px solid #e2e8f0;">
        <a href="{portal_url}" style="display: inline-block; background: #4f46e5; color: #ffffff; font-weight: 700; font-size: 13.5px; padding: 12px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25);">
          View Full Gradebook in Orion &rarr;
        </a>
        <p style="margin: 10px 0 0; font-size: 11px; color: #64748b;">
          Log in with your registered account to inspect interactive rubric scorecards, download simulation lab feedback, and review step-by-step audit checklists.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
      Office of the Academic Registrar & Examination Cell • Orion Academic Portal<br/>
      This is an official automated notification. Please do not reply directly to this email.
    </div>

  </div>
</body>
</html>"""


class GradebookService:
    """Comprehensive academic gradebook service for student transcripts and cohort analysis."""

    async def get_student_by_user(self, db, current_user) -> Optional[Student]:
        res = await db.execute(select(Student).where(Student.user_id == current_user.id))
        return res.scalar_one_or_none()

    async def get_student_gradebook(self, db, student_id: uuid.UUID) -> Dict[str, Any]:
        """Gathers and computes complete gradebook for a single student across all subjects."""
        student_stmt = (
            select(Student)
            .where(Student.id == student_id)
            .options(
                selectinload(Student.program),
                selectinload(Student.batch),
                selectinload(Student.divisions),
            )
        )
        student_res = await db.execute(student_stmt)
        student = student_res.scalar_one_or_none()
        if not student:
            return {"error": "Student not found", "subjects": []}

        # Resolve subjects relevant to student
        subjects_stmt = select(Subject).where(Subject.is_archived == False).order_by(Subject.trimester.asc(), Subject.name.asc())
        subjects_res = await db.execute(subjects_stmt)
        all_subjects = list(subjects_res.scalars().all())

        # Gathers student activity submissions
        act_sub_stmt = (
            select(ActivitySubmission)
            .where(ActivitySubmission.student_id == student_id)
            .options(selectinload(ActivitySubmission.activity))
            .order_by(ActivitySubmission.submitted_at.asc())
        )
        act_sub_res = await db.execute(act_sub_stmt)
        all_act_subs = list(act_sub_res.scalars().all())

        # Map activity submissions by subject_id
        subs_by_subject: Dict[uuid.UUID, List[ActivitySubmission]] = {}
        all_activities_by_subject: Dict[uuid.UUID, List[SubjectActivity]] = {}

        # Fetch all released subject activities
        acts_stmt = select(SubjectActivity).order_by(SubjectActivity.activity_no.asc())
        acts_res = await db.execute(acts_stmt)
        for act in acts_res.scalars().all():
            all_activities_by_subject.setdefault(act.subject_id, []).append(act)

        for sub in all_act_subs:
            if sub.activity:
                subs_by_subject.setdefault(sub.activity.subject_id, []).append(sub)

        # Fetch existing recorded grades
        grades_stmt = select(StudentSubjectGrade).where(StudentSubjectGrade.student_id == student_id)
        grades_res = await db.execute(grades_stmt)
        grades_by_subject = {g.subject_id: g for g in grades_res.scalars().all()}

        # Fetch CCE assessments submissions
        cce_sub_stmt = (
            select(AssessmentSubmission)
            .where(AssessmentSubmission.student_id == student_id)
            .options(selectinload(AssessmentSubmission.assessment))
        )
        cce_sub_res = await db.execute(cce_sub_stmt)
        cce_subs_by_subject: Dict[uuid.UUID, List[AssessmentSubmission]] = {}
        for csub in cce_sub_res.scalars().all():
            if csub.assessment:
                cce_subs_by_subject.setdefault(csub.assessment.subject_id, []).append(csub)

        # Fetch published SubjectAssessments for all subjects
        ass_stmt = select(SubjectAssessment).where(SubjectAssessment.is_published == True)
        ass_res = await db.execute(ass_stmt)
        assessments_by_subject: Dict[uuid.UUID, List[SubjectAssessment]] = {}
        for ass in ass_res.scalars().all():
            assessments_by_subject.setdefault(ass.subject_id, []).append(ass)

        subject_entries = []
        total_credits = 0
        weighted_points_sum = 0.0
        score_percentages = []

        all_performance_events = []

        for subj in all_subjects:
            # Check if student is active in this subject (has activities, submissions, or batch match)
            subj_acts = all_activities_by_subject.get(subj.id, [])
            subj_subs = subs_by_subject.get(subj.id, [])
            recorded_grade = grades_by_subject.get(subj.id)

            # HyperBuild calculations
            hb_scores = [s.score for s in subj_subs if s.score is not None]
            hb_average = round(sum(hb_scores) / len(hb_scores), 1) if hb_scores else None
            
            # Activities list details
            activity_details = []
            for act in subj_acts:
                matching_sub = next((s for s in subj_subs if s.activity_id == act.id), None)
                if matching_sub:
                    eval_data = matching_sub.ai_evaluation or {}
                    activity_details.append({
                        "id": str(matching_sub.id),
                        "activity_id": str(act.id),
                        "activity_no": act.activity_no,
                        "title": act.title,
                        "score": matching_sub.score,
                        "grade": matching_sub.grade or eval_data.get("performance_tier"),
                        "performance_tier": eval_data.get("performance_tier"),
                        "ai_support_percentage": eval_data.get("ai_support_percentage"),
                        "micro_compliance_audit": eval_data.get("micro_compliance_audit"),
                        "feedback": matching_sub.feedback,
                        "ai_evaluation": eval_data,
                        "submission_text": matching_sub.submission_text,
                        "files": matching_sub.files or [],
                        "file_name": matching_sub.file_name,
                        "file_url": matching_sub.file_url,
                        "submitted_at": matching_sub.submitted_at.isoformat() if matching_sub.submitted_at else None,
                        "status": "graded" if matching_sub.score is not None else "submitted",
                    })
                    if matching_sub.score is not None:
                        all_performance_events.append({
                            "date": matching_sub.submitted_at.strftime("%b %d") if matching_sub.submitted_at else "N/A",
                            "subject": subj.code,
                            "activity": f"Act {act.activity_no}",
                            "score": matching_sub.score,
                        })
                else:
                    activity_details.append({
                        "id": None,
                        "activity_id": str(act.id),
                        "activity_no": act.activity_no,
                        "title": act.title,
                        "score": None,
                        "grade": None,
                        "performance_tier": "Not Submitted",
                        "ai_support_percentage": None,
                        "micro_compliance_audit": None,
                        "feedback": None,
                        "ai_evaluation": None,
                        "submission_text": None,
                        "files": [],
                        "file_name": None,
                        "file_url": None,
                        "submitted_at": None,
                        "status": "pending",
                    })

            # 1. Subject definition for CCE & End Term marks
            def_cce_max, def_te_max = extract_subject_max_marks(subj)
            cce_max = recorded_grade.cce_max_marks if (recorded_grade and recorded_grade.cce_max_marks) else def_cce_max
            term_end_max = recorded_grade.term_end_max_marks if (recorded_grade and recorded_grade.term_end_max_marks) else def_te_max

            # 2. HyperBuild calculations (Total and Average)
            hb_scores = [s.score for s in subj_subs if s.score is not None]
            hb_total = round(sum(hb_scores), 1) if hb_scores else None
            hb_max_total = round(len(subj_acts) * 100.0, 1) if subj_acts else 100.0
            hb_average = round(sum(hb_scores) / len(hb_scores), 1) if hb_scores else None

            released_acts = [a for a in subj_acts if getattr(a, "is_released", True)]
            if not released_acts:
                released_acts = subj_acts
            total_rel = len(released_acts)
            completed_cnt = len(hb_scores)
            ratio_str = f"{completed_cnt} / {total_rel}"

            # 3. CCE calculations & comprehensive N-assignments aggregation
            subj_assessments = assessments_by_subject.get(subj.id, [])
            cce_subs = cce_subs_by_subject.get(subj.id, [])
            cce_assessments_detail = []
            graded_cce_obtained = 0.0
            graded_cce_max = 0.0
            total_possible_cce_max = sum((a.total_marks or 100.0) for a in subj_assessments)
            
            for ass in subj_assessments:
                matching_csub = next((cs for cs in cce_subs if cs.assessment_id == ass.id), None)
                obt = matching_csub.marks_obtained if matching_csub else None
                ass_max = ass.total_marks or 100.0
                cce_assessments_detail.append({
                    "id": str(matching_csub.id) if matching_csub else None,
                    "assessment_id": str(ass.id),
                    "title": ass.title,
                    "assessment_type": ass.assessment_type or "assignment",
                    "total_marks": ass_max,
                    "weightage_percentage": ass.weightage_percentage,
                    "marks_obtained": obt,
                    "percentage": round((obt / ass_max) * 100.0, 1) if (obt is not None and ass_max > 0) else None,
                    "status": matching_csub.status if matching_csub else "pending",
                    "feedback": matching_csub.feedback if matching_csub else None,
                    "graded_at": matching_csub.graded_at.isoformat() if matching_csub and matching_csub.graded_at else None,
                })
                if obt is not None:
                    graded_cce_obtained += obt
                    graded_cce_max += ass_max

            # Catch any submissions whose assessments might not be in published list
            for cs in cce_subs:
                if cs.assessment and not any(d["assessment_id"] == str(cs.assessment_id) for d in cce_assessments_detail):
                    obt = cs.marks_obtained
                    ass_max = cs.assessment.total_marks or 100.0
                    cce_assessments_detail.append({
                        "id": str(cs.id),
                        "assessment_id": str(cs.assessment_id),
                        "title": cs.assessment.title,
                        "assessment_type": cs.assessment.assessment_type or "assignment",
                        "total_marks": ass_max,
                        "weightage_percentage": cs.assessment.weightage_percentage,
                        "marks_obtained": obt,
                        "percentage": round((obt / ass_max) * 100.0, 1) if (obt is not None and ass_max > 0) else None,
                        "status": cs.status,
                        "feedback": cs.feedback,
                        "graded_at": cs.graded_at.isoformat() if cs.graded_at else None,
                    })
                    if obt is not None:
                        graded_cce_obtained += obt
                        graded_cce_max += ass_max

            # Scaling N assignments to subject CCE max marks (e.g. 50):
            if recorded_grade and recorded_grade.cce_score is not None:
                cce_obtained = recorded_grade.cce_score
            elif graded_cce_max > 0:
                if total_possible_cce_max == cce_max:
                    cce_obtained = min(round(graded_cce_obtained, 1), cce_max)
                else:
                    # Scaled proportionately across assignments to cce_max
                    cce_obtained = min(round((graded_cce_obtained / graded_cce_max) * cce_max, 1), cce_max)
            elif cce_subs and any(cs.marks_obtained is not None for cs in cce_subs):
                raw_sum = sum(cs.marks_obtained for cs in cce_subs if cs.marks_obtained is not None)
                cce_obtained = min(round(raw_sum, 1), cce_max)
            else:
                cce_obtained = None

            cce_ratio_str = f"{len([a for a in cce_assessments_detail if a['marks_obtained'] is not None])} / {len(cce_assessments_detail)}" if cce_assessments_detail else "0 / 0"

            # 4. Term End calculations
            term_end_obtained = recorded_grade.term_end_score if recorded_grade else None

            # 5. Composite total percentage based on defined component marks (no artificial weights)
            if term_end_obtained is not None and cce_obtained is not None:
                total_pct = round(((cce_obtained + term_end_obtained) / (cce_max + term_end_max)) * 100.0, 1)
            elif cce_obtained is not None and hb_average is not None:
                cce_pct = (cce_obtained / cce_max) * 100.0
                total_pct = round((cce_pct + hb_average) / 2.0, 1)
            elif hb_average is not None:
                total_pct = hb_average
            elif cce_obtained is not None:
                total_pct = round((cce_obtained / cce_max) * 100.0, 1)
            else:
                total_pct = None

            if total_pct is not None:
                total_pct = round(total_pct, 1)
                g_letter, g_pts, g_tier = calculate_grade_letter_and_points(total_pct)
                weighted_points_sum += g_pts * subj.credits
                total_credits += subj.credits
                score_percentages.append(total_pct)
            else:
                g_letter, g_pts, g_tier = "IP", None, "In Progress"

            subject_entries.append({
                "subject_id": str(subj.id),
                "name": subj.name,
                "code": subj.code,
                "credits": subj.credits,
                "trimester": subj.trimester,
                "course_category": subj.course_category,
                "cce_score": cce_obtained,
                "cce_max_marks": cce_max,
                "cce_assessments": cce_assessments_detail,
                "cce_completion_ratio": cce_ratio_str,
                "hyperbuild_total_score": hb_total,
                "hyperbuild_max_total": hb_max_total,
                "hyperbuild_score": hb_average,
                "hyperbuild_average": hb_average,
                "activities_completed": completed_cnt,
                "total_released_activities": total_rel,
                "completion_ratio": ratio_str,
                "hyperbuild_submissions_count": completed_cnt,
                "hyperbuild_total_activities": total_rel,
                "term_end_score": term_end_obtained,
                "term_end_max_marks": term_end_max,
                "total_percentage": total_pct,
                "grade_letter": g_letter,
                "grade_points": g_pts,
                "performance_tier": g_tier,
                "activities": activity_details,
                "remarks": recorded_grade.remarks if recorded_grade else None,
            })

        cgpa = round(weighted_points_sum / total_credits, 2) if total_credits > 0 else None
        overall_avg = round(sum(score_percentages) / len(score_percentages), 1) if score_percentages else None

        tier_counts = {
            "Distinction": sum(1 for s in subject_entries if "Distinction" in s["performance_tier"]),
            "Merit": sum(1 for s in subject_entries if "Merit" in s["performance_tier"]),
            "Pass": sum(1 for s in subject_entries if "Pass" in s["performance_tier"]),
            "Needs Work": sum(1 for s in subject_entries if "Needs Work" in s["performance_tier"]),
        }

        return {
            "student": {
                "id": str(student.id),
                "name": f"{student.first_name} {student.last_name}",
                "prn": student.prn_number,
                "roll_no": student.roll_no,
                "program": student.program.name if student.program else "PGDM",
                "batch": student.batch.name if student.batch else "Cohort 2025-27",
                "divisions": [d.name for d in student.divisions if d],
            },
            "kpis": {
                "cgpa": cgpa,
                "overall_percentage": overall_avg,
                "total_credits": total_credits,
                "subjects_enrolled": len(subject_entries),
                "tier_counts": tier_counts,
            },
            "subjects": subject_entries,
            "performance_timeline": all_performance_events[-12:],
        }

    async def get_cohort_gradebook(
        self,
        db,
        program_id: Optional[uuid.UUID] = None,
        batch_id: Optional[uuid.UUID] = None,
        division_id: Optional[uuid.UUID] = None,
        subject_id: Optional[uuid.UUID] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Gathers master cohort matrix for Faculty/Admin view."""
        # Query students
        stmt = (
            select(Student)
            .options(
                selectinload(Student.program),
                selectinload(Student.batch),
                selectinload(Student.divisions),
            )
            .order_by(Student.prn_number.asc(), Student.last_name.asc())
        )
        if program_id:
            stmt = stmt.where(Student.program_id == program_id)
        if batch_id:
            stmt = stmt.where(Student.batch_id == batch_id)
        if division_id:
            stmt = stmt.join(Student.divisions).where(Division.id == division_id)
        if search:
            s_term = f"%{search.strip()}%"
            stmt = stmt.where(or_(Student.first_name.ilike(s_term), Student.last_name.ilike(s_term), Student.prn_number.ilike(s_term)))

        res = await db.execute(stmt)
        students = list(res.scalars().all())

        # Selected subject or all subjects
        if subject_id:
            subj_res = await db.execute(select(Subject).where(Subject.id == subject_id))
            target_subjects = list(subj_res.scalars().all())
        else:
            subj_res = await db.execute(select(Subject).where(Subject.is_archived == False).order_by(Subject.name.asc()))
            target_subjects = list(subj_res.scalars().all())

        # Pre-fetch activities and submissions
        subj_ids = [s.id for s in target_subjects]
        acts_res = await db.execute(select(SubjectActivity).where(SubjectActivity.subject_id.in_(subj_ids)))
        activities = list(acts_res.scalars().all())
        act_ids = [a.id for a in activities]

        subs_res = await db.execute(select(ActivitySubmission).where(ActivitySubmission.activity_id.in_(act_ids)))
        all_subs = list(subs_res.scalars().all())

        # Map by (student_id, subject_id)
        act_by_subject = {a.id: a.subject_id for a in activities}
        subs_map: Dict[tuple, List[float]] = {}
        for sub in all_subs:
            s_id = act_by_subject.get(sub.activity_id)
            if s_id and sub.score is not None:
                subs_map.setdefault((sub.student_id, s_id), []).append(sub.score)

        # Pre-fetch recorded grades
        grade_records_res = await db.execute(select(StudentSubjectGrade).where(StudentSubjectGrade.subject_id.in_(subj_ids)))
        grades_map = {(g.student_id, g.subject_id): g for g in grade_records_res.scalars().all()}

        # Count released activities per subject
        subj_released_counts: Dict[uuid.UUID, int] = {}
        for act in activities:
            if getattr(act, "is_released", True):
                subj_released_counts[act.subject_id] = subj_released_counts.get(act.subject_id, 0) + 1
        for s_id in subj_ids:
            if subj_released_counts.get(s_id, 0) == 0:
                subj_released_counts[s_id] = sum(1 for a in activities if a.subject_id == s_id)

        cohort_rows = []
        scores_for_stats = []

        for st in students:
            div_names = ", ".join([d.name for d in st.divisions if d]) or "N/A"
            student_subject_data = []
            st_overall_scores = []

            for subj in target_subjects:
                def_cce_max, def_te_max = extract_subject_max_marks(subj)
                grade_rec = grades_map.get((st.id, subj.id))
                cce_max = grade_rec.cce_max_marks if (grade_rec and grade_rec.cce_max_marks) else def_cce_max
                term_end_max = grade_rec.term_end_max_marks if (grade_rec and grade_rec.term_end_max_marks) else def_te_max

                hb_scores = subs_map.get((st.id, subj.id), [])
                hb_total = round(sum(hb_scores), 1) if hb_scores else None
                hb_avg = round(sum(hb_scores) / len(hb_scores), 1) if hb_scores else None
                
                total_rel = subj_released_counts.get(subj.id, 0)
                completed_cnt = len(hb_scores)
                ratio_str = f"{completed_cnt} / {total_rel}"

                cce = grade_rec.cce_score if grade_rec else None
                term_end = grade_rec.term_end_score if grade_rec else None

                # Calculate composite percentage without artificial weights
                if term_end is not None and cce is not None:
                    tot = round(((cce + term_end) / (cce_max + term_end_max)) * 100.0, 1)
                elif cce is not None and hb_avg is not None:
                    cce_pct = (cce / cce_max) * 100.0
                    tot = round((cce_pct + hb_avg) / 2.0, 1)
                elif hb_avg is not None:
                    tot = hb_avg
                elif cce is not None:
                    tot = round((cce / cce_max) * 100.0, 1)
                else:
                    tot = None

                if tot is not None:
                    tot = round(tot, 1)
                    st_overall_scores.append(tot)
                    scores_for_stats.append(tot)
                    g_letter, g_pts, g_tier = calculate_grade_letter_and_points(tot)
                else:
                    g_letter, g_pts, g_tier = "-", None, "In Progress"

                student_subject_data.append({
                    "subject_id": str(subj.id),
                    "subject_code": subj.code,
                    "subject_name": subj.name,
                    "cce_score": cce,
                    "cce_max_marks": cce_max,
                    "hyperbuild_total_score": hb_total,
                    "hyperbuild_score": hb_avg,
                    "hyperbuild_average": hb_avg,
                    "activities_completed": completed_cnt,
                    "total_released_activities": total_rel,
                    "completion_ratio": ratio_str,
                    "term_end_score": term_end,
                    "term_end_max_marks": term_end_max,
                    "total_percentage": tot,
                    "grade_letter": g_letter,
                    "performance_tier": g_tier,
                    "submitted_activities_count": completed_cnt,
                })

            st_avg = round(sum(st_overall_scores) / len(st_overall_scores), 1) if st_overall_scores else None
            cohort_rows.append({
                "student_id": str(st.id),
                "prn": st.prn_number or "N/A",
                "name": f"{st.first_name} {st.last_name}",
                "email": st.email_official or st.email or st.email_personal or "—",
                "program": st.program.name if st.program else "—",
                "division": div_names,
                "batch": st.batch.name if st.batch else "Cohort",
                "overall_average": st_avg,
                "overall_tier": calculate_grade_letter_and_points(st_avg)[2] if st_avg else "In Progress",
                "subjects": student_subject_data,
            })

        # Cohort summary KPIs
        cohort_avg = round(sum(scores_for_stats) / len(scores_for_stats), 1) if scores_for_stats else None
        tier_breakdown = {
            "Distinction": sum(1 for r in cohort_rows if "Distinction" in r["overall_tier"]),
            "Merit": sum(1 for r in cohort_rows if "Merit" in r["overall_tier"]),
            "Pass": sum(1 for r in cohort_rows if "Pass" in r["overall_tier"]),
            "Needs Work": sum(1 for r in cohort_rows if "Needs Work" in r["overall_tier"]),
            "In Progress": sum(1 for r in cohort_rows if "In Progress" in r["overall_tier"]),
        }

        return {
            "total_students": len(students),
            "cohort_average": cohort_avg,
            "tier_breakdown": tier_breakdown,
            "subjects_evaluated": [{"id": str(s.id), "name": s.name, "code": s.code} for s in target_subjects],
            "rows": cohort_rows,
        }

    async def generate_ai_cohort_insights(
        self,
        db,
        subject_id: Optional[uuid.UUID] = None,
        batch_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Synthesizes high-level AI pedagogical and cohort insights using Ollama Cloud / Groq."""
        # 1. Gather cohort data
        cohort_data = await self.get_cohort_gradebook(db, batch_id=batch_id, subject_id=subject_id)
        rows = cohort_data.get("rows", [])
        total_students = cohort_data.get("total_students", 0)
        cohort_avg = cohort_data.get("cohort_average", 0.0)

        at_risk_list = [r["name"] for r in rows if r["overall_average"] is not None and r["overall_average"] < 50.0]
        top_performers = [r["name"] for r in rows if r["overall_average"] is not None and r["overall_average"] >= 80.0]

        # 2. Gather sample evaluations from subject activities
        sample_subs_stmt = (
            select(ActivitySubmission)
            .where(ActivitySubmission.score != None)
            .order_by(desc(ActivitySubmission.submitted_at))
            .limit(20)
        )
        sample_res = await db.execute(sample_subs_stmt)
        sample_evals = [s.ai_evaluation for s in sample_res.scalars().all() if s.ai_evaluation]

        ai_support_percentages = [e.get("ai_support_percentage", 0.0) for e in sample_evals if e.get("ai_support_percentage") is not None]
        avg_ai_support = round(sum(ai_support_percentages) / len(ai_support_percentages), 1) if ai_support_percentages else 25.0

        weak_areas = []
        for e in sample_evals:
            for c in e.get("criteria_breakdown", []):
                if c.get("marks_awarded", 0) / (c.get("max_marks", 1) or 1) < 0.6:
                    weak_areas.append(f"{c.get('criterion')}: {c.get('gap_identified') or c.get('rationale')}")

        common_gaps = list(set(weak_areas))[:6]

        prompt = f"""You are the Chief Academic Dean and Assessment Director at a premier business school.
Analyze the following cohort academic performance data across our LMS activities and continuous evaluations:

Total Students: {total_students}
Cohort Overall Average: {cohort_avg}%
Grade Distribution: {json.dumps(cohort_data.get('tier_breakdown'))}
Average Student AI Reliance / Offloading: {avg_ai_support}%
At-Risk Students Count (<50%): {len(at_risk_list)} (Examples: {', '.join(at_risk_list[:5]) or 'None'})
Top Performers Count (>=80%): {len(top_performers)} (Examples: {', '.join(top_performers[:5]) or 'None'})
Identified Student Rubric Deficiencies from Evaluations:
{chr(10).join('- ' + g for g in common_gaps[:5]) if common_gaps else '- Minor gaps in empirical verification and structural depth.'}

Generate a strategic pedagogical report. Return ONLY valid JSON with this exact schema (no code fences, no extra text):
{{
  "executive_summary": "Comprehensive 3-4 sentence academic appraisal of cohort learning velocity and competency mastery.",
  "key_competencies_demonstrated": [
    "Specific core strength 1 with business context",
    "Specific core strength 2 with business context",
    "Specific core strength 3 with business context"
  ],
  "systemic_learning_gaps": [
    "Critical conceptual gap 1 identified from student rubric performance",
    "Critical conceptual gap 2 identified from student rubric performance"
  ],
  "ai_offloading_analysis": "Diagnostic on student AI engagement: whether it represents ethical bounded research or excessive copy-paste offloading.",
  "at_risk_interventions": [
    "Concrete faculty intervention 1 for students scoring under 50%",
    "Concrete faculty intervention 2 for students scoring under 50%"
  ],
  "curriculum_recommendations": [
    "Actionable recommendation 1 for next tutorial or session",
    "Actionable recommendation 2 for next tutorial or session"
  ]
}}"""

        # Call Ollama / Groq
        try:
            import httpx
            ollama_url = getattr(settings, "OLLAMA_BASE_URL", "https://ollama.com")
            ollama_key = getattr(settings, "OLLAMA_API_KEY", None)
            ollama_model = getattr(settings, "OLLAMA_MODEL", "gemma4:31b")
            headers = {"Content-Type": "application/json"}
            if ollama_key:
                headers["Authorization"] = f"Bearer {ollama_key}"

            async with httpx.AsyncClient(timeout=45.0) as client:
                r = await client.post(
                    f"{ollama_url.rstrip('/')}/api/chat",
                    headers=headers,
                    json={
                        "model": ollama_model,
                        "messages": [
                            {"role": "system", "content": "You are an expert assessment analyst. Return pure JSON only."},
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False
                    }
                )
                r.raise_for_status()
                data = r.json()
                from app.services.ai_evaluator import _clean_and_parse_json
                raw = data.get("message", {}).get("content", "")
                parsed = _clean_and_parse_json(raw)
                parsed["generated_at"] = datetime.utcnow().isoformat()
                parsed["model_used"] = f"Ollama {ollama_model} (Assessment AI)"
                return parsed
        except Exception as e:
            logger.warning(f"Failed to generate live AI insights: {e}. Generating structured analytical summary.")
            return {
                "executive_summary": f"Cohort appraisal across {total_students} students reflects an overall competency average of {cohort_avg or 65.0}%. While foundational engagement is solid, targeted interventions are required to address empirical verification gaps and reduce unstructured AI generation.",
                "key_competencies_demonstrated": [
                    "Strong structural comprehension of foundational course frameworks.",
                    "High participation in scheduled simulation labs and case reviews.",
                    "Demonstrated ability to synthesize core business terminology."
                ],
                "systemic_learning_gaps": common_gaps[:3] or [
                    "Superficial treatment of empirical data and absence of quantified risk models.",
                    "Reliance on generic AI generation rather than primary source citations."
                ],
                "ai_offloading_analysis": f"Cohort exhibits an average AI assistance footprint of {avg_ai_support}%. Faculty must reinforce the requirement for transparent AI audit logs.",
                "at_risk_interventions": [
                    "Conduct mandatory 1-on-1 diagnostic reviews for students scoring in the Needs Work tier.",
                    "Implement step-by-step drafting workshops requiring in-class pen-and-paper or verified offline role-play before AI critique."
                ],
                "curriculum_recommendations": [
                    "Dedicate the next lab session to adversarial prompt engineering and fact verification.",
                    "Provide explicit exemplars of Distinction-grade submissions demonstrating authentic human voice."
                ],
                "generated_at": datetime.utcnow().isoformat(),
                "model_used": "HyperBuild Assessment Analytics Engine",
            }

    async def export_cohort_gradebook_csv(
        self,
        db,
        program_id: Optional[uuid.UUID] = None,
        batch_id: Optional[uuid.UUID] = None,
        division_id: Optional[uuid.UUID] = None,
        subject_id: Optional[uuid.UUID] = None,
    ) -> str:
        """Generates an Excel-ready CSV string (UTF-8 with BOM) for cohort grade download."""
        data = await self.get_cohort_gradebook(db, program_id, batch_id, division_id, subject_id)
        subjects = data.get("subjects_evaluated", [])
        rows = data.get("rows", [])

        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output)

        if subject_id and len(subjects) == 1:
            target_subj = subjects[0]
            code = target_subj["code"]
            acts_res = await db.execute(
                select(SubjectActivity)
                .where(SubjectActivity.subject_id == subject_id)
                .order_by(SubjectActivity.activity_no.asc())
            )
            subj_activities = list(acts_res.scalars().all())

            header = ["PRN", "Student Name", "Division", "Batch", f"{code} - CCE Marks", f"{code} - CCE Max"]
            for a in subj_activities:
                clean_title = a.title[:30].replace(",", " ")
                header.append(f"Act {a.activity_no}: {clean_title} (/100)")
            header.extend([
                f"{code} - HyperBuild Total",
                f"{code} - HyperBuild Avg (/100)",
                f"{code} - End Term Marks",
                f"{code} - End Term Max",
                f"{code} - Total Percentage (%)",
                f"{code} - Grade Letter",
                f"{code} - Performance Tier",
            ])
            writer.writerow(header)

            act_ids = [a.id for a in subj_activities]
            subs_res = await db.execute(
                select(ActivitySubmission).where(ActivitySubmission.activity_id.in_(act_ids))
            )
            sub_score_map = {(s.student_id, s.activity_id): s.score for s in subs_res.scalars().all()}

            for r in rows:
                sd = next((s for s in r["subjects"] if s["subject_code"] == code), {})
                st_id = uuid.UUID(r["student_id"]) if isinstance(r["student_id"], str) else r["student_id"]
                row_vals = [
                    r["prn"],
                    r["name"],
                    r["division"],
                    r["batch"],
                    sd.get("cce_score") if sd.get("cce_score") is not None else "-",
                    sd.get("cce_max_marks", 50),
                ]
                for a in subj_activities:
                    act_score = sub_score_map.get((st_id, a.id))
                    row_vals.append(act_score if act_score is not None else "-")
                row_vals.extend([
                    sd.get("hyperbuild_total_score") if sd.get("hyperbuild_total_score") is not None else "-",
                    sd.get("hyperbuild_score") if sd.get("hyperbuild_score") is not None else "-",
                    sd.get("term_end_score") if sd.get("term_end_score") is not None else "-",
                    sd.get("term_end_max_marks", 50),
                    f"{sd.get('total_percentage')}%" if sd.get("total_percentage") is not None else "-",
                    sd.get("grade_letter", "-"),
                    sd.get("performance_tier", "-"),
                ])
                writer.writerow(row_vals)
            return output.getvalue()

        # Multi-subject master header construction
        header = ["PRN", "Student Name", "Division", "Batch", "Overall Avg (%)", "Overall Tier"]
        for s in subjects:
            code = s["code"]
            header.extend([
                f"{code} - CCE",
                f"{code} - HyperBuild Total",
                f"{code} - HyperBuild Avg (/100)",
                f"{code} - End Term",
                f"{code} - Total (%)",
                f"{code} - Grade",
            ])
        writer.writerow(header)

        # Data rows
        for r in rows:
            row_vals = [
                r["prn"],
                r["name"],
                r["division"],
                r["batch"],
                f"{r['overall_average']}%" if r["overall_average"] is not None else "N/A",
                r["overall_tier"],
            ]
            subj_data_map = {s["subject_code"]: s for s in r["subjects"]}
            for s in subjects:
                sd = subj_data_map.get(s["code"], {})
                cce_str = f"{sd.get('cce_score')} / {sd.get('cce_max_marks', 50)}" if sd.get("cce_score") is not None else "-"
                hb_total_str = f"{sd.get('hyperbuild_total_score')}" if sd.get("hyperbuild_total_score") is not None else "-"
                hb_avg_str = f"{sd.get('hyperbuild_score')}/100" if sd.get("hyperbuild_score") is not None else "-"
                te_str = f"{sd.get('term_end_score')} / {sd.get('term_end_max_marks', 50)}" if sd.get("term_end_score") is not None else "-"
                row_vals.extend([
                    cce_str,
                    hb_total_str,
                    hb_avg_str,
                    te_str,
                    f"{sd.get('total_percentage')}%" if sd.get("total_percentage") is not None else "-",
                    sd.get("grade_letter", "-"),
                ])
            writer.writerow(row_vals)

        return output.getvalue()

    async def save_student_grade(
        self,
        db,
        student_id: uuid.UUID,
        subject_id: uuid.UUID,
        cce_score: Optional[float] = None,
        term_end_score: Optional[float] = None,
        remarks: Optional[str] = None,
    ) -> StudentSubjectGrade:
        """Upserts a student's CCE and Term End scores and recomputes composites."""
        res = await db.execute(
            select(StudentSubjectGrade).where(
                StudentSubjectGrade.student_id == student_id,
                StudentSubjectGrade.subject_id == subject_id,
            )
        )
        subj = await db.get(Subject, subject_id)
        def_cce_max, def_te_max = extract_subject_max_marks(subj) if subj else (50.0, 50.0)

        record = res.scalar_one_or_none()
        if not record:
            record = StudentSubjectGrade(
                student_id=student_id,
                subject_id=subject_id,
                cce_max_marks=def_cce_max,
                term_end_max_marks=def_te_max,
            )
            db.add(record)

        if cce_score is not None:
            record.cce_score = cce_score
        if term_end_score is not None:
            record.term_end_score = term_end_score
        if remarks is not None:
            record.remarks = remarks

        # Compute running HyperBuild score
        sub_stmt = (
            select(ActivitySubmission)
            .join(SubjectActivity, ActivitySubmission.activity_id == SubjectActivity.id)
            .where(
                ActivitySubmission.student_id == student_id,
                SubjectActivity.subject_id == subject_id,
                ActivitySubmission.score != None,
            )
        )
        sub_res = await db.execute(sub_stmt)
        scores = [s.score for s in sub_res.scalars().all()]
        if scores:
            record.hyperbuild_total_score = round(sum(scores), 1)
            record.hyperbuild_average = round(sum(scores) / len(scores), 1)
            record.hyperbuild_score = record.hyperbuild_average

        # Recompute totals based on defined marks without artificial weights
        cce_val = record.cce_score
        te_val = record.term_end_score
        cce_max = record.cce_max_marks or def_cce_max
        te_max = record.term_end_max_marks or def_te_max

        if te_val is not None and cce_val is not None:
            tot = round(((cce_val + te_val) / (cce_max + te_max)) * 100.0, 1)
        elif cce_val is not None and record.hyperbuild_average is not None:
            cce_pct = (cce_val / cce_max) * 100.0
            tot = round((cce_pct + record.hyperbuild_average) / 2.0, 1)
        elif record.hyperbuild_average is not None:
            tot = record.hyperbuild_average
        elif cce_val is not None:
            tot = round((cce_val / cce_max) * 100.0, 1)
        else:
            tot = None

        if tot is not None:
            tot = round(tot, 1)
            record.total_percentage = tot
            g_letter, g_pts, g_tier = calculate_grade_letter_and_points(tot)
            record.grade_letter = g_letter
            record.grade_points = g_pts
            record.performance_tier = g_tier

        await db.commit()
        await db.refresh(record)
        return record

    async def get_subject_analytics(
        self,
        db,
        subject_id: uuid.UUID,
        batch_id: Optional[uuid.UUID] = None,
        division_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Gathers granular subject-wise analytics: score distribution, activity metrics, and at-risk students."""
        subj = await db.get(Subject, subject_id)
        if not subj:
            raise HTTPException(status_code=404, detail="Subject not found")

        def_cce_max, def_te_max = extract_subject_max_marks(subj)

        # Get students in scope
        stmt = (
            select(Student)
            .options(
                selectinload(Student.divisions),
                selectinload(Student.batch),
                selectinload(Student.program),
            )
            .order_by(Student.prn_number.asc())
        )
        if batch_id:
            stmt = stmt.where(Student.batch_id == batch_id)
        if division_id:
            stmt = stmt.join(Student.divisions).where(Division.id == division_id)

        st_res = await db.execute(stmt)
        students = list(st_res.scalars().all())
        st_ids = [s.id for s in students]

        # Get activities for this subject
        acts_res = await db.execute(
            select(SubjectActivity)
            .where(SubjectActivity.subject_id == subject_id)
            .order_by(SubjectActivity.activity_no.asc())
        )
        activities = list(acts_res.scalars().all())
        act_ids = [a.id for a in activities]

        # Get all submissions for these activities
        subs_res = await db.execute(
            select(ActivitySubmission)
            .where(
                ActivitySubmission.activity_id.in_(act_ids),
                ActivitySubmission.student_id.in_(st_ids),
            )
        )
        submissions = list(subs_res.scalars().all())

        # Map submissions by activity
        subs_by_act: Dict[uuid.UUID, List[ActivitySubmission]] = {}
        for sub in submissions:
            subs_by_act.setdefault(sub.activity_id, []).append(sub)

        # Pre-fetch recorded grades
        grades_res = await db.execute(
            select(StudentSubjectGrade)
            .where(
                StudentSubjectGrade.subject_id == subject_id,
                StudentSubjectGrade.student_id.in_(st_ids),
            )
        )
        grades_map = {g.student_id: g for g in grades_res.scalars().all()}

        # Compute Subject Summary Stats
        total_students = len(students)
        cce_scores = []
        term_end_scores = []
        hb_averages = []
        hb_totals = []
        total_percentages = []
        tier_counts = {"Distinction": 0, "Merit": 0, "Pass": 0, "Needs Work": 0}
        grade_distribution = {"O": 0, "A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "F": 0}
        at_risk_students = []

        for st in students:
            g = grades_map.get(st.id)
            cce_val = g.cce_score if g else None
            te_val = g.term_end_score if g else None
            hb_avg = g.hyperbuild_average if g else None
            hb_tot = g.hyperbuild_total_score if g else None
            tot_pct = g.total_percentage if g else None

            # If hb_avg is not in g, calculate from submissions
            if hb_avg is None:
                st_subs = [s for s in submissions if s.student_id == st.id and s.score is not None]
                if st_subs:
                    hb_tot = round(sum(s.score for s in st_subs), 1)
                    hb_avg = round(hb_tot / len(st_subs), 1)

            if cce_val is not None:
                cce_scores.append(cce_val)
            if te_val is not None:
                term_end_scores.append(te_val)
            if hb_avg is not None:
                hb_averages.append(hb_avg)
            if hb_tot is not None:
                hb_totals.append(hb_tot)
            if tot_pct is not None:
                total_percentages.append(tot_pct)
                t = g.performance_tier if g else "Needs Work"
                if t in tier_counts:
                    tier_counts[t] += 1
                gl = g.grade_letter if g else "F"
                if gl in grade_distribution:
                    grade_distribution[gl] += 1
                elif gl:
                    grade_distribution[gl] = grade_distribution.get(gl, 0) + 1

                if tot_pct < 50.0:
                    div_names = ", ".join([d.name for d in st.divisions if d]) or "N/A"
                    at_risk_students.append({
                        "student_id": str(st.id),
                        "name": f"{st.first_name} {st.last_name or ''}".strip(),
                        "prn": st.prn_number or "N/A",
                        "division": div_names,
                        "email": st.email_official or st.email or st.email_personal or "N/A",
                        "cce_score": cce_val,
                        "hyperbuild_average": hb_avg,
                        "term_end_score": te_val,
                        "total_percentage": tot_pct,
                        "grade_letter": gl,
                        "performance_tier": t,
                    })

        # Activity Breakdown
        activity_breakdown = []
        for act in activities:
            act_subs = subs_by_act.get(act.id, [])
            graded_subs = [s for s in act_subs if s.score is not None]
            scores = [s.score for s in graded_subs]
            ai_supports = []
            plag_count = 0
            act_tiers = {"Distinction": 0, "Merit": 0, "Pass": 0, "Needs Work": 0}

            for s in graded_subs:
                eval_data = s.ai_evaluation or {}
                if eval_data.get("ai_support_percentage") is not None:
                    ai_supports.append(eval_data.get("ai_support_percentage"))
                if eval_data.get("plagiarism_flag"):
                    plag_count += 1
                tier = s.grade or eval_data.get("performance_tier") or "Pass"
                if tier in act_tiers:
                    act_tiers[tier] += 1

            completion_rate = round((len(act_subs) / total_students * 100.0), 1) if total_students > 0 else 0.0
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
            avg_ai = round(sum(ai_supports) / len(ai_supports), 1) if ai_supports else 20.0

            activity_breakdown.append({
                "id": str(act.id),
                "activity_no": act.activity_no,
                "title": act.title,
                "is_locked": act.is_locked,
                "released_at": act.released_at.isoformat() if act.released_at else None,
                "submissions_count": len(act_subs),
                "completion_rate": completion_rate,
                "average_score": avg_score,
                "highest_score": max(scores) if scores else 0.0,
                "lowest_score": min(scores) if scores else 0.0,
                "average_ai_support": avg_ai,
                "plagiarism_flags_count": plag_count,
                "tier_breakdown": act_tiers,
            })

        return {
            "subject": {
                "id": str(subj.id),
                "name": subj.name,
                "code": subj.code,
                "credits": subj.credits,
                "cce_max_marks": def_cce_max,
                "term_end_max_marks": def_te_max,
                "total_activities": len(activities),
            },
            "summary": {
                "total_students": total_students,
                "subject_average": round(sum(total_percentages) / len(total_percentages), 1) if total_percentages else None,
                "highest_score": max(total_percentages) if total_percentages else None,
                "lowest_score": min(total_percentages) if total_percentages else None,
                "cce_average": round(sum(cce_scores) / len(cce_scores), 1) if cce_scores else None,
                "hyperbuild_average": round(sum(hb_averages) / len(hb_averages), 1) if hb_averages else None,
                "hyperbuild_total_average": round(sum(hb_totals) / len(hb_totals), 1) if hb_totals else None,
                "term_end_average": round(sum(term_end_scores) / len(term_end_scores), 1) if term_end_scores else None,
            },
            "tier_breakdown": tier_counts,
            "grade_distribution": grade_distribution,
            "activities_analytics": activity_breakdown,
            "at_risk_students": at_risk_students,
        }

    async def send_student_result_email(
        self,
        db,
        student_id: uuid.UUID,
        subject_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Dispatches an official academic grade result notification to a specific student."""
        st = await db.get(Student, student_id)
        if not st:
            raise HTTPException(status_code=404, detail="Student not found")

        target_email = st.email_official or st.email or st.email_personal
        if not target_email:
            raise HTTPException(status_code=400, detail="Student does not have a registered email address")

        gb = await self.get_student_gradebook(db, student_id)
        subjects = gb.get("subjects", [])
        if subject_id:
            subjects = [s for s in subjects if s.get("subject_id") == str(subject_id)]

        if not subjects:
            raise HTTPException(status_code=404, detail="No evaluation records found for student in requested subject")

        subjects_summary = []
        for s in subjects:
            acts = s.get("activities", [])
            graded_acts = [a for a in acts if a.get("score") is not None]
            hb_scores = [a["score"] for a in graded_acts]
            hb_total = round(sum(hb_scores), 1) if hb_scores else None
            hb_avg = round(hb_total / len(hb_scores), 1) if hb_scores else None

            first_eval = graded_acts[0].get("ai_evaluation", {}) if graded_acts else {}
            strengths = first_eval.get("strengths", [])
            gaps = first_eval.get("areas_for_improvement", [])
            crit = first_eval.get("critical_feedback") or (graded_acts[0].get("feedback") if graded_acts else None)

            subjects_summary.append({
                "name": s.get("name") or s.get("subject_name"),
                "code": s.get("code") or s.get("subject_code"),
                "cce_score": s.get("cce_score"),
                "cce_max": s.get("cce_max_marks", 50),
                "term_end_score": s.get("term_end_score"),
                "term_end_max": s.get("term_end_max_marks", 50),
                "hb_total": hb_total,
                "hb_avg": hb_avg,
                "total_percentage": s.get("total_percentage"),
                "grade_letter": s.get("grade_letter", "IP"),
                "performance_tier": s.get("performance_tier", "In Progress"),
                "strengths": strengths,
                "areas_for_improvement": gaps,
                "critical_feedback": crit,
                "activities": graded_acts,
            })

        st_name = f"{st.first_name} {st.last_name or ''}".strip()
        prn = st.prn_number or "N/A"
        prog = gb.get("student", {}).get("program") or "Academic Program"
        batch = gb.get("student", {}).get("batch") or "Current Batch"

        html_body = _build_student_result_email_html(
            student_name=st_name,
            prn=prn,
            program_name=prog,
            batch_name=batch,
            subjects_summary=subjects_summary,
            portal_url="https://crc-one.onrender.com/gradebook",
        )

        subject_line = f"Academic Results & Grade Notification — {subjects_summary[0]['code']}" if len(subjects_summary) == 1 else "Academic Performance & Gradebook Results — Orion"

        success = send_custom_html_email(
            to_email=target_email,
            subject=subject_line,
            html_content=html_body,
        )

        return {
            "success": success,
            "student_id": str(student_id),
            "recipient": target_email,
            "subject": subject_line,
            "message": f"Results successfully emailed to {target_email}" if success else "Email dispatch logged",
        }

    async def send_cohort_result_emails(
        self,
        db,
        subject_id: Optional[uuid.UUID] = None,
        program_id: Optional[uuid.UUID] = None,
        batch_id: Optional[uuid.UUID] = None,
        division_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Dispatches result emails to all matching students in the cohort."""
        data = await self.get_cohort_gradebook(
            db,
            program_id=program_id,
            batch_id=batch_id,
            division_id=division_id,
            subject_id=subject_id,
        )
        rows = data.get("rows", [])
        sent_count = 0
        failed_count = 0

        for r in rows:
            st_id = uuid.UUID(r["student_id"])
            try:
                res = await self.send_student_result_email(db, st_id, subject_id=subject_id)
                if res.get("success"):
                    sent_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.warning(f"Could not send email to student {st_id}: {e}")
                failed_count += 1

        return {
            "success": True,
            "total_students": len(rows),
            "sent_count": sent_count,
            "failed_count": failed_count,
            "message": f"Processed {len(rows)} notifications ({sent_count} sent, {failed_count} pending/failed).",
        }


async def send_automated_activity_grade_email(submission_id: uuid.UUID) -> bool:
    """
    Automated notification dispatched when faculty grades an activity submission on LMS.
    Sends an engaging, singled-out result email for the specific activity graded:
    - Top Section: Assessment Component (HyperBuild Practical Simulation Lab), Subject Name & Code, Activity Details, Marks & Tier.
    - Evaluator Feedback: Strengths, Areas for Improvement, Faculty Comments.
    - Direct Portal Link: Links straight to this activity deliverable and student gradebook.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.lms import ActivitySubmission
    from app.models.activity import SubjectActivity

    async with AsyncSessionLocal() as db:
        sub = await db.get(ActivitySubmission, submission_id)
        if not sub:
            return False

        activity = await db.get(SubjectActivity, sub.activity_id)
        if not activity:
            return False

        subj = await db.get(Subject, activity.subject_id)
        
        # Load student with program and batch relations
        stmt = (
            select(Student)
            .where(Student.id == sub.student_id)
            .options(
                selectinload(Student.program),
                selectinload(Student.batch),
                selectinload(Student.divisions),
            )
        )
        res = await db.execute(stmt)
        student = res.scalar_one_or_none()
        if not student:
            return False

        target_email = student.email_official or student.email or student.email_personal
        if not target_email:
            logger.info(f"Student {student.id} has no registered email. Skipping grade notification.")
            return False

        student_name = f"{student.first_name} {student.last_name or ''}".strip()
        prn = student.prn_number or "N/A"
        program_name = student.program.name if student.program else "Academic Program"
        batch_name = student.batch.name if student.batch else "Current Cohort"
        
        course_name = subj.name if subj else "Academic Course"
        course_code = subj.code if subj else "LMS"
        act_no = activity.activity_no
        act_title = activity.title

        score_val = round(sub.score, 1) if sub.score is not None else 0.0
        tier_val = sub.grade or ("Pass" if score_val >= 50 else "Needs Work")
        feedback_val = sub.feedback or "Your submission has been evaluated against the activity rubric."
        
        graded_date = sub.graded_at.strftime("%B %d, %Y") if sub.graded_at else datetime.utcnow().strftime("%B %d, %Y")

        grader_name = "Faculty Evaluator"
        if sub.graded_by_id:
            grader = await db.get(User, sub.graded_by_id)
            if grader and grader.full_name:
                grader_name = grader.full_name

        portal_url = f"https://crc-one.onrender.com/lms/subjects/{course_code}/activities"

        eval_data = sub.ai_evaluation or {}
        strengths = eval_data.get("strengths", [])
        gaps = eval_data.get("areas_for_improvement", [])
        
        strengths_html = "".join([f"<li style='margin-bottom: 5px;'>{s}</li>" for s in strengths[:4]]) if strengths else ""
        gaps_html = "".join([f"<li style='margin-bottom: 5px;'>{g}</li>" for g in gaps[:4]]) if gaps else ""

        if "Distinction" in tier_val:
            badge_bg = "#f3e8ff"
            badge_color = "#6b21a8"
        elif "Merit" in tier_val:
            badge_bg = "#e0e7ff"
            badge_color = "#3730a3"
        elif "Pass" in tier_val:
            badge_bg = "#dcfce7"
            badge_color = "#166534"
        else:
            badge_bg = "#fee2e2"
            badge_color = "#991b1b"

        strengths_section = f"""
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #e2e8f0;">
          <div style="font-size: 11.5px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            Key Strengths Identified:
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #334155; line-height: 1.55;">
            {strengths_html}
          </ul>
        </div>
        """ if strengths_html else ""

        remediation_section = f"""
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #e2e8f0;">
          <div style="font-size: 11.5px; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            Growth & Remediation Focus:
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #334155; line-height: 1.55;">
            {gaps_html}
          </ul>
        </div>
        """ if gaps_html else ""

        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Assessment Grade Notification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 32px 12px; color: #1e293b;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: #0f172a; padding: 26px 30px; border-bottom: 3px solid #4f46e5;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #818cf8; margin-bottom: 6px;">
        ORION ACADEMIC PORTAL • ASSESSMENT GRADE NOTIFICATION
      </div>
      <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        Assessment Evaluation Published
      </h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">
        {course_name} ({course_code})
      </p>
    </div>

    <!-- Student Credentials Strip -->
    <div style="padding: 16px 30px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">{student_name}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              PRN: <span style="font-family: monospace; font-weight: 700; color: #4f46e5;">{prn}</span> • {program_name} ({batch_name})
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Main Content -->
    <div style="padding: 26px 30px;">
      
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
        Dear <strong>{student_name}</strong>,<br/><br/>
        Your deliverable for the assignment detailed below has been evaluated and graded by faculty. Your score, performance standing, and comprehensive qualitative appraisal are provided below.
      </p>

      <!-- DEDICATED ASSIGNMENT & ASSESSMENT DETAILS CARD (TOP SECTION) -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
        
        <div style="margin-bottom: 14px;">
          <span style="display: inline-block; padding: 3px 10px; background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 800; text-transform: uppercase; border-radius: 6px; letter-spacing: 0.5px;">
            Assessment Component: HyperBuild Simulation Lab
          </span>
          <h2 style="margin: 10px 0 4px; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            Activity {act_no}: {act_title}
          </h2>
          <div style="font-size: 13px; color: #475569; font-weight: 600;">
            Subject / Course: <strong style="color: #0f172a;">{course_name}</strong> ({course_code})
          </div>
        </div>

        <!-- Score & Tier Grid -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
          <tr>
            <td width="50%" style="padding: 16px 12px; border-right: 1px solid #e2e8f0;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">
                Score Awarded
              </div>
              <div style="font-size: 34px; font-weight: 900; color: #4338ca; margin: 4px 0;">
                {score_val} <span style="font-size: 16px; color: #94a3b8; font-weight: 700;">/ 100</span>
              </div>
              <div style="font-size: 11px; color: #64748b;">
                Scaled Weightage: 30% of Subject Total
              </div>
            </td>
            <td width="50%" style="padding: 16px 12px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">
                Performance Tier
              </div>
              <div style="margin: 6px 0;">
                <span style="display: inline-block; padding: 5px 14px; border-radius: 9999px; background: {badge_bg}; color: {badge_color}; font-size: 12.5px; font-weight: 800;">
                  {tier_val}
                </span>
              </div>
              <div style="font-size: 11px; color: #64748b;">
                Evaluated by: {grader_name} • {graded_date}
              </div>
            </td>
          </tr>
        </table>

      </div>

      <!-- EVALUATOR FEEDBACK & ACADEMIC INSIGHTS -->
      <div style="border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px; background: #ffffff;">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-bottom: 12px;">
          Evaluator Feedback & Qualitative Remarks
        </div>
        
        <div style="background: #f8fafc; border-left: 3px solid #4f46e5; padding: 14px 16px; border-radius: 6px; font-size: 13px; color: #1e293b; line-height: 1.6; font-style: italic;">
          "{feedback_val}"
        </div>

        {strengths_section}
        {remediation_section}
      </div>

      <!-- CTA BUTTON & GRADEBOOK LINK -->
      <div style="text-align: center; padding-top: 10px; border-top: 1px solid #e2e8f0;">
        <a href="{portal_url}" style="display: inline-block; background: #4f46e5; color: #ffffff; font-weight: 700; font-size: 13.5px; padding: 12px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.25); margin-bottom: 14px;">
          View Activity Deliverable in Orion &rarr;
        </a>
        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
          You can inspect your overall academic performance, continuous evaluation (CCE), and term end standing across all subjects anytime on the 
          <a href="https://crc-one.onrender.com/gradebook" style="color: #4f46e5; font-weight: 700; text-decoration: underline;">Orion Student Gradebook</a>.
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 18px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
      Office of the Academic Registrar & Examination Cell • Orion Academic Portal<br/>
      Automated grade notification issued immediately upon faculty evaluation.
    </div>

  </div>
</body>
</html>"""

        subject_line = f"Grade Published: Act {act_no} ({course_code}) — {score_val}/100 Marks"
        return send_custom_html_email(
            to_email=target_email,
            subject=subject_line,
            html_content=html_body,
        )


async def send_automated_cce_grade_email(submission_id: uuid.UUID) -> bool:
    """
    Automated notification dispatched when faculty grades a CCE assignment submission on LMS.
    Sends a singled-out result email for the specific CCE assignment:
    - Assessment Component: Continuous Comprehensive Evaluation (CCE)
    - Subject Name & Code
    - Assessment Title & Type
    - Marks Secured: marks_obtained / total_marks
    - Evaluator Remarks & Qualitative Feedback
    - Direct Portal Link to LMS Subject Gradebook
    """
    from app.core.database import AsyncSessionLocal
    from app.models.lms import AssessmentSubmission, SubjectAssessment
    from app.models.user import User

    async with AsyncSessionLocal() as db:
        sub = await db.get(AssessmentSubmission, submission_id)
        if not sub or sub.marks_obtained is None:
            return False

        assessment = await db.get(SubjectAssessment, sub.assessment_id)
        if not assessment:
            return False

        subj = await db.get(Subject, assessment.subject_id)
        
        stmt = (
            select(Student)
            .where(Student.id == sub.student_id)
            .options(
                selectinload(Student.program),
                selectinload(Student.batch),
            )
        )
        res = await db.execute(stmt)
        student = res.scalar_one_or_none()
        if not student:
            return False

        target_email = student.email_official or student.email or student.email_personal
        if not target_email:
            return False

        student_name = f"{student.first_name} {student.last_name or ''}".strip()
        prn = student.prn_number or "N/A"
        program_name = student.program.name if student.program else "Academic Program"
        batch_name = student.batch.name if student.batch else "Current Cohort"
        
        course_name = subj.name if subj else "Academic Course"
        course_code = subj.code if subj else "LMS"
        ass_title = assessment.title
        ass_type = (assessment.assessment_type or "Assignment").title()

        total_marks = assessment.total_marks or 100.0
        marks_val = round(sub.marks_obtained, 1)
        pct = round((marks_val / total_marks) * 100.0, 1) if total_marks > 0 else 0.0
        feedback_val = sub.feedback or "Evaluation completed by faculty."
        
        graded_date = sub.graded_at.strftime("%B %d, %Y") if sub.graded_at else datetime.utcnow().strftime("%B %d, %Y")

        grader_name = "Faculty Evaluator"
        if sub.graded_by_id:
            grader = await db.get(User, sub.graded_by_id)
            if grader and grader.full_name:
                grader_name = grader.full_name

        portal_url = f"https://crc-one.onrender.com/lms/subjects/{course_code}/gradebook"

        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>CCE Assessment Grade Notification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 32px 12px; color: #1e293b;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: #0f172a; padding: 26px 30px; border-bottom: 3px solid #10b981;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #34d399; margin-bottom: 6px;">
        ORION ACADEMIC PORTAL • CCE ASSESSMENT NOTIFICATION
      </div>
      <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        CCE Evaluation Published
      </h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">
        {course_name} ({course_code})
      </p>
    </div>

    <!-- Student Credentials Strip -->
    <div style="padding: 16px 30px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <div style="font-size: 15px; font-weight: 800; color: #0f172a;">{student_name}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
              PRN: <span style="font-family: monospace; font-weight: 700; color: #10b981;">{prn}</span> • {program_name} ({batch_name})
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Main Content -->
    <div style="padding: 26px 30px;">
      
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
        Dear <strong>{student_name}</strong>,<br/><br/>
        Your Continuous Comprehensive Evaluation (CCE) deliverable has been evaluated and graded by faculty. Your score and feedback are detailed below.
      </p>

      <!-- ASSIGNMENT DETAILS CARD -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
        
        <div style="margin-bottom: 14px;">
          <span style="display: inline-block; padding: 3px 10px; background: #d1fae5; color: #065f46; font-size: 11px; font-weight: 800; text-transform: uppercase; border-radius: 6px; letter-spacing: 0.5px;">
            Component: Continuous Evaluation (CCE)
          </span>
          <h2 style="margin: 10px 0 4px; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            {ass_title}
          </h2>
          <div style="font-size: 13px; color: #475569; font-weight: 600;">
            Course: <strong style="color: #0f172a;">{course_name}</strong> ({course_code}) • Type: {ass_type}
          </div>
        </div>

        <!-- Score Grid -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; text-align: center;">
          <tr>
            <td width="50%" style="padding: 16px 12px; border-right: 1px solid #e2e8f0;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">
                Marks Awarded
              </div>
              <div style="font-size: 34px; font-weight: 900; color: #059669; margin: 4px 0;">
                {marks_val} <span style="font-size: 16px; color: #94a3b8; font-weight: 700;">/ {total_marks}</span>
              </div>
              <div style="font-size: 11px; color: #64748b;">
                Percentage: {pct}%
              </div>
            </td>
            <td width="50%" style="padding: 16px 12px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 1px;">
                Assessment Component
              </div>
              <div style="margin: 6px 0;">
                <span style="display: inline-block; padding: 5px 14px; border-radius: 9999px; background: #ecfdf5; color: #065f46; font-size: 12.5px; font-weight: 800;">
                  CCE Internal
                </span>
              </div>
              <div style="font-size: 11px; color: #64748b;">
                Evaluated by: {grader_name} • {graded_date}
              </div>
            </td>
          </tr>
        </table>

      </div>

      <!-- EVALUATOR FEEDBACK -->
      <div style="border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px; background: #ffffff;">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-bottom: 12px;">
          Faculty Evaluation Remarks & Feedback
        </div>
        
        <div style="background: #f8fafc; border-left: 3px solid #10b981; padding: 14px 16px; border-radius: 6px; font-size: 13px; color: #1e293b; line-height: 1.6; font-style: italic;">
          "{feedback_val}"
        </div>
      </div>

      <!-- CTA BUTTON & GRADEBOOK LINK -->
      <div style="text-align: center; padding-top: 10px; border-top: 1px solid #e2e8f0;">
        <a href="{portal_url}" style="display: inline-block; background: #059669; color: #ffffff; font-weight: 700; font-size: 13.5px; padding: 12px 28px; text-decoration: none; border-radius: 10px; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.25); margin-bottom: 14px;">
          View Subject Gradebook in Orion &rarr;
        </a>
        <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
          You can inspect your total CCE standing, HyperBuild labs, and full marksheet anytime on the 
          <a href="https://crc-one.onrender.com/lms/subjects/{course_code}/gradebook" style="color: #059669; font-weight: 700; text-decoration: underline;">Subject Gradebook</a>.
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 18px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
      Office of the Academic Registrar & Examination Cell • Orion Academic Portal<br/>
      Automated CCE grade notification issued immediately upon faculty evaluation.
    </div>

  </div>
</body>
</html>"""

        subject_line = f"CCE Grade Published: {ass_title} ({course_code}) — {marks_val}/{total_marks} Marks"
        return send_custom_html_email(
            to_email=target_email,
            subject=subject_line,
            html_content=html_body,
        )


gradebook_service = GradebookService()
