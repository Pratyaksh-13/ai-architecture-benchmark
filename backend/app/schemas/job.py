# app/schemas/job.py

from pydantic import BaseModel
from typing import Optional, Any

class JobSubmittedResponse(BaseModel):
    job_id: str
    status: str
    message: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str          # PENDING | STARTED | SUCCESS | FAILURE
    result: Optional[Any] = None
    error: Optional[str] = None
    meta: Optional[dict] = None