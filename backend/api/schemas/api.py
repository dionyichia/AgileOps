from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# --- Projects ---

class ProjectCreate(BaseModel):
    company_name: str
    team_name: str
    primary_role: str
    team_size: Optional[int] = None
    notes: Optional[str] = None


class ProjectUpdate(BaseModel):
    company_name: Optional[str] = None
    team_name: Optional[str] = None
    primary_role: Optional[str] = None
    team_size: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class ProjectOut(BaseModel):
    id: str
    company_name: str
    team_name: str
    primary_role: str
    team_size: Optional[int]
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Workflow Profiles ---

class ProfileCreate(BaseModel):
    role: str
    selected_responsibilities: List[str] = Field(default_factory=list)
    tools: Optional[str] = None
    description: Optional[str] = None


class ProfileOut(BaseModel):
    id: str
    project_id: str
    role: str
    selected_responsibilities: List[str]
    tools: Optional[str]
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
