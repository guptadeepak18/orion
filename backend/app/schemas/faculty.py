from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict


class FacultyInternalCreate(BaseModel):
    user_id: Optional[UUID] = None
    employee_id: str
    full_name: Optional[str] = None
    department: str
    designation: str
    email: EmailStr
    phone: Optional[str] = None
    # Personal
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None           # Male | Female | Other | Prefer not to say
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Academic & Professional
    highest_qualification: Optional[str] = None   # PhD | MBA | MCA | B.Tech | etc.
    specialization: Optional[str] = None
    research_area: Optional[str] = None
    experience_years: Optional[int] = None
    joining_date: Optional[date] = None
    # Teaching profile
    subjects_handled: Optional[List[str]] = []
    linkedin_url: Optional[str] = None
    publications: Optional[int] = None
    is_active: bool = True
    is_archived: bool = False


class FacultyInternalUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    # Personal
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    # Academic & Professional
    highest_qualification: Optional[str] = None
    specialization: Optional[str] = None
    research_area: Optional[str] = None
    experience_years: Optional[int] = None
    joining_date: Optional[date] = None
    subjects_handled: Optional[List[str]] = None
    linkedin_url: Optional[str] = None
    publications: Optional[int] = None
    is_active: Optional[bool] = None
    is_archived: Optional[bool] = None


class FacultyInternalResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    employee_id: str
    full_name: Optional[str] = None
    department: str
    designation: str
    email: EmailStr
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    highest_qualification: Optional[str] = None
    specialization: Optional[str] = None
    research_area: Optional[str] = None
    experience_years: Optional[int] = None
    joining_date: Optional[date] = None
    subjects_handled: Optional[List[str]] = None
    linkedin_url: Optional[str] = None
    publications: Optional[int] = None
    is_active: bool = True
    is_archived: bool = False

    model_config = ConfigDict(from_attributes=True)


class FacultyExternalCreate(BaseModel):
    user_id: Optional[UUID] = None
    name: str
    designation: Optional[str] = None
    organization: Optional[str] = None
    expertise: Optional[List[str]] = []
    email: EmailStr
    phone: Optional[str] = None
    # Personal
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    # Academic
    highest_qualification: Optional[str] = None
    experience_years: Optional[int] = None
    linkedin_url: Optional[str] = None
    # Financial / Compliance
    is_gst_applicable: bool = False
    gst_rate_percent: float = 18.0
    pan: Optional[str] = None
    gst_number: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None
    address: Optional[str] = None
    standard_rate_type: str = "per_hour"
    standard_rate: float = 0.0
    agreement_start: Optional[date] = None
    agreement_end: Optional[date] = None
    is_active: bool = True
    is_archived: bool = False


class FacultyExternalUpdate(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    organization: Optional[str] = None
    expertise: Optional[List[str]] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    highest_qualification: Optional[str] = None
    experience_years: Optional[int] = None
    linkedin_url: Optional[str] = None
    is_gst_applicable: Optional[bool] = None
    gst_rate_percent: Optional[float] = None
    pan: Optional[str] = None
    gst_number: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None
    address: Optional[str] = None
    standard_rate_type: Optional[str] = None
    standard_rate: Optional[float] = None
    agreement_start: Optional[date] = None
    agreement_end: Optional[date] = None
    is_active: Optional[bool] = None
    is_archived: Optional[bool] = None


class FacultyExternalResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    name: str
    designation: Optional[str] = None
    organization: Optional[str] = None
    expertise: Optional[List[str]] = None
    email: EmailStr
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    highest_qualification: Optional[str] = None
    experience_years: Optional[int] = None
    linkedin_url: Optional[str] = None
    is_gst_applicable: bool = False
    gst_rate_percent: float = 18.0
    pan: Optional[str] = None
    gst_number: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_name: Optional[str] = None
    address: Optional[str] = None
    standard_rate_type: str
    standard_rate: float
    agreement_start: Optional[date] = None
    agreement_end: Optional[date] = None
    is_active: bool
    is_archived: bool = False

    model_config = ConfigDict(from_attributes=True)


class FacultyDocumentCreate(BaseModel):
    doc_type: str  # agreement|pan|gst|bank_proof|other
    file_path: str
    expiry_date: Optional[date] = None


class FacultyDocumentResponse(BaseModel):
    id: UUID
    faculty_external_id: UUID
    doc_type: str
    file_path: str
    version: int
    expiry_date: Optional[date] = None
    uploaded_at: date

    model_config = ConfigDict(from_attributes=True)


class FacultySuggestItem(BaseModel):
    id: UUID
    name: str
    faculty_type: str
    expertise: List[str]
    workload_hours_90d: float
    match_score: float
