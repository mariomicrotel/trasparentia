"""SUE: tabella istanze_sue (sportello unico edilizia)

Revision ID: 0005_istanze_sue
Revises: 0004_albo_pretorio
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_istanze_sue"
down_revision = "0004_albo_pretorio"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "istanze_sue" not in set(sa.inspect(bind).get_table_names()):
        op.create_table(
            "istanze_sue",
            sa.Column("id", sa.String, primary_key=True),
            sa.Column("cui", sa.String, nullable=False),
            sa.Column("context", sa.String, nullable=False, server_default="SUE"),
            sa.Column("subContext", sa.String, nullable=False, server_default="SUE Residenziale"),
            sa.Column("procedimentoId", sa.String, nullable=False),
            sa.Column("procedimento", sa.Text, nullable=False),
            sa.Column("regime", sa.String, nullable=False, server_default=""),
            sa.Column("presentatoreNome", sa.String, nullable=False, server_default=""),
            sa.Column("presentatoreCF", sa.String, nullable=False, server_default=""),
            sa.Column("presentatoreEmail", sa.String, nullable=False, server_default=""),
            sa.Column("datiModulo", sa.JSON, nullable=False, server_default="{}"),
            sa.Column("allegati", sa.JSON, nullable=False, server_default="[]"),
            sa.Column("stato", sa.String, nullable=False, server_default="presentata"),
            sa.Column("praticaId", sa.String, nullable=True),
            sa.Column("protocollo", sa.String, nullable=True),
            sa.Column("creato", sa.String, nullable=False),
        )


def downgrade() -> None:
    op.drop_table("istanze_sue")
