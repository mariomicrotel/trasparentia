"""Diagnostica dei servizi di connessione (Fase 3+7).
Ogni check ritorna {ok: bool, detail: str}. La vista di configurazione mostra
lo stato live e permette di provare ogni connessione. I segreti sono mascherati."""
import imaplib

import httpx
from sqlalchemy import text

from .config import settings
from .db import SessionLocal
from . import storage, mailer
from .ai import client as ai


def _mask(value: str) -> str:
    """Maschera un segreto: mostra solo gli ultimi 2 caratteri."""
    if not value:
        return ""
    if len(value) <= 4:
        return "••••"
    return "••••" + value[-2:]


# ---------- check singoli ----------
def check_db() -> dict:
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        motore = "PostgreSQL" if settings.DATABASE_URL.startswith("postgresql") else "SQLite"
        return {"ok": True, "detail": f"{motore} raggiungibile."}
    except Exception as e:
        return {"ok": False, "detail": f"Errore DB: {e}"}


def check_ai() -> dict:
    """Check veloce per il caricamento della pagina — solo /api/tags, nessuna inferenza."""
    s = ai.status()
    if s.get("online"):
        modello = settings.AI_MODEL_GEN
        avail = "disponibile" if s.get("model_available") else "NON trovato sul server"
        return {"ok": s.get("model_available", False),
                "detail": f"Ollama online · modello «{modello}» {avail}."}
    return {"ok": False, "detail": f"Server AI non raggiungibile: {s.get('error', 'errore sconosciuto')}"}


def check_imap() -> dict:
    if not (settings.PEC_HOST and settings.PEC_USER and settings.PEC_PASSWORD):
        return {"ok": False, "detail": "PEC non configurata (PEC_HOST, PEC_USER, PEC_PASSWORD)."}
    try:
        M = imaplib.IMAP4_SSL(settings.PEC_HOST, settings.PEC_PORT)
        M.login(settings.PEC_USER, settings.PEC_PASSWORD)
        typ, _ = M.select(settings.PEC_FOLDER, readonly=True)
        if typ != "OK":
            M.logout()
            return {"ok": False, "detail": f"Cartella «{settings.PEC_FOLDER}» non trovata."}
        typ, data = M.search(None, "ALL")
        tot = len(data[0].split()) if data and data[0] else 0
        typ, undata = M.search(None, "UNSEEN")
        non_lette = len(undata[0].split()) if undata and undata[0] else 0
        M.logout()
        return {"ok": True, "detail": f"Login OK · cartella «{settings.PEC_FOLDER}»: {tot} messaggi ({non_lette} non letti)."}
    except Exception as e:
        return {"ok": False, "detail": f"Errore IMAP: {e}"}


def check_smtp() -> dict:
    return mailer.test_connection()


def check_minio() -> dict:
    if storage.available():
        return {"ok": True, "detail": f"MinIO raggiungibile · bucket «{settings.MINIO_BUCKET}» pronto."}
    return {"ok": False, "detail": f"MinIO non raggiungibile su {settings.MINIO_ENDPOINT}."}


def check_keycloak() -> dict:
    if not settings.KC_AUTH_ENABLED:
        return {"ok": None, "detail": "Disabilitato (modalità demo role-switch). Abilitare con KC_AUTH_ENABLED=true."}
    try:
        url = f"{settings.KC_INTERNAL_URL}/realms/{settings.KC_REALM}/protocol/openid-connect/certs"
        r = httpx.get(url, timeout=5)
        r.raise_for_status()
        n = len(r.json().get("keys", []))
        return {"ok": True, "detail": f"Realm «{settings.KC_REALM}» raggiungibile · {n} chiavi JWKS."}
    except Exception as e:
        return {"ok": False, "detail": f"Keycloak non raggiungibile: {e}"}


# ---------- registro servizi ----------
# _CHECKS_FAST: usato da panoramica() al caricamento pagina (nessuna inferenza AI)
_CHECKS_FAST = {
    "db": check_db,
    "ai": check_ai,
    "imap": check_imap,
    "smtp": check_smtp,
    "minio": check_minio,
    "keycloak": check_keycloak,
}

# _CHECKS_FULL: usato da test_servizio() — "Prova connessione" nel frontend
# AI usa test_inference() che esegue un'inferenza reale con log step-by-step
_CHECKS_FULL = {
    **_CHECKS_FAST,
    "ai": ai.test_inference,
}


def _config_view() -> dict:
    """Configurazione corrente (sola lettura, segreti mascherati)."""
    return {
        "ai": {"OLLAMA_BASE_URL": settings.OLLAMA_BASE_URL, "AI_MODEL_GEN": settings.AI_MODEL_GEN,
               "AI_MODEL_DRAFT": settings.AI_MODEL_DRAFT or "(usa AI_MODEL_GEN)",
               "AI_MODEL_EMBED": settings.AI_MODEL_EMBED, "AI_API_KEY": _mask(settings.AI_API_KEY)},
        "imap": {"PEC_HOST": settings.PEC_HOST or "(non impostato)", "PEC_PORT": settings.PEC_PORT,
                 "PEC_USER": settings.PEC_USER or "(non impostato)", "PEC_PASSWORD": _mask(settings.PEC_PASSWORD),
                 "PEC_FOLDER": settings.PEC_FOLDER},
        "smtp": {"SMTP_HOST": settings.SMTP_HOST or "(non impostato)", "SMTP_PORT": settings.SMTP_PORT,
                 "SMTP_USER": settings.SMTP_USER or "(non impostato)", "SMTP_PASSWORD": _mask(settings.SMTP_PASSWORD),
                 "SMTP_FROM": settings.SMTP_FROM or "(non impostato)", "SMTP_TLS": settings.SMTP_TLS,
                 "NOTIFICHE_EMAIL_ENABLED": settings.NOTIFICHE_EMAIL_ENABLED},
        "minio": {"MINIO_ENDPOINT": settings.MINIO_ENDPOINT, "MINIO_BUCKET": settings.MINIO_BUCKET,
                  "MINIO_ACCESS_KEY": settings.MINIO_ACCESS_KEY, "MINIO_SECRET_KEY": _mask(settings.MINIO_SECRET_KEY),
                  "MINIO_SECURE": settings.MINIO_SECURE},
        "keycloak": {"KC_AUTH_ENABLED": settings.KC_AUTH_ENABLED, "KC_INTERNAL_URL": settings.KC_INTERNAL_URL,
                     "KC_PUBLIC_URL": settings.KC_PUBLIC_URL, "KC_REALM": settings.KC_REALM,
                     "KC_CLIENT_ID": settings.KC_CLIENT_ID},
        "db": {"motore": "PostgreSQL" if settings.DATABASE_URL.startswith("postgresql") else "SQLite"},
    }


_SERVIZI_META = [
    {"key": "ai", "nome": "Server AI (Ollama)", "ico": "sparkles",
     "ruolo": "Classificazione, bozze, ricerca semantica", "critico": False},
    {"key": "imap", "nome": "PEC in entrata (IMAP)", "ico": "mail",
     "ruolo": "Ingestione automatica delle comunicazioni", "critico": False},
    {"key": "smtp", "nome": "Posta in uscita (SMTP/PEC)", "ico": "send",
     "ruolo": "Recapito dei promemoria di scadenza", "critico": False},
    {"key": "minio", "nome": "Storage documenti (MinIO)", "ico": "box",
     "ruolo": "Archiviazione allegati e documenti", "critico": True},
    {"key": "db", "nome": "Database (PostgreSQL)", "ico": "grid",
     "ruolo": "Dati di pratiche, atti, comunicazioni", "critico": True},
    {"key": "keycloak", "nome": "Autenticazione (Keycloak)", "ico": "lock",
     "ruolo": "Single Sign-On e identità utenti", "critico": False},
]


def panoramica() -> dict:
    """Stato di tutti i servizi + configurazione mascherata + metadati. Usa check veloci."""
    cfg = _config_view()
    servizi = []
    for meta in _SERVIZI_META:
        stato = _CHECKS_FAST[meta["key"]]()
        servizi.append({**meta, "stato": stato, "config": cfg.get(meta["key"], {})})
    return {"servizi": servizi}


def test_servizio(key: str) -> dict:
    """Test completo per «Prova connessione» — AI esegue inferenza reale con log."""
    if key not in _CHECKS_FULL:
        return {"ok": False, "detail": f"Servizio «{key}» sconosciuto."}
    return _CHECKS_FULL[key]()
