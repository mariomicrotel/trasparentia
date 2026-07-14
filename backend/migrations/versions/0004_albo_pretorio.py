"""albo pretorio: tabella atti_albo (pubblicazioni scrapate)

Revision ID: 0004_albo_pretorio
Revises: 0003_normativa
Create Date: 2026-07-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_albo_pretorio"
down_revision = "0003_normativa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Idempotente: su DB creato via create_all dai modelli correnti la tabella
    # può già esistere.
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())
    if "atti_albo" not in existing:
        op.create_table(
            "atti_albo",
            sa.Column("id", sa.String, primary_key=True),
            sa.Column("titolo", sa.Text, nullable=False),
            sa.Column("urlPagina", sa.Text, nullable=False),
            sa.Column("categoria", sa.String, nullable=True),
            sa.Column("dataPubblicazione", sa.String, nullable=True),
            sa.Column("dataScadenza", sa.String, nullable=True),
            sa.Column("testo", sa.Text, nullable=False, server_default=""),
            sa.Column("hashContenuto", sa.String, nullable=True),
            sa.Column("creato", sa.String, nullable=False),
            sa.Column("aggiornato", sa.String, nullable=False),
        )


def downgrade() -> None:
    op.drop_table("atti_albo")
