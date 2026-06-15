"""Gestione utenti di piattaforma: CRUD sul DB + sincronizzazione in R.USERS/R.PERM."""
from datetime import date

from sqlalchemy.orm import Session

from . import models, reference as R


def _iniz(nome: str) -> str:
    parts = nome.strip().split()
    return (parts[0][:1] + (parts[-1][:1] if len(parts) > 1 else "")).upper() or "?"


def to_dict(u: models.Utente) -> dict:
    return {
        "id": u.id,
        "nome": u.nome,
        "ruolo": R.KC_ROLE_DISPLAY.get(u.ruolo_kc, "Utente"),
        "ruolo_kc": u.ruolo_kc,
        "ufficio": u.ufficio,
        "iniz": _iniz(u.nome),
        "col": u.col,
        "email": u.email,
        "attivo": u.attivo,
        "creato": u.creato,
    }


def sync_memory(db: Session) -> None:
    """Ricarica R.USERS e R.PERM dal DB. Chiamare dopo ogni operazione CRUD."""
    # Rimuovi gli utenti non più nel DB (eccetto "ai")
    db_ids = {u.id for u in db.query(models.Utente).all()}
    for uid in list(R.USERS.keys()):
        if uid != "ai" and uid not in db_ids:
            R.USERS.pop(uid, None)
            R.PERM.pop(uid, None)

    for u in db.query(models.Utente).all():
        if not u.attivo:
            R.USERS.pop(u.id, None)
            R.PERM.pop(u.id, None)
            continue
        d = to_dict(u)
        R.USERS[u.id] = {k: v for k, v in d.items() if k not in ("attivo", "creato", "ruolo_kc")}
        R.PERM[u.id] = R.KC_ROLE_PERM.get(u.ruolo_kc, {})


# Responsabili di ufficio (un utente per ogni ufficio del catalogo R.UFFICI).
SEED = [
    ("rossi",    "Maria Rossi",            "m.rossi@comune.it",    "Segreteria / Protocollo",  "operatore_protocollo", "#0066cc"),
    ("esposito", "Geom. Luigi Esposito",   "l.esposito@comune.it", "Ufficio Tecnico",          "responsabile_ut",      "#0b7d99"),
    ("bianchi",  "Dott.ssa Anna Bianchi",  "a.bianchi@comune.it",  "Segreteria Generale",      "segretario",           "#6a4ec2"),
    ("deluca",   "Geom. Sara De Luca",     "s.deluca@comune.it",   "Ufficio Tecnico",          "istruttore",           "#1a7a45"),
    ("ferrara",  "Rag. Carla Ferrara",     "c.ferrara@comune.it",  "Ragioneria / Tributi",     "responsabile_ufficio", "#7a4ec2"),
    ("russo",    "Dott. Marco Russo",      "m.russo@comune.it",    "Anagrafe e Stato Civile",  "responsabile_ufficio", "#0b6ea6"),
    ("moretti",  "Comm. Anna Moretti",     "a.moretti@comune.it",  "Polizia Locale",           "responsabile_ufficio", "#c2452f"),
    ("ricci",    "A.S. Lucia Ricci",       "l.ricci@comune.it",    "Servizi Sociali",          "responsabile_ufficio", "#1a7a55"),
]


def seed(db: Session) -> None:
    """Popola/integra la tabella utenti. Idempotente: aggiunge solo gli id mancanti,
    così i responsabili dei nuovi uffici vengono creati anche su DB già inizializzato."""
    today = date.today().isoformat()
    esistenti = {u.id for u in db.query(models.Utente.id).all()}
    aggiunti = False
    for uid, nome, email, ufficio, ruolo_kc, col in SEED:
        if uid in esistenti:
            continue
        db.add(models.Utente(id=uid, nome=nome, email=email, ufficio=ufficio,
                             ruolo_kc=ruolo_kc, col=col, attivo=True, creato=today))
        aggiunti = True
    if aggiunti:
        db.commit()
