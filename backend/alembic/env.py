from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

from backend.api.models.db import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _sync_url() -> str:
    """Return a sync-compatible DB URL for alembic (swap asyncpg/aiosqlite → psycopg2/sqlite)."""
    from backend.api.config import DATABASE_URL
    url = DATABASE_URL
    if "+asyncpg" in url:
        url = url.replace("+asyncpg", "+psycopg2", 1)
    elif "+aiosqlite" in url:
        url = url.replace("+aiosqlite", "", 1)
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = _sync_url()
    connectable = engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
