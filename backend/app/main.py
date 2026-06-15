"""TrasParentIA Micro PA — entrypoint FastAPI."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .seed import init_db
from . import storage
from .api import router
from .notifiche import start_scheduler, stop_scheduler

app = FastAPI(title="TrasParentIA Micro PA", version="0.1.0",
              description="Piattaforma AI on-prem di supporto ai piccoli Comuni (fetta verticale Ufficio Tecnico).")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


_DEFAULT_CREDS = {"trasparentia", "admin", "password", "CAMBIA_QUESTA_PASSWORD_DB"}


def _security_warnings():
    import logging
    log = logging.getLogger("trasparentia.security")
    db_url = settings.DATABASE_URL or ""
    # Estrai password da DATABASE_URL: postgresql+psycopg2://user:password@host/db
    if "://" in db_url:
        try:
            pwd_part = db_url.split("://", 1)[1].split("@")[0].split(":", 1)[1]
            if pwd_part in _DEFAULT_CREDS:
                log.warning("SICUREZZA: password database è quella di default — cambiarla prima del go-live")
        except Exception:
            pass
    minio_secret = settings.MINIO_SECRET_KEY or ""
    if minio_secret in _DEFAULT_CREDS:
        log.warning("SICUREZZA: MINIO_SECRET_KEY è quella di default — cambiarla prima del go-live")
    if not settings.KC_AUTH_ENABLED:
        log.warning("SICUREZZA: KC_AUTH_ENABLED=false — autenticazione Keycloak disabilitata (ok in demo, NON in produzione)")


@app.on_event("startup")
def _startup():
    _security_warnings()
    init_db()
    storage.ensure_bucket()
    from .db import SessionLocal
    from . import configurazione_cfg
    with SessionLocal() as db:
        configurazione_cfg.carica_da_db(db)
    start_scheduler()


@app.on_event("shutdown")
def _shutdown():
    stop_scheduler()


@app.get("/health")
def health():
    return {"status": "ok", "service": "trasparentia-backend"}


@app.get("/")
def root():
    return {"name": "TrasParentIA Micro PA — API", "docs": "/docs"}
