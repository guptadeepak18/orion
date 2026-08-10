from typing import Optional, List, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class StudentCreate(BaseModel):
    user_id: Optional[UUID] = None

    # 1 & 2. Names
    first_name: str = Field(..., min_length=1, description="Student's first name")
    last_name: Optional[str] = Field(None, description="Student's last name (optional)")
    full_name: Optional[str] = None
    gender: str = Field("Male", description="Student's gender (Male, Female, Other, Prefer not to say)")

    # 3 & 4. Parents
    father_name: str = Field(..., min_length=1, description="Father's name")
    mother_name: str = Field(..., min_length=1, description="Mother's name")

    # 5, 6, 7, 8. Contact Details
    mobile_number: str = Field(..., min_length=1, description="Primary mobile number")
    email_official: str = Field(..., min_length=3, description="Official college email address")
    email_personal: str = Field(..., min_length=3, description="Personal email address")
    alternate_contact_number: Optional[str] = Field(None, description="Alternate contact number (optional)")

    # 9, 10, 11. Emergency Contact Details
    emergency_contact_number: str = Field(..., min_length=1, description="Emergency contact phone number")
    emergency_contact_name: str = Field(..., min_length=1, description="Name of emergency contact person")
    emergency_contact_relation: str = Field(..., min_length=1, description="Relation with emergency contact")

    # 12 & 13. Blood Group & PRN
    blood_group: str = Field(..., min_length=1, description="Blood group (e.g. A+, O+, B-, etc.)")
    prn_number: str = Field(..., min_length=1, description="Permanent Registration Number (PRN)")

    # 14 & 15. Program and Batch
    program_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None

    # 16. Trimester
    trimester: int = Field(1, ge=1, le=6, description="Trimester number (1, 2, 3, 4, 5, 6)")

    # 17 & 18. Undergraduate Background
    ug_degree: str = Field(..., min_length=1, description="Undergraduate Degree (e.g. B.Tech, B.Com, BBA)")
    ug_score_type: Literal["percentage", "cgpa"] = Field("cgpa", description="Score format: percentage or cgpa")
    ug_score: float = Field(..., ge=0.0, description="Undergraduate numerical score")

    # 19 & 20. Specializations
    specialization_major: str = Field(..., min_length=1, description="Major Specialization")
    specialization_minor: str = Field(..., min_length=1, description="Minor Specialization")

    # Compatibility / Academic metrics
    roll_no: Optional[str] = None
    enrollment_no: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cgpa: float = 0.0
    status: str = "active"
    is_active: bool = True


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    gender: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    mobile_number: Optional[str] = None
    email_official: Optional[str] = None
    email_personal: Optional[str] = None
    alternate_contact_number: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    blood_group: Optional[str] = None
    prn_number: Optional[str] = None
    program_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    trimester: Optional[int] = Field(None, ge=1, le=6)
    ug_degree: Optional[str] = None
    ug_score_type: Optional[Literal["percentage", "cgpa"]] = None
    ug_score: Optional[float] = None
    specialization_major: Optional[str] = None
    specialization_minor: Optional[str] = None

    roll_no: Optional[str] = None
    enrollment_no: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    cgpa: Optional[float] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None


class StudentResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None

    # 1 & 2. Names
    first_name: str = ""
    last_name: Optional[str] = None
    full_name: str
    gender: Optional[str] = "Male"

    # 3 & 4. Parents
    father_name: str = ""
    mother_name: str = ""

    # 5, 6, 7, 8. Contact Details
    mobile_number: str = ""
    email_official: str = ""
    email_personal: str = ""
    alternate_contact_number: Optional[str] = None

    # 9, 10, 11. Emergency Contact Details
    emergency_contact_number: str = ""
    emergency_contact_name: str = ""
    emergency_contact_relation: str = ""

    # 12 & 13. Blood Group & PRN
    blood_group: str = "O+"
    prn_number: str = ""

    # 14 & 15. Program and Batch
    program_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    program_name: Optional[str] = None
    batch_name: Optional[str] = None

    # 16. Trimester
    trimester: int = 1

    # 17 & 18. Undergraduate Background
    ug_degree: str = ""
    ug_score_type: str = "cgpa"
    ug_score: float = 0.0

    # 19 & 20. Specializations
    specialization_major: str = ""
    specialization_minor: str = ""

    # Compatibility & Performance (Attendance is dynamically auto-calculated)
    roll_no: str
    enrollment_no: str
    email: str
    phone: Optional[str] = None
    cgpa: float
    attendance_percentage: float = 100.0
    total_sessions_conducted: int = 0
    total_sessions_attended: int = 0
    status: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class StudentReportSummary(BaseModel):
    student: StudentResponse
    total_sessions_scheduled: int
    total_sessions_completed: int
    attendance_percentage: float
    cgpa: float
    enrolled_subjects_count: int

