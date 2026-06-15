# Patch pgvector.sqlalchemy.Vector → SQLAlchemy Text BEFORE any app import,
# so models.py can be loaded against SQLite (no pgvector extension needed in tests).
import pgvector.sqlalchemy as _pgvec
from sqlalchemy import Text as _Text

_pgvec.Vector = lambda *a, **kw: _Text()

import os

os.environ["DATABASE_URL"] = "sqlite:///./test_tp.db"
os.environ["KC_AUTH_ENABLED"] = "false"
os.environ["NOTIFICHE_ENABLED"] = "false"

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import Base, engine as _engine, get_db
from app.main import app
from app import models

_Session = sessionmaker(bind=_engine)

_HDR = {"X-Role": "bianchi"}  # segretario — permessi completi


def _seed():
    db = _Session()
    try:
        db.add(
            models.Comunicazione(
                id=str(uuid.uuid4()),
                canale="PEC",
                letto=False,
                urgente=False,
                arrivo="2026-01-01T09:00:00",
                mittente={"nome": "Mario Rossi", "email": "rossi@comune.it"},
                oggetto="Richiesta accesso atti",
                corpo=[],
                allegati=[],
                ai={
                    "categoria": "accesso_atti",
                    "confidenza": 0.85,
                    "motivazione": "test",
                },
            )
        )
        db.add(
            models.Pratica(
                id="UT/001",
                fascicolo="FASC/2026/001",
                protocollo="PG/2026/1",
                oggetto="Pratica di collaudo",
                categoria="accesso_atti",
                tipoProcedimento="Accesso agli atti",
                stato="assegnata",
                priorita="media",
                apertura="2026-01-01",
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@pytest.fixture(scope="session")
def client():
    Base.metadata.create_all(bind=_engine)
    _seed()

    def _override_db():
        db = _Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_db
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture(scope="session")
def hdr():
    return _HDR
