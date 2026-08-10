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
    student_count: int = 0
    is_active: bool = True


class BatchUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    division: Optional[str] = None
    student_count: Optional[int] = None
    is_active: Optional[bool] = None


class BatchResponse(BaseModel):
    id: UUID
    program_id: UUID
    academic_year_id: UUID
    semester_id: UUID
    name: str
    code: str
    division: Optional[str] = None
    student_count: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# Subject
class SubjectCreate(BaseModel):
    batch_id: Optional[UUID] = None
    name: str
    code: str
    credits: int = 3


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    credits: Optional[int] = None


class SubjectResponse(BaseModel):
    id: UUID
    batch_id: UUID
    name: str
    code: str
    credits: int

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
