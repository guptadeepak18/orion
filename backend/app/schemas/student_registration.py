import re
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

    # Academic ID & Program
    prn_number: str
    program_code: Optional[str] = "PGDM"
    program_name: Optional[str] = "Post Graduate Diploma in Management"

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

    @field_validator("password")
    @classmethod
    def validate_password_policy(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter (A-Z).")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter (a-z).")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one numeric digit (0-9).")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must contain at least one special character.")
        return v

    @model_validator(mode="after")
    def validate_rules(self) -> "StudentRegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")

        # PGDM PRN validation: Exactly 14 digits and numeric
        prog_code = (self.program_code or "").strip().upper()
        prog_name = (self.program_name or "").strip().upper()
        if prog_code == "PGDM" or "PGDM" in prog_name:
            prn_clean = (self.prn_number or "").strip()
            if not re.match(r"^\d{14}$", prn_clean):
                raise ValueError("For PGDM program, PRN number must be exactly 14 numeric digits (e.g. 20261029384756).")

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
    program_code: Optional[str] = None
    program_name: Optional[str] = None
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
