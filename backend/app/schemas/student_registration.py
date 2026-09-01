from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, field_validator, model_validator, ConfigDict


ALLOWED_DOMAIN = "mile.education"


class StudentRegisterRequest(BaseModel):
    # Auth
    email: str
    password: str
    confirm_password: str

    # Academic ID
    prn_number: str

    # Identity
    first_name: str
    last_name: Optional[str] = None
    gender: Optional[str] = None

    # Family
    father_name: Optional[str] = None
    mother_name: Optional[str] = None

    # Contact
    mobile_number: str
    email_personal: Optional[str] = None
    alternate_contact_number: Optional[str] = None

    # Emergency
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

    # Health
    blood_group: Optional[str] = None

    # UG Background
    ug_degree: Optional[str] = None
    ug_score_type: Optional[str] = None
    ug_score: Optional[float] = None

    # Specializations (student-selected)
    specialization_major: Optional[str] = None
    specialization_minor: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        v = v.strip().lower()
        if not v.endswith(f"@{ALLOWED_DOMAIN}"):
            raise ValueError(f"Registration is only allowed with @{ALLOWED_DOMAIN} email addresses")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "StudentRegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class StudentVerifyEmailRequest(BaseModel):
    email: str
    code: str

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.strip().lower()


class StudentResendVerificationRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def lower_email(cls, v: str) -> str:
        return v.strip().lower()


class StudentRegistrationResponse(BaseModel):
    id: UUID
    email: str
    prn_number: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    full_name: str
    gender: Optional[str] = None
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    mobile_number: str
    email_personal: Optional[str] = None
    alternate_contact_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_number: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    blood_group: Optional[str] = None
    ug_degree: Optional[str] = None
    ug_score_type: Optional[str] = None
    ug_score: Optional[float] = None
    specialization_major: Optional[str] = None
    specialization_minor: Optional[str] = None
    is_email_verified: bool
    status: str
    rejection_reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentRegistrationStatusResponse(BaseModel):
    status: str
    rejection_reason: Optional[str] = None
    full_name: str
    email: str
    is_email_verified: bool
    submitted_at: datetime


class ApproveStudentRegistrationRequest(BaseModel):
    program_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    division_id: Optional[UUID] = None
    trimester: Optional[int] = 1
    roll_no: Optional[str] = None
    enrollment_no: Optional[str] = None
    specialization_major: Optional[str] = None
    specialization_minor: Optional[str] = None
