from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Auth ───────────────────────────────────────────────────────────────────────
# Registration and login are handled by Supabase Auth.
# The backend only needs to represent the decoded identity.

class UserOut(BaseModel):
    id: str
    email: str


# ── Consultation (public intake form) ─────────────────────────────────────────

class ConsultationCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    role: str
    selected_responsibilities: List[str] = Field(default_factory=list)
    tools: Optional[str] = None
    description: Optional[str] = None


# ── Projects ───────────────────────────────────────────────────────────────────

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


# ── Workflow Profiles ──────────────────────────────────────────────────────────

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


# ── Transcripts ────────────────────────────────────────────────────────────────

class TranscriptCreate(BaseModel):
    interviewee_name: str
    interviewee_role: str
    interview_date: str  # "YYYY-MM-DD"
    raw_text: str


class TranscriptOut(BaseModel):
    id: str
    project_id: str
    interviewee_name: str
    interviewee_role: str
    interview_date: str
    raw_text: str
    tasks_extracted: Optional[int]
    tasks_updated: Optional[int]
    processed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class TranscriptSubmitResult(BaseModel):
    transcript: TranscriptOut
    job_id: str


# ── Jobs ───────────────────────────────────────────────────────────────────────

class JobOut(BaseModel):
    id: str
    project_id: str
    job_type: str
    status: str
    progress_pct: int
    current_step: Optional[str]
    error_message: Optional[str]
    result_data: Optional[Dict[str, Any]]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Tool Evaluations ───────────────────────────────────────────────────────────

class ToolEvaluationCreate(BaseModel):
    use_case: str
    tool_name: str
    website_url: Optional[str] = None
    docs_url: Optional[str] = None


class ToolEvaluationOut(BaseModel):
    id: str
    project_id: str
    use_case: str
    tool_name: str
    website_url: Optional[str]
    docs_url: Optional[str]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Uploaded Files ─────────────────────────────────────────────────────────────

class UploadedFileOut(BaseModel):
    id: str
    project_id: str
    tool_evaluation_id: Optional[str]
    file_type: str
    original_name: str
    storage_path: str
    size_bytes: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


# ── Task Graph ─────────────────────────────────────────────────────────────────

class DurationDistribution(BaseModel):
    type: str
    mean_minutes: float
    std_minutes: float


class TaskNodeOut(BaseModel):
    node_id: str
    label: str
    description: str
    action_verb: str
    inputs: List[str]
    outputs: List[str]
    app_cluster: List[str]
    duration_distribution: DurationDistribution
    automatable_fraction: str
    sources: Optional[List[str]] = None


# ── Simulation Results ─────────────────────────────────────────────────────────

class SimulationDataOut(BaseModel):
    results_json: Dict[str, Any]
    tool_name: str
    n_simulations: int
    n_weeks: int
    final_work_saved_pct: float
    final_throughput_lift_pct: float


# ── Recommendation ─────────────────────────────────────────────────────────────

class ImpactRange(BaseModel):
    p10: float
    p70: float


class EmployeeImpact(BaseModel):
    time_saved: ImpactRange
    velocity_gain: ImpactRange
    learning_weeks: str


class CompanyImpact(BaseModel):
    throughput: ImpactRange
    revenue_impact: ImpactRange
    tool_cost: float


class UseCase(BaseModel):
    title: str
    description: str


class RecommendationOut(BaseModel):
    tool_name: str
    confidence_score: float
    summary: str
    employee_impact: EmployeeImpact
    company_impact: CompanyImpact
    use_cases: List[UseCase]
