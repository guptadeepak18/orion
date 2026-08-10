from typing import Generic, TypeVar, Optional, Any, Dict
from pydantic import BaseModel

T = TypeVar("T")


class MetaSchema(BaseModel):
    page: Optional[int] = None
    page_size: Optional[int] = None
    total_count: Optional[int] = None
    total_pages: Optional[int] = None


class ResponseEnvelope(BaseModel, Generic[T]):
    data: T
    meta: Optional[MetaSchema] = None


class ErrorDetails(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class ErrorEnvelope(BaseModel):
    error: ErrorDetails
