"""baseline: schema iniziale TrasParentIA

Migrazione di partenza. Riproduce lo schema corrente creando tutte le tabelle
dai modelli SQLAlchemy (equivalente al precedente `create_all`) e abilita pgvector.
Le modifiche di schema successive vanno gestite con migrazioni autogenerate:
    alembic revision --autogenerate -m "descrizione"

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-24
"""
from alembic import op

from app.db import Base
import app.models  # noqa: F401  (registra le tabelle su Base.metadata)

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    Base.metadata.create_all(bind=bind)
    # colonne geografiche dei beni (coerenti con init_db)
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE beni ADD COLUMN IF NOT EXISTS lat FLOAT")
        op.execute("ALTER TABLE beni ADD COLUMN IF NOT EXISTS lon FLOAT")


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
