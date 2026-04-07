import os
from pathlib import Path

_BASE_DIR = Path(__file__).resolve().parent.parent  # backend/

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{_BASE_DIR / 'data' / 'agileops.db'}",
)

# Set to postgresql+asyncpg://user:pass@host/agileops for production
# Requires: pip install asyncpg (already in requirements.txt)

CORS_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:4173",  # Vite preview
]

# Project-scoped data directory — all pipeline JSON files live under here
DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(_BASE_DIR / "data")))

# Maximum file upload size (50 MB)
UPLOAD_MAX_BYTES: int = int(os.getenv("UPLOAD_MAX_BYTES", str(50 * 1024 * 1024)))
