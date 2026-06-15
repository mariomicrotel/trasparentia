"""Motore promemoria scadenze (Fase 6).
APScheduler embedded: nessun servizio esterno aggiuntivo.
Genera notifiche persistenti per scadenze imminenti e pratiche in ritardo."""
import uuid
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler

from .db import SessionLocal
from . import models, mailer
from .config import settings
from .reference import USERS, ENTE

_scheduler = BackgroundScheduler(daemon=True)

_SUSPEND = {"in_attesa_integrazione", "in_attesa_parere"}
_CLOSED = {"conclusa", "archiviata"}


def _today():
    return date.today().isoformat()


def genera_notifiche():
    """Scansiona pratiche aperte e genera notifiche di scadenza (idempotente per giorno)."""
    if not settings.NOTIFICHE_ENABLED:
        return
    db = SessionLocal()
    try:
        today = date.today()
        pratiche = db.query(models.Pratica).all()
        nuove = 0

        for p in pratiche:
            if p.stato in _CLOSED or not p.scadenza:
                continue
            try:
                scad = date.fromisoformat(p.scadenza)
            except ValueError:
                continue

            sospesa = p.stato in _SUSPEND
            giorni = (scad - today).days

            if giorni < 0 and not sospesa:
                exists = db.query(models.Notifica).filter(
                    models.Notifica.praticaId == p.id,
                    models.Notifica.tipo == "in_ritardo",
                    models.Notifica.creata == today.isoformat(),
                ).first()
                if not exists:
                    ritardo = abs(giorni)
                    n = models.Notifica(
                        id=uuid.uuid4().hex,
                        tipo="in_ritardo",
                        livello="danger",
                        titolo=f"Pratica in ritardo: {p.oggetto[:60]}",
                        corpo=f"La pratica {p.id} era in scadenza il {p.scadenza} "
                              f"(ritardo: {ritardo} giorn{'o' if ritardo == 1 else 'i'}).",
                        praticaId=p.id,
                        destinatario=p.responsabile,
                        letta=False,
                        creata=today.isoformat(),
                    )
                    db.add(n)
                    nuove += 1

            elif giorni in settings.PROMEMORIA_SOGLIE and not sospesa:
                exists = db.query(models.Notifica).filter(
                    models.Notifica.praticaId == p.id,
                    models.Notifica.tipo == "scadenza_imminente",
                    models.Notifica.creata == today.isoformat(),
                ).first()
                if not exists:
                    if giorni == 0:
                        lbl = "scade oggi"
                    elif giorni == 1:
                        lbl = "scade domani"
                    else:
                        lbl = f"scade tra {giorni} giorni"
                    livello = "danger" if giorni <= 1 else "warning"
                    n = models.Notifica(
                        id=uuid.uuid4().hex,
                        tipo="scadenza_imminente",
                        livello=livello,
                        titolo=f"Scadenza imminente: {p.oggetto[:60]}",
                        corpo=f"La pratica {p.id} {lbl} ({p.scadenza}).",
                        praticaId=p.id,
                        destinatario=p.responsabile,
                        letta=False,
                        creata=today.isoformat(),
                    )
                    db.add(n)
                    nuove += 1

        db.commit()
        if nuove:
            print(f"[notifiche] Generate {nuove} notifiche di scadenza.")
            _invia_digest_email(db)
    except Exception as e:
        print(f"[notifiche] Errore scheduler: {e}")
    finally:
        db.close()


def _invia_digest_email(db):
    """Recapita un digest email per responsabile con le notifiche di oggi non lette.
    Opt-in: richiede NOTIFICHE_EMAIL_ENABLED=true e SMTP configurato."""
    if not settings.NOTIFICHE_EMAIL_ENABLED or not mailer.configured():
        return
    oggi = date.today().isoformat()
    da_inviare = db.query(models.Notifica).filter(
        models.Notifica.creata == oggi,
        models.Notifica.destinatario.isnot(None),
        models.Notifica.inviataEmail.is_(False),
    ).all()
    if not da_inviare:
        return

    per_dest: dict[str, list] = {}
    for n in da_inviare:
        per_dest.setdefault(n.destinatario, []).append(n)

    for dest, items in per_dest.items():
        utente = USERS.get(dest, {})
        email = utente.get("email")
        if not email:
            continue
        righe = [f"• [{'RITARDO' if n.tipo == 'in_ritardo' else 'SCADENZA'}] {n.titolo}\n  {n.corpo}"
                 for n in items]
        corpo = (
            f"Gentile {utente.get('nome', dest)},\n\n"
            f"riepilogo delle scadenze che richiedono la sua attenzione "
            f"({len(items)} segnalazion{'e' if len(items) == 1 else 'i'}):\n\n"
            + "\n\n".join(righe)
            + f"\n\nAcceda alla piattaforma TrasParentIA per gestire le pratiche.\n\n"
            f"— {ENTE['nome']}\n(Messaggio automatico, non rispondere)"
        )
        res = mailer.send(email, f"[TrasParentIA] {len(items)} scadenza/e da presidiare", corpo)
        if res.get("ok"):
            for n in items:
                n.inviataEmail = True
    db.commit()


def start_scheduler():
    if not settings.NOTIFICHE_ENABLED:
        return
    genera_notifiche()
    _scheduler.add_job(genera_notifiche, "interval",
                       hours=settings.SCHEDULER_INTERVAL_HOURS,
                       id="check_scadenze", replace_existing=True)
    _scheduler.start()


def stop_scheduler():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
