"""Posta in uscita SMTP/PEC (Fase 3+7). Resiliente: se SMTP non è configurato
le funzioni segnalano lo stato senza far cadere l'app. Usato dai promemoria
(Fase 6) per recapitare le notifiche di scadenza ai responsabili."""
import smtplib
import ssl
from email.message import EmailMessage

from .config import settings


def configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


def _connect(timeout: float = 8.0) -> smtplib.SMTP:
    """Apre una connessione SMTP. Porta 465 = SSL implicito, altrimenti STARTTLS opzionale."""
    if settings.SMTP_PORT == 465:
        srv = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT,
                               timeout=timeout, context=ssl.create_default_context())
    else:
        srv = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout)
        srv.ehlo()
        if settings.SMTP_TLS:
            srv.starttls(context=ssl.create_default_context())
            srv.ehlo()
    if settings.SMTP_USER:
        srv.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
    return srv


def test_connection() -> dict:
    """Verifica la connessione SMTP (handshake + eventuale login) senza inviare nulla."""
    if not configured():
        return {"ok": False, "detail": "SMTP non configurato (SMTP_HOST, SMTP_FROM)."}
    try:
        srv = _connect()
        srv.noop()
        srv.quit()
        return {"ok": True, "detail": f"Connessione OK a {settings.SMTP_HOST}:{settings.SMTP_PORT}"
                                      + (" (login riuscito)" if settings.SMTP_USER else "")}
    except Exception as e:
        return {"ok": False, "detail": f"Errore SMTP: {e}"}


def send(to: str, subject: str, body: str) -> dict:
    """Invia un'email di testo. Ritorna {ok, detail}."""
    if not configured():
        return {"ok": False, "detail": "SMTP non configurato."}
    if not to:
        return {"ok": False, "detail": "Destinatario mancante."}
    try:
        msg = EmailMessage()
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        srv = _connect()
        srv.send_message(msg)
        srv.quit()
        return {"ok": True, "detail": f"Inviata a {to}"}
    except Exception as e:
        return {"ok": False, "detail": f"Invio fallito: {e}"}
