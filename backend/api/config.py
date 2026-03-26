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
