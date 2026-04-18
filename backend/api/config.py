import os
from pathlib import Path

from dotenv import load_dotenv

_BASE_DIR = Path(__file__).resolve().parent.parent  # backend/

# Load backend-only env.
load_dotenv(_BASE_DIR / ".env")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{_BASE_DIR / 'data' / 'agileops.db'}",
)

# Supabase — obtain from Supabase Dashboard → Settings → API
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")  # service_role key — keep secret

# Frontend base URL — used for constructing Supabase invite redirect URLs
SITE_URL: str = os.getenv("SITE_URL", "http://localhost:5173")

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
