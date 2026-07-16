"""SUE: presentazione tramite tecnico incaricato delegato

Aggiunge il ruolo del presentatore (in_proprio | tecnico_delegato) e i dati
del delegante (titolare) usati quando la domanda è presentata da un tecnico
per conto del titolare, con procura/delega.

Revision ID: 0007_sue_delega
Revises: 0006_sue_cognome
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_sue_delega"
down_revision = "0006_sue_cognome"
branch_labels = None
depends_on = None

_NEW_COLS = [
    ("ruoloPresentatore", "in_proprio"),
    ("deleganteNome", ""),
    ("deleganteCognome", ""),
    ("deleganteCF", ""),
]


def upgrade() -> None:
    bind = op.get_bind()
    cols = {c["name"] for c in sa.inspect(bind).get_columns("istanze_sue")}
    for name, default in _NEW_COLS:
        if name not in cols:
            op.add_column("istanze_sue", sa.Column(name, sa.String,
                                                   nullable=False, server_default=default))


def downgrade() -> None:
    for name, _ in reversed(_NEW_COLS):
        op.drop_column("istanze_sue", name)
