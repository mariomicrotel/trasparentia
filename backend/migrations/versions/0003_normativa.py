"""corpus normativo: tabelle regolamenti e norma_chunks

Revision ID: 0003_normativa
Revises: 0002_native_auth
Create Date: 2026-07-13
"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from app.config import settings

revision = "0003_normativa"
down_revision = "0002_native_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotente: su DB creato via create_all dai modelli correnti le tabelle
    # possono già esistere. Crea solo se assenti.
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())

    if "regolamenti" not in existing:
        op.create_table(
            "regolamenti",
            sa.Column("id", sa.String, primary_key=True),
            sa.Column("titolo", sa.Text, nullable=False),
            sa.Column("materia", sa.String, nullable=True),
            sa.Column("fonte", sa.String, nullable=True),
            sa.Column("vigente", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("nArticoli", sa.Integer, nullable=False, server_default="0"),
            sa.Column("creato", sa.String, nullable=False),
            sa.Column("aggiornato", sa.String, nullable=False),
        )

    if "norma_chunks" not in existing:
        op.create_table(
            "norma_chunks",
            sa.Column("id", sa.String, primary_key=True),
            sa.Column("regolamentoId", sa.String, nullable=False),
            sa.Column("regolamento", sa.Text, nullable=False),
            sa.Column("articolo", sa.String, nullable=True),
            sa.Column("rubrica", sa.Text, nullable=True),
            sa.Column("materia", sa.String, nullable=True),
            sa.Column("vigente", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("testo", sa.Text, nullable=False, server_default=""),
            sa.Column("embedding", Vector(settings.EMBED_DIM), nullable=True),
        )
        op.create_index("ix_norma_chunks_regolamentoId", "norma_chunks", ["regolamentoId"])


def downgrade() -> None:
    op.drop_table("norma_chunks")
    op.drop_table("regolamenti")
