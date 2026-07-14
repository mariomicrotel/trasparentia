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

    "LINK_ALBO_PRETORIO":      ("lookfeel", "Albo Pretorio online (URL)",           "url",      False),
    "LINK_AMM_TRASPARENTE":    ("lookfeel", "Amministrazione Trasparente (URL)",    "url",      False),
    "LINK_SITO_ISTITUZIONALE": ("lookfeel", "Sito istituzionale (URL)",             "url",      False),
    "LINK_URP":                ("lookfeel", "URP / Contatti (URL)",                 "url",      False),

    "ALBO_SCRAPE_URL":              ("albo", "Pagina elenco pubblicazioni (mappa del sito / novità)", "url",  False),
    "ALBO_SCRAPE_ENABLED":          ("albo", "Sincronizzazione automatica attiva",                    "bool", False),
    "ALBO_SCRAPE_INTERVAL_MINUTES": ("albo", "Intervallo sincronizzazione (minuti)",                  "number", False),
}

_SENSITIVE = {"AI_API_KEY", "PEC_PASSWORD", "SMTP_PASSWORD"}

# Chiavi persistite direttamente nel file .env (non nel DB): l'interfaccia le
# scrive lì, così sono la sorgente di verità visibile nel deployment. Applicate
# comunque live all'atto del salvataggio (effetto immediato senza riavvio).
_ENV_PERSIST = {
    "LINK_ALBO_PRETORIO", "LINK_AMM_TRASPARENTE",
    "LINK_SITO_ISTITUZIONALE", "LINK_URP",
}


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
    """Salva le modifiche e le applica live al settings object. Le chiavi in
    _ENV_PERSIST vengono scritte nel file .env (non nel DB); le altre nel DB."""
    oggi = date.today().isoformat()
    cambiati: list[str] = []
    env_updates: dict[str, str] = {}
    riavvio = False
    for key, val in cambiamenti.items():
        if key not in SCHEMA:
            continue
        if key in _SENSITIVE and str(val) == "":
            continue  # campo password vuoto = invariato
        if SCHEMA[key][3]:
            riavvio = True
        str_val = str(val)
        if key in _ENV_PERSIST:
            env_updates[key] = str_val
            # Rimuovi un eventuale override DB residuo: la sorgente è il .env.
            db.query(models.ImpostazioneConfig).filter(
                models.ImpostazioneConfig.chiave == key
            ).delete(synchronize_session=False)
        else:
            row = db.query(models.ImpostazioneConfig).filter(
                models.ImpostazioneConfig.chiave == key
            ).first()
            if row:
                row.valore = str_val
                row.modificata = oggi
            else:
                db.add(models.ImpostazioneConfig(chiave=key, valore=str_val, modificata=oggi))
        cambiati.append(key)

    avviso = None
    if env_updates:
        try:
            from .env_file import scrivi
            scrivi(settings.ENV_FILE_PATH, env_updates)
        except Exception as e:
            # Non fatale: applichiamo comunque live; segnaliamo che il .env non
            # è scrivibile (es. mount mancante) → non persisterà al riavvio.
            avviso = f"Impossibile scrivere {settings.ENV_FILE_PATH}: {e}"
    if cambiati:
        db.commit()
        apply_overrides({k: cambiamenti[k] for k in cambiati})
    res = {"ok": True, "cambiati": cambiati, "riavvio_necessario": riavvio}
    if avviso:
        res["avviso"] = avviso
    return res


def carica_da_db(db) -> None:
    """Carica le impostazioni salvate nel DB e le applica live al settings object
    (chiamato all'avvio). Le chiavi _ENV_PERSIST sono ignorate: la loro sorgente è
    il file .env (letto da Settings all'avvio), non il DB."""
    overrides = {r.chiave: r.valore for r in db.query(models.ImpostazioneConfig).all()
                 if r.chiave not in _ENV_PERSIST}
    if overrides:
        apply_overrides(overrides)
