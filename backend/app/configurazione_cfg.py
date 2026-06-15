"""Gestione impostazioni di configurazione runtime (persistono nel DB, sovrascrivono .env)."""
from datetime import date
from . import models
from .config import settings, apply_overrides

# (servizio, etichetta UI, tipo campo, richiede riavvio)
SCHEMA: dict[str, tuple] = {
    "OLLAMA_BASE_URL":         ("ai",       "URL server AI",                       "url",      False),
    "AI_API_KEY":              ("ai",       "Chiave API (X-API-Key)",               "password", False),
    "AI_MODEL_GEN":            ("ai",       "Modello generazione/classificazione",  "text",     False),
    "AI_MODEL_DRAFT":          ("ai",       "Modello bozze (vuoto = AI_MODEL_GEN)", "text",     False),
    "AI_MODEL_EMBED":          ("ai",       "Modello embedding (pgvector)",         "text",     False),
    "AI_TLS_VERIFY":           ("ai",       "Verifica certificato TLS",             "bool",     False),

    "PEC_HOST":                ("imap",     "Host IMAP",                            "text",     False),
    "PEC_PORT":                ("imap",     "Porta IMAP",                           "number",   False),
    "PEC_USER":                ("imap",     "Utente / indirizzo PEC",               "text",     False),
    "PEC_PASSWORD":            ("imap",     "Password PEC",                         "password", False),
    "PEC_FOLDER":              ("imap",     "Cartella",                             "text",     False),

    "SMTP_HOST":               ("smtp",     "Host SMTP/PEC",                        "text",     False),
    "SMTP_PORT":               ("smtp",     "Porta SMTP",                           "number",   False),
    "SMTP_USER":               ("smtp",     "Utente SMTP",                          "text",     False),
    "SMTP_PASSWORD":           ("smtp",     "Password SMTP",                        "password", False),
    "SMTP_FROM":               ("smtp",     "Indirizzo mittente",                   "text",     False),
    "SMTP_TLS":                ("smtp",     "Usa STARTTLS/SSL",                     "bool",     False),
    "NOTIFICHE_EMAIL_ENABLED": ("smtp",     "Invia digest email promemoria",        "bool",     False),

    "KC_AUTH_ENABLED":         ("keycloak", "Abilita autenticazione Keycloak",      "bool",     True),
    "KC_PUBLIC_URL":           ("keycloak", "URL Keycloak (pubblico)",              "url",      True),
    "KC_INTERNAL_URL":         ("keycloak", "URL Keycloak (interno Docker)",        "url",      True),
    "KC_REALM":                ("keycloak", "Realm",                                "text",     True),
    "KC_CLIENT_ID":            ("keycloak", "Client ID",                            "text",     True),

    "ENTE_NOME":               ("lookfeel", "Nome dell'ente",                       "text",     False),
    "ENTE_PROV":               ("lookfeel", "Provincia (sigla 2 caratteri)",        "text",     False),
    "ENTE_CAP":                ("lookfeel", "CAP",                                  "text",     False),
    "ENTE_ABITANTI":           ("lookfeel", "Numero di abitanti",                   "number",   False),
    "ENTE_PEC":                ("lookfeel", "PEC istituzionale dell'ente",          "text",     False),
    "TEMA_BLU":                ("lookfeel", "Colore primario (esadecimale #rrggbb)", "text",    False),
}

_SENSITIVE = {"AI_API_KEY", "PEC_PASSWORD", "SMTP_PASSWORD"}


def _live_val(key: str) -> str:
    v = getattr(settings, key, "")
    return "" if v is None else str(v)


def leggi_tutte(db) -> dict:
    """Restituisce tutte le impostazioni modificabili raggruppate per servizio."""
    overrides = {r.chiave: r.valore for r in db.query(models.ImpostazioneConfig).all()}
    grouped: dict[str, list] = {}
    for key, (srv, label, tipo, riavvio) in SCHEMA.items():
        grouped.setdefault(srv, []).append({
            "key": key,
            "label": label,
            "tipo": tipo,
            "valore": "" if key in _SENSITIVE else overrides.get(key, _live_val(key)),
            "riavvio": riavvio,
        })
    return {"servizi": grouped}


def salva(db, cambiamenti: dict) -> dict:
    """Salva le modifiche nel DB e le applica live al settings object."""
    oggi = date.today().isoformat()
    cambiati: list[str] = []
    riavvio = False
    for key, val in cambiamenti.items():
        if key not in SCHEMA:
            continue
        if key in _SENSITIVE and str(val) == "":
            continue  # campo password vuoto = invariato
        if SCHEMA[key][3]:
            riavvio = True
        str_val = str(val)
        row = db.query(models.ImpostazioneConfig).filter(
            models.ImpostazioneConfig.chiave == key
        ).first()
        if row:
            row.valore = str_val
            row.modificata = oggi
        else:
            db.add(models.ImpostazioneConfig(chiave=key, valore=str_val, modificata=oggi))
        cambiati.append(key)
    if cambiati:
        db.commit()
        apply_overrides({k: cambiamenti[k] for k in cambiati})
    return {"ok": True, "cambiati": cambiati, "riavvio_necessario": riavvio}


def carica_da_db(db) -> None:
    """Carica le impostazioni salvate nel DB e le applica live al settings object (chiamato all'avvio)."""
    overrides = {r.chiave: r.valore for r in db.query(models.ImpostazioneConfig).all()}
    if overrides:
        apply_overrides(overrides)
