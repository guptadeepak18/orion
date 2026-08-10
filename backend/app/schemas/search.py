from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class SearchResultItem(BaseModel):
    id: str
    entity_type: str  # faculty|program|batch|session|invoice|payment
    title: str
    subtitle: Optional[str] = None
    url: str
    metadata: Optional[Dict[str, Any]] = None


class SearchResponse(BaseModel):
    query: str
    total_results: int
    results: List[SearchResultItem]
