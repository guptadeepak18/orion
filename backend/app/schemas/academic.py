from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict


# Program
class ProgramCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True


class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProgramResponse(BaseModel):
    id: UUID
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# Academic Year
class AcademicYearCreate(BaseModel):
    label: str
    start_date: date
    end_date: date


class AcademicYearUpdate(BaseModel):
    label: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class AcademicYearResponse(BaseModel):
    id: UUID
    label: str
    start_date: date
    end_date: date

    model_config = ConfigDict(from_attributes=True)


# Semester
class SemesterCreate(BaseModel):
    program_id: UUID
    academic_year_id: UUID
    number: int
    label: str
    start_date: date
    end_date: date


class SemesterUpdate(BaseModel):
    number: Optional[int] = None
    label: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class SemesterResponse(BaseModel):
    id: UUID
    program_id: UUID
    academic_year_id: UUID
    number: int
    label: str
    start_date: date
    end_date: date

    model_config = ConfigDict(from_attributes=True)


# Batch
class BatchCreate(BaseModel):
    program_id: Optional[UUID] = None
    academic_year_id: Optional[UUID] = None
    semester_id: Optional[UUID] = None
    name: str
    code: str
    division: Optional[str] = None
    is_active: bool = True


class BatchUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    division: Optional[str] = None
    is_active: Optional[bool] = None


class BatchResponse(BaseModel):
    id: UUID
    program_id: UUID
    academic_year_id: UUID
    semester_id: UUID
    name: str
    code: str
    division: Optional[str] = None
    student_count: int = 0
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# Subject
class SubjectBatchAllocation(BaseModel):
    batch_id: UUID
    term_type: str = "trimester"
    term_number: int = 1
    term_label: Optional[str] = "Trimester 1"
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class SubjectBatchAllocationResponse(BaseModel):
    id: UUID
    batch_id: UUID
    batch_name: Optional[str] = None
    term_type: str = "trimester"
    term_number: int = 1
    term_label: Optional[str] = "Trimester 1"
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class SubjectProgramSummary(BaseModel):
    id: UUID
    name: str
    code: str

    model_config = ConfigDict(from_attributes=True)


class SubjectCreate(BaseModel):
    name: str
    code: str
    course_code: Optional[str] = None
    trimester: int = 1
    is_non_credit: bool = False
    credits: int = 3
    total_hours: Optional[int] = 30
    course_category: Optional[str] = "core"
    elective_domain: Optional[str] = None
    syllabus: Optional[str] = None
    session_plan: Optional[str] = None
    hyperbuild_activities: Optional[str] = None
    program_ids: List[UUID] = []
    batch_allocations: List[SubjectBatchAllocation] = []


class SubjectCurriculumUpdate(BaseModel):
    syllabus: Optional[str] = None
    session_plan: Optional[str] = None
    hyperbuild_activities: Optional[str] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    course_code: Optional[str] = None
    trimester: Optional[int] = None
    is_non_credit: Optional[bool] = None
    credits: Optional[int] = None
    total_hours: Optional[int] = None
    course_category: Optional[str] = None
    elective_domain: Optional[str] = None
    is_archived: Optional[bool] = None
    syllabus: Optional[str] = None
    session_plan: Optional[str] = None
    hyperbuild_activities: Optional[str] = None
    program_ids: Optional[List[UUID]] = None
    batch_allocations: Optional[List[SubjectBatchAllocation]] = None


class SubjectResponse(BaseModel):
    id: UUID
    name: str
    code: str
    course_code: Optional[str] = None
    trimester: int = 1
    is_non_credit: bool = False
    credits: int = 3
    total_hours: Optional[int] = 30
    course_category: str = "core"
    elective_domain: Optional[str] = None
    is_archived: bool = False
    syllabus: Optional[str] = None
    session_plan: Optional[str] = None
    hyperbuild_activities: Optional[str] = None
    programs: List[SubjectProgramSummary] = []
    batch_allocations: List[SubjectBatchAllocationResponse] = []
    batch_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)


# Topic
class TopicCreate(BaseModel):
    subject_id: Optional[UUID] = None
    name: str
    sequence_no: int = 1
    planned_hours: int = 2


class TopicUpdate(BaseModel):
    name: Optional[str] = None
    sequence_no: Optional[int] = None
    planned_hours: Optional[int] = None


class TopicResponse(BaseModel):
    id: UUID
    subject_id: UUID
    name: str
    sequence_no: int
    planned_hours: int

    model_config = ConfigDict(from_attributes=True)


# Division
class DivisionCreate(BaseModel):
    program_id: UUID
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True


class DivisionUpdate(BaseModel):
    program_id: Optional[UUID] = None
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DivisionResponse(BaseModel):
    id: UUID
    program_id: UUID
    program_name: Optional[str] = None
    name: str
    code: str
    description: Optional[str] = None
    student_count: int = 0
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# Faculty-Subject Allocation
class FacultySubjectAllocationCreate(BaseModel):
    subject_id: UUID
    batch_id: UUID
    faculty_type: Optional[str] = "internal"  # internal | external
    faculty_internal_id: Optional[UUID] = None
    faculty_external_id: Optional[UUID] = None
    term_type: Optional[str] = "trimester"
    term_number: Optional[int] = 1
    term_label: Optional[str] = "Trimester 1"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = "active"


class FacultySubjectAllocationUpdate(BaseModel):
    subject_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    faculty_type: Optional[str] = None
    faculty_internal_id: Optional[UUID] = None
    faculty_external_id: Optional[UUID] = None
    term_type: Optional[str] = None
    term_number: Optional[int] = None
    term_label: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None


class FacultySubjectAllocationResponse(BaseModel):
    id: UUID
    subject_id: UUID
    subject_name: str
    subject_code: str
    course_code: Optional[str] = None
    course_category: Optional[str] = "core"
    credits: Optional[int] = 3
    total_hours: Optional[int] = 30
    batch_id: UUID
    batch_name: str
    batch_code: Optional[str] = None
    program_id: Optional[UUID] = None
    program_name: Optional[str] = None
    program_code: Optional[str] = None
    faculty_type: Optional[str] = "internal"
    faculty_internal_id: Optional[UUID] = None
    faculty_external_id: Optional[UUID] = None
    faculty_name: Optional[str] = None
    faculty_email: Optional[str] = None
    faculty_organization: Optional[str] = None
    faculty_designation: Optional[str] = None
    term_type: str = "trimester"
    term_number: int = 1
    term_label: Optional[str] = "Trimester 1"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: str = "active"

    model_config = ConfigDict(from_attributes=True)


