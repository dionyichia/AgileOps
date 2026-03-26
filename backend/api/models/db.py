import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.types import JSON
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_name = Column(Text, nullable=False)
    team_name = Column(Text, nullable=False)
    primary_role = Column(Text, nullable=False)
    team_size = Column(Integer)
    notes = Column(Text)
    status = Column(String(20), nullable=False, default="draft")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    profile = relationship(
        "WorkflowProfile", back_populates="project", uselist=False, cascade="all, delete-orphan"
    )


class WorkflowProfile(Base):
    __tablename__ = "workflow_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    role = Column(Text, nullable=False)
    selected_responsibilities = Column(JSON, nullable=False, default=list)
    tools = Column(Text)
    description = Column(Text)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    project = relationship("Project", back_populates="profile")
