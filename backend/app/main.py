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
    # Metodi e header espliciti (niente "*"): più stretto e compatibile con la demo (X-Role).
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Role"],
)

app.include_router(router)


_DEFAULT_CREDS = {"trasparentia", "admin", "password", "CAMBIA_QUESTA_PASSWORD_DB", "CAMBIA_IN_PRODUZIONE"}


def _db_password() -> str:
    db_url = settings.DATABASE_URL or ""
    if "://" in db_url and "@" in db_url:
        try:
            return db_url.split("://", 1)[1].split("@")[0].split(":", 1)[1]
        except Exception:
            return ""
    return ""


def _security_check():
    """In demo: avvisa. In PRODUCTION: blocca l'avvio (fail-fast) se restano
    configurazioni non sicure — auth disattivata, credenziali di default, API key AI vuota."""
    import logging
    log = logging.getLogger("trasparentia.security")
    problemi = []
    if not settings.KC_AUTH_ENABLED:
        problemi.append("KC_AUTH_ENABLED=false — autenticazione Keycloak disattivata (in demo si usa X-Role)")
    if _db_password() in _DEFAULT_CREDS:
        problemi.append("password del database di default")
    if (settings.MINIO_SECRET_KEY or "") in _DEFAULT_CREDS:
        problemi.append("MINIO_SECRET_KEY di default")
    if not (settings.AI_API_KEY or "").strip():
        problemi.append("AI_API_KEY vuota — il server AI non è protetto da chiave")

    if settings.PRODUCTION and problemi:
        msg = "AVVIO BLOCCATO (PRODUCTION=true): " + "; ".join(problemi) + \
              ". Correggere le impostazioni o impostare PRODUCTION=false per la demo."
        log.critical(msg)
        raise RuntimeError(msg)
    for p in problemi:
        log.warning("SICUREZZA: %s — NON adatto alla produzione", p)


@app.on_event("startup")
def _startup():
    _security_check()
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
