"""SUE: separa nome e cognome del presentatore

Revision ID: 0006_sue_cognome
Revises: 0005_istanze_sue
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_sue_cognome"
down_revision = "0005_istanze_sue"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("istanze_sue")}
    if "presentatoreCognome" not in cols:
        op.add_column("istanze_sue", sa.Column("presentatoreCognome", sa.String,
                                                nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("istanze_sue", "presentatoreCognome")
