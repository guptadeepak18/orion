import asyncio
import logging
import random
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.activity import SubjectActivity
from app.models.lms import ActivitySubmission
from app.models.session import HyperbuildActivity
from app.services.ai_evaluator import evaluate_submission_against_rubric
from app.services.websocket_service import broadcast_session_event, broadcast_global_event

logger = logging.getLogger(__name__)


class BulkEvaluatorManager:
    """
    Manages asynchronous, concurrency-bounded, and rate-limited bulk evaluations
    of student activity submissions using Gemini and fallback LLMs.
    """

    def __init__(self, max_concurrency: int = 3):
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    def get_task_progress(self, task_or_activity_id: str) -> Optional[Dict[str, Any]]:
        if task_or_activity_id in self.active_tasks:
            return self.active_tasks[task_or_activity_id]
        for task in self.active_tasks.values():
            if task.get("activity_id") == str(task_or_activity_id):
                return task
        return None

    async def start_bulk_evaluation(
        self,
        activity_id: uuid.UUID,
        session_id: Optional[uuid.UUID] = None,
        requested_by_user_id: Optional[uuid.UUID] = None,
        reevaluate_all: bool = False,
    ) -> Dict[str, Any]:
        """
        Spawns a background task to evaluate all eligible submissions for an activity.
        """
        task_id = f"bulk-eval-{activity_id}-{uuid.uuid4().hex[:8]}"

        task_info = {
            "task_id": task_id,
            "activity_id": str(activity_id),
            "session_id": str(session_id) if session_id else None,
            "status": "in_progress",  # in_progress | completed | failed
            "total_submissions": 0,
            "processed_count": 0,
            "success_count": 0,
            "failed_count": 0,
            "current_student": None,
            "average_score": None,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "error_message": None,
        }

        async with self._lock:
            self.active_tasks[task_id] = task_info
            self.active_tasks[str(activity_id)] = task_info

        asyncio.create_task(
            self._run_bulk_evaluation_worker(
                task_id=task_id,
                activity_id=activity_id,
                session_id=session_id,
                requested_by_user_id=requested_by_user_id,
                reevaluate_all=reevaluate_all,
            )
        )

        return task_info

    async def _run_bulk_evaluation_worker(
        self,
        task_id: str,
        activity_id: uuid.UUID,
        session_id: Optional[uuid.UUID],
        requested_by_user_id: Optional[uuid.UUID],
        reevaluate_all: bool,
    ):
        logger.info(f"[BulkEvaluator] Starting bulk evaluation for activity {activity_id} (Task: {task_id})")
        scores: List[float] = []

        try:
            async with AsyncSessionLocal() as db:
                act = await db.get(SubjectActivity, activity_id)
                if not act:
                    hb_act = await db.get(HyperbuildActivity, activity_id)
                    if hb_act:
                        act_stmt = select(SubjectActivity).where(
                            SubjectActivity.subject_id == hb_act.subject_id,
                            SubjectActivity.activity_no == hb_act.activity_no,
                        )
                        act_res = await db.execute(act_stmt)
                        act = act_res.scalar_one_or_none()
                        if not act:
                            act = hb_act

                if not act:
                    raise ValueError(f"Activity {activity_id} not found in database.")

                sub_query = (
                    select(ActivitySubmission)
                    .where(ActivitySubmission.activity_id == activity_id)
                    .options(selectinload(ActivitySubmission.student))
                    .order_by(ActivitySubmission.submitted_at.asc())
                )
                if not reevaluate_all:
                    sub_query = sub_query.where(ActivitySubmission.ai_evaluation == None)

                sub_res = await db.execute(sub_query)
                submissions = list(sub_res.scalars().all())

                task_info = self.active_tasks.get(task_id, {})
                task_info["total_submissions"] = len(submissions)

                if not submissions:
                    task_info["status"] = "completed"
                    task_info["completed_at"] = datetime.now(timezone.utc).isoformat()
                    logger.info(f"[BulkEvaluator] No submissions to evaluate for activity {activity_id}.")
                    return

                logger.info(f"[BulkEvaluator] Found {len(submissions)} submissions to evaluate for {activity_id}.")

            for idx, sub in enumerate(submissions):
                student_name = sub.student.full_name if sub.student else f"Student #{idx+1}"
                task_info["current_student"] = student_name

                if session_id:
                    await broadcast_session_event(
                        session_id,
                        "bulk_evaluation_progress",
                        {
                            "task_id": task_id,
                            "activity_id": str(activity_id),
                            "total": len(submissions),
                            "processed": idx,
                            "current_student": student_name,
                        },
                    )

                eval_success = await self._evaluate_single_with_semaphore(
                    sub_id=sub.id,
                    activity=act,
                    submission_text=sub.submission_text,
                    files=sub.files or ([{"file_url": sub.file_url, "file_name": sub.file_name, "file_size": sub.file_size}] if sub.file_url else []),
                    grader_user_id=requested_by_user_id,
                    session_id=session_id,
                )

                task_info["processed_count"] += 1
                if eval_success:
                    task_info["success_count"] += 1
                    if eval_success.get("total_score") is not None:
                        scores.append(float(eval_success["total_score"]))
                        task_info["average_score"] = round(sum(scores) / len(scores), 1)
                else:
                    task_info["failed_count"] += 1

                await asyncio.sleep(0.3 + random.uniform(0.1, 0.3))

            task_info["status"] = "completed"
            task_info["completed_at"] = datetime.now(timezone.utc).isoformat()
            task_info["current_student"] = None

            if session_id:
                await broadcast_session_event(
                    session_id,
                    "bulk_evaluation_completed",
                    {
                        "task_id": task_id,
                        "activity_id": str(activity_id),
                        "total": len(submissions),
                        "success_count": task_info["success_count"],
                        "failed_count": task_info["failed_count"],
                        "average_score": task_info["average_score"],
                    },
                )
            logger.info(f"[BulkEvaluator] Bulk evaluation completed for activity {activity_id} ({task_info['success_count']}/{len(submissions)} scored).")

        except Exception as e:
            logger.error(f"[BulkEvaluator] Bulk evaluation failed for activity {activity_id}: {e}", exc_info=True)
            if task_id in self.active_tasks:
                self.active_tasks[task_id]["status"] = "failed"
                self.active_tasks[task_id]["error_message"] = str(e)
                self.active_tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()

    async def _evaluate_single_with_semaphore(
        self,
        sub_id: uuid.UUID,
        activity: Any,
        submission_text: Optional[str],
        files: Optional[List[Dict[str, Any]]],
        grader_user_id: Optional[uuid.UUID],
        session_id: Optional[uuid.UUID],
    ) -> Optional[Dict[str, Any]]:
        async with self.semaphore:
            max_retries = 3
            ai_eval = None

            for attempt in range(max_retries):
                try:
                    ai_eval = await evaluate_submission_against_rubric(
                        activity=activity,
                        submission_text=submission_text,
                        files=files,
                    )
                    break
                except Exception as e:
                    err_str = str(e).lower()
                    if "429" in err_str or "rate limit" in err_str or "quota" in err_str:
                        backoff = (2 ** attempt) * 2.0 + random.uniform(0.5, 1.5)
                        logger.warning(f"[BulkEvaluator] Rate limit on submission {sub_id}. Backing off {backoff:.1f}s (Attempt {attempt+1}/{max_retries})")
                        await asyncio.sleep(backoff)
                    else:
                        logger.error(f"[BulkEvaluator] Error evaluating submission {sub_id}: {e}")
                        break

            if not ai_eval:
                return None

            try:
                async with AsyncSessionLocal() as db:
                    sub = await db.get(ActivitySubmission, sub_id)
                    if sub:
                        sub.ai_evaluation = ai_eval
                        sub.score = ai_eval.get("total_score")
                        sub.grade = ai_eval.get("performance_tier")
                        sub.feedback = ai_eval.get("executive_summary")
                        sub.status = "graded"
                        if grader_user_id:
                            sub.graded_by_id = grader_user_id
                        sub.graded_at = datetime.utcnow()
                        await db.commit()

                        if session_id:
                            await broadcast_session_event(
                                session_id,
                                "submission_evaluated",
                                {
                                    "submission_id": str(sub.id),
                                    "student_id": str(sub.student_id),
                                    "score": sub.score,
                                    "grade": sub.grade,
                                },
                            )
            except Exception as e:
                logger.error(f"[BulkEvaluator] Error saving evaluation for {sub_id}: {e}")

            return ai_eval


bulk_evaluator = BulkEvaluatorManager(max_concurrency=3)
