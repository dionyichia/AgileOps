import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.types import JSON
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy import ForeignKey


class Base(DeclarativeBase):
    pass


# ── Enums ──────────────────────────────────────────────────────────────────────

class JobType(str, enum.Enum):
    transcript_parse = "transcript_parse"
    pipeline_run     = "pipeline_run"
    simulation       = "simulation"


class JobStatus(str, enum.Enum):
    pending   = "pending"
    running   = "running"
    completed = "completed"
    failed    = "failed"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Models ─────────────────────────────────────────────────────────────────────
# Note: User auth and profiles now live in Supabase.
# owner_id stores the Supabase user UUID as a plain string — no local FK.

class Project(Base):
    __tablename__ = "projects"

    id           = Column(String(36), primary_key=True, default=_uuid)
    owner_id     = Column(String(36), nullable=True, index=True)  # Supabase auth.users.id
    company_name = Column(Text, nullable=False)
    team_name    = Column(Text, nullable=False)
    primary_role = Column(Text, nullable=False)
    team_size    = Column(Integer)
    notes        = Column(Text)
    status       = Column(String(20), nullable=False, default="draft")
    created_at   = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at   = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    profile          = relationship("WorkflowProfile",  back_populates="project", uselist=False,  cascade="all, delete-orphan")
    transcripts      = relationship("Transcript",       back_populates="project", cascade="all, delete-orphan")
    jobs             = relationship("Job",              back_populates="project", cascade="all, delete-orphan")
    tool_evaluations = relationship("ToolEvaluation",   back_populates="project", cascade="all, delete-orphan")
    uploads          = relationship("UploadedFile",     back_populates="project", cascade="all, delete-orphan")


class PendingInvite(Base):
    __tablename__ = "pending_invites"

    id         = Column(String(36), primary_key=True, default=_uuid)
    token      = Column(String(36), unique=True, index=True, default=_uuid)
    email      = Column(Text, nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at    = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class WorkflowProfile(Base):
    __tablename__ = "workflow_profiles"

    id                       = Column(String(36), primary_key=True, default=_uuid)
    project_id               = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    role                     = Column(Text, nullable=False)
    selected_responsibilities = Column(JSON, nullable=False, default=list)
    tools                    = Column(Text)
    description              = Column(Text)
    created_at               = Column(DateTime(timezone=True), nullable=False, default=_now)

    project = relationship("Project", back_populates="profile")


class Transcript(Base):
    __tablename__ = "transcripts"

    id               = Column(String(36), primary_key=True, default=_uuid)
    project_id       = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    interviewee_name = Column(Text, nullable=False)
    interviewee_role = Column(Text, nullable=False)
    interview_date   = Column(String(10), nullable=False)  # ISO date "YYYY-MM-DD"
    raw_text         = Column(Text, nullable=False)
    tasks_extracted  = Column(Integer)   # set after parse job completes
    tasks_updated    = Column(Integer)   # set after parse job completes
    processed_at     = Column(DateTime(timezone=True))
    created_at       = Column(DateTime(timezone=True), nullable=False, default=_now)

    project = relationship("Project", back_populates="transcripts")


class Job(Base):
    __tablename__ = "jobs"

    id            = Column(String(36), primary_key=True, default=_uuid)
    project_id    = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    job_type      = Column(Enum(JobType), nullable=False)
    status        = Column(Enum(JobStatus), nullable=False, default=JobStatus.pending)
    progress_pct  = Column(Integer, nullable=False, default=0)
    current_step  = Column(Text)
    error_message = Column(Text)
    result_data   = Column(JSON)  # summary dict stored after completion
    started_at    = Column(DateTime(timezone=True))
    completed_at  = Column(DateTime(timezone=True))
    created_at    = Column(DateTime(timezone=True), nullable=False, default=_now)

    project = relationship("Project", back_populates="jobs")


class ToolEvaluation(Base):
    __tablename__ = "tool_evaluations"

    id          = Column(String(36), primary_key=True, default=_uuid)
    project_id  = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    use_case    = Column(String(50), nullable=False)   # e.g. "adoption" | "compare"
    tool_name   = Column(Text, nullable=False)
    website_url = Column(Text)
    docs_url    = Column(Text)
    status      = Column(String(20), nullable=False, default="pending")
    created_at  = Column(DateTime(timezone=True), nullable=False, default=_now)

    project           = relationship("Project",          back_populates="tool_evaluations")
    uploads           = relationship("UploadedFile",     back_populates="tool_evaluation")
    simulation_result = relationship("SimulationResult", back_populates="tool_evaluation", uselist=False, cascade="all, delete-orphan")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id                 = Column(String(36), primary_key=True, default=_uuid)
    project_id         = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    tool_evaluation_id = Column(String(36), ForeignKey("tool_evaluations.id", ondelete="SET NULL"), index=True)
    file_type          = Column(String(50), nullable=False)  # "product_docs" | "api_docs" | "case_study"
    original_name      = Column(Text, nullable=False)
    storage_path       = Column(Text, nullable=False)
    size_bytes         = Column(Integer, nullable=False)
    uploaded_at        = Column(DateTime(timezone=True), nullable=False, default=_now)

    project         = relationship("Project",        back_populates="uploads")
    tool_evaluation = relationship("ToolEvaluation", back_populates="uploads")


class SimulationResult(Base):
    __tablename__ = "simulation_results"

    id                        = Column(String(36), primary_key=True, default=_uuid)
    tool_evaluation_id        = Column(String(36), ForeignKey("tool_evaluations.id", ondelete="CASCADE"), nullable=False, unique=True)
    results_json              = Column(JSON, nullable=False)
    final_work_saved_pct      = Column(Float, nullable=False)
    final_throughput_lift_pct = Column(Float, nullable=False)
    created_at                = Column(DateTime(timezone=True), nullable=False, default=_now)

    tool_evaluation = relationship("ToolEvaluation", back_populates="simulation_result")
