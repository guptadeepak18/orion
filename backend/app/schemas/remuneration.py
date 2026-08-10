from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class RemunerationRuleCreate(BaseModel):
    faculty_external_id: Optional[UUID] = None
    rate_type: str  # per_hour|per_session|fixed|custom
    rate_value: float
    tax_percent: float = 18.0
    effective_from: date


class RemunerationRuleResponse(BaseModel):
    id: UUID
    faculty_external_id: Optional[UUID] = None
    rate_type: str
    rate_value: float
    tax_percent: float
    effective_from: date
    effective_to: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class ExternalRemunerationBillingResponse(BaseModel):
    id: UUID
    session_id: UUID
    session_date: date
    start_time: str
    end_time: str
    duration_minutes: int
    duration_hours: float
    venue: str
    session_status: str
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    topic_delivered: str

    # Faculty Details
    faculty_id: UUID
    faculty_name: str
    faculty_designation: Optional[str] = None
    organization: Optional[str] = None
    email: str
    phone: Optional[str] = None
    is_gst_applicable: bool = False
    pan: Optional[str] = None
    gst_number: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_ifsc: Optional[str] = None

    # Remuneration & Billing Details
    rate_type: str
    rate_value: float
    gross_amount: float
    tax_percent: float
    tax_amount: float
    net_payable: float
    is_anomaly_flagged: bool
    anomaly_reason: Optional[str] = None

    # Status
    approval_status: str
    payment_status: str
    invoice_number: Optional[str] = None
    invoice_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
