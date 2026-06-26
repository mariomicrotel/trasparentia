"""TrasParentIA Micro PA — entrypoint FastAPI."""
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .seed import init_db
from . import storage
from .api import router
from .notifiche import start_scheduler, stop_scheduler

log = logging.getLogger("trasparentia")

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


_DEFAULT_CREDS = {
    "trasparentia", "admin", "password",
    "CAMBIA_QUESTA_PASSWORD_DB", "CAMBIA_IN_PRODUZIONE",
    "demo-restic-key-docker-desktop",
    "CAMBIA_QUESTA_CHIAVE_JWT_IN_PRODUZIONE",
}


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
    if (settings.KC_ADMIN_PASSWORD or "") in _DEFAULT_CREDS:
        problemi.append("KC_ADMIN_PASSWORD di default (Keycloak admin panel esposto)")
    if (settings.RESTIC_PASSWORD or "") in _DEFAULT_CREDS:
        problemi.append("RESTIC_PASSWORD di default — backup non cifrati in modo sicuro")
    if settings.NATIVE_AUTH_ENABLED and (settings.JWT_SECRET_KEY or "") in _DEFAULT_CREDS:
        problemi.append("JWT_SECRET_KEY di default — token di sessione non sicuri")

    if settings.PRODUCTION and problemi:
        msg = "AVVIO BLOCCATO (PRODUCTION=true): " + "; ".join(problemi) + \
              ". Correggere le impostazioni o impostare PRODUCTION=false per la demo."
        log.critical(msg)
        raise RuntimeError(msg)
    for p in problemi:
        log.warning("SICUREZZA: %s — NON adatto alla produzione", p)


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    log.error("Errore non gestito %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Errore interno del server"})


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
    from .ai import client as ai_client
    ai_client.close()


@app.get("/health")
def health():
    return {"status": "ok", "service": "trasparentia-backend"}


@app.get("/readiness")
def readiness():
    """Readiness probe: verifica DB, storage e Redis. Restituisce 200 se tutto ok, 503 se degradato."""
    from sqlalchemy import text
    from .db import SessionLocal
    checks: dict[str, str] = {}

    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"error: {e}"

    try:
        storage.ensure_bucket()
        checks["storage"] = "ok"
    except Exception as e:
        checks["storage"] = f"error: {e}"

    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        r.close()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={"status": "ready" if all_ok else "degraded", "checks": checks},
    )


@app.get("/")
def root():
    return {"name": "TrasParentIA Micro PA — API", "docs": "/docs"}
