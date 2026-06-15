"""Integrazione con i sistemi documentali comunali esistenti.

I Comuni usano software certificati per protocollo informatico e Albo Pretorio
(Halley, Maggioli, PA Digitale, Protocomm, ecc.). TrasParentIA non li sostituisce:
- Quando un atto viene pubblicato → spinge i metadati all'Albo esterno via webhook
- Quando si protocolla una comunicazione → legge/invia il numero al sistema esterno
- Se il sistema esterno non è configurato → fallback silenzioso (no-op)

Configurazione via .env:
  ALBO_ESTERNO_URL      URL base del sistema Albo (es. https://albo.comune.xxx.it/api)
  ALBO_ESTERNO_API_KEY  Chiave API del sistema Albo
  PROTOCOLLO_ESTERNO_URL      URL base del sistema di protocollo
  PROTOCOLLO_ESTERNO_API_KEY  Chiave API del sistema di protocollo
"""
import logging
import httpx

from .config import settings

log = logging.getLogger("trasparentia.integrazione")


def _albo_configured() -> bool:
    return bool(settings.ALBO_ESTERNO_URL)


def _prot_configured() -> bool:
    return bool(settings.PROTOCOLLO_ESTERNO_URL)


def pubblica_su_albo(atto: dict) -> dict:
    """Invia i metadati dell'atto al sistema Albo esterno.

    Chiamata automaticamente quando stato → pubblicato.
    Ritorna {"ok": bool, "detail": str, "numero_albo": str|None}.
    Se il sistema non è configurato ritorna {"ok": True, "detail": "non configurato"}.
    """
    if not _albo_configured():
        return {"ok": True, "detail": "Sistema Albo esterno non configurato — pubblicazione solo interna"}

    albo = atto.get("albo") or {}
    payload = {
        "numero_interno": albo.get("numero", ""),
        "tipo": atto.get("tipo", ""),
        "oggetto": atto.get("oggetto", ""),
        "data_pubblicazione": albo.get("dal", ""),
        "data_scadenza": albo.get("al", ""),
        "numero_protocollo": atto.get("protocollo", ""),
        "fonte": "TrasParentIA",
    }
    headers = {"Content-Type": "application/json"}
    if settings.ALBO_ESTERNO_API_KEY:
        headers["X-API-Key"] = settings.ALBO_ESTERNO_API_KEY

    try:
        r = httpx.post(
            f"{settings.ALBO_ESTERNO_URL.rstrip('/')}/pubblica",
            json=payload, headers=headers,
            timeout=10, verify=settings.AI_TLS_VERIFY,
        )
        if r.status_code in (200, 201):
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            numero_albo = body.get("numero_albo") or body.get("id") or ""
            log.info("Atto pubblicato sull'Albo esterno: %s", numero_albo or atto.get("id"))
            return {"ok": True, "detail": f"Pubblicato sull'Albo esterno (HTTP {r.status_code})", "numero_albo": numero_albo}
        return {"ok": False, "detail": f"Albo esterno ha risposto HTTP {r.status_code}: {r.text[:200]}"}
    except Exception as e:
        log.warning("Impossibile raggiungere Albo esterno: %s", e)
        return {"ok": False, "detail": f"Albo esterno non raggiungibile: {e}"}


def registra_protocollo(oggetto: str, mittente: str, ufficio: str, categoria: str) -> dict:
    """Registra una nuova voce nel sistema di protocollo esterno e ritorna il numero assegnato.

    Ritorna {"ok": bool, "numero": str|None, "detail": str}.
    Se non configurato ritorna {"ok": False, "numero": None, "detail": "non configurato"}.
    """
    if not _prot_configured():
        return {"ok": False, "numero": None, "detail": "Sistema protocollo esterno non configurato"}

    payload = {
        "oggetto": oggetto,
        "mittente": mittente,
        "ufficio_destinatario": ufficio,
        "tipologia": categoria,
        "fonte": "TrasParentIA",
    }
    headers = {"Content-Type": "application/json"}
    if settings.PROTOCOLLO_ESTERNO_API_KEY:
        headers["X-API-Key"] = settings.PROTOCOLLO_ESTERNO_API_KEY

    try:
        r = httpx.post(
            f"{settings.PROTOCOLLO_ESTERNO_URL.rstrip('/')}/registra",
            json=payload, headers=headers,
            timeout=10, verify=settings.AI_TLS_VERIFY,
        )
        if r.status_code in (200, 201):
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            numero = body.get("numero_protocollo") or body.get("numero") or body.get("id") or ""
            log.info("Protocollato su sistema esterno: %s", numero)
            return {"ok": True, "numero": numero, "detail": f"Numero assegnato dal sistema esterno: {numero}"}
        return {"ok": False, "numero": None, "detail": f"Sistema protocollo ha risposto HTTP {r.status_code}: {r.text[:200]}"}
    except Exception as e:
        log.warning("Impossibile raggiungere sistema protocollo esterno: %s", e)
        return {"ok": False, "numero": None, "detail": f"Sistema protocollo non raggiungibile: {e}"}


def test_connessione(tipo: str) -> dict:
    """Verifica la connessione al sistema esterno (albo | protocollo).
    Chiama GET /ping o GET /status sul sistema configurato."""
    if tipo == "albo":
        if not _albo_configured():
            return {"ok": False, "configurato": False, "detail": "ALBO_ESTERNO_URL non impostato"}
        url = f"{settings.ALBO_ESTERNO_URL.rstrip('/')}/ping"
        headers = {"X-API-Key": settings.ALBO_ESTERNO_API_KEY} if settings.ALBO_ESTERNO_API_KEY else {}
    elif tipo == "protocollo":
        if not _prot_configured():
            return {"ok": False, "configurato": False, "detail": "PROTOCOLLO_ESTERNO_URL non impostato"}
        url = f"{settings.PROTOCOLLO_ESTERNO_URL.rstrip('/')}/ping"
        headers = {"X-API-Key": settings.PROTOCOLLO_ESTERNO_API_KEY} if settings.PROTOCOLLO_ESTERNO_API_KEY else {}
    else:
        return {"ok": False, "configurato": False, "detail": f"Tipo non riconosciuto: {tipo}"}

    try:
        r = httpx.get(url, headers=headers, timeout=5, verify=settings.AI_TLS_VERIFY)
        return {"ok": r.status_code < 400, "configurato": True, "detail": f"HTTP {r.status_code}"}
    except Exception as e:
        return {"ok": False, "configurato": True, "detail": str(e)}
