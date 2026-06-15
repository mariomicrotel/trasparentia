"""Dati di riferimento del dominio (porting da prototipo data.jsx).
Categorie (§8.2), stati pratica (§8.3), priorità, utenti/ruoli/permessi, atti."""
from datetime import date, timedelta

from .config import settings

# ---- Ente -------------------------------------------------------------
ENTE = {
    "nome": settings.ENTE_NOME,
    "prov": settings.ENTE_PROV,
    "cap": settings.ENTE_CAP,
    "abitanti": settings.ENTE_ABITANTI,
    "pec": settings.ENTE_PEC,
}

# ---- Utenti / ruoli ---------------------------------------------------
# Stato iniziale — sync_memory() sovrascrive con i valori live dal DB
USERS = {
    "rossi":    {"id": "rossi",    "nome": "Maria Rossi",           "ruolo": "Operatore Protocollo",       "ufficio": "Segreteria / Protocollo",  "iniz": "MR", "col": "#0066cc", "email": "m.rossi@comune.roccadaspide.sa.it"},
    "esposito": {"id": "esposito", "nome": "Geom. Luigi Esposito",  "ruolo": "Responsabile Ufficio Tecnico","ufficio": "Ufficio Tecnico",          "iniz": "LE", "col": "#0b7d99", "email": "l.esposito@comune.roccadaspide.sa.it"},
    "bianchi":  {"id": "bianchi",  "nome": "Dott.ssa Anna Bianchi", "ruolo": "Segretario Comunale",        "ufficio": "Segreteria Generale",      "iniz": "AB", "col": "#6a4ec2", "email": "a.bianchi@comune.roccadaspide.sa.it"},
    "deluca":   {"id": "deluca",   "nome": "Geom. Sara De Luca",    "ruolo": "Istruttore",                 "ufficio": "Ufficio Tecnico",          "iniz": "SD", "col": "#1a7a45", "email": "s.deluca@comune.roccadaspide.sa.it"},
    "ferrari":  {"id": "ferrari",  "nome": "Marco Ferrari",         "ruolo": "Istruttore",                 "ufficio": "Ufficio Tecnico",          "iniz": "MF", "col": "#0b5e8a", "email": "m.ferrari@comune.roccadaspide.sa.it"},
    "ferrara":  {"id": "ferrara",  "nome": "Rag. Carla Ferrara",    "ruolo": "Responsabile di Ufficio",    "ufficio": "Ragioneria / Tributi",     "iniz": "CF", "col": "#7a4ec2", "email": "c.ferrara@comune.roccadaspide.sa.it"},
    "russo":    {"id": "russo",    "nome": "Dott. Marco Russo",     "ruolo": "Responsabile di Ufficio",    "ufficio": "Anagrafe e Stato Civile",  "iniz": "MR", "col": "#0b6ea6", "email": "m.russo@comune.roccadaspide.sa.it"},
    "moretti":  {"id": "moretti",  "nome": "Comm. Anna Moretti",    "ruolo": "Responsabile di Ufficio",    "ufficio": "Polizia Locale",           "iniz": "AM", "col": "#c2452f", "email": "a.moretti@comune.roccadaspide.sa.it"},
    "ricci":    {"id": "ricci",    "nome": "A.S. Lucia Ricci",      "ruolo": "Responsabile di Ufficio",    "ufficio": "Servizi Sociali",          "iniz": "LR", "col": "#1a7a55", "email": "l.ricci@comune.roccadaspide.sa.it"},
    "ai":       {"id": "ai",       "nome": "TrasParentIA",          "ruolo": "Assistente AI",              "ufficio": "",                         "iniz": "AI", "col": "#1455a6", "email": ""},
}

# RBAC — permessi per utente (derivati da KC_ROLE_PERM; sync_memory() li ricarica dal DB)
PERM = {
    "rossi":    {"classifica": True,  "prendiCarico": True,  "assegna": True,  "lavora": False, "bozze": False, "supervisione": False},
    "esposito": {"classifica": True,  "prendiCarico": True,  "assegna": True,  "lavora": True,  "bozze": True,  "supervisione": False},
    "bianchi":  {"classifica": False, "prendiCarico": False, "assegna": True,  "lavora": False, "bozze": False, "supervisione": True},
    "deluca":   {"classifica": False, "prendiCarico": True,  "assegna": False, "lavora": True,  "bozze": True,  "supervisione": False},
    "ferrari":  {"classifica": False, "prendiCarico": True,  "assegna": False, "lavora": True,  "bozze": True,  "supervisione": False},
    "ferrara":  {"classifica": True,  "prendiCarico": True,  "assegna": True,  "lavora": True,  "bozze": True,  "supervisione": False},
    "russo":    {"classifica": True,  "prendiCarico": True,  "assegna": True,  "lavora": True,  "bozze": True,  "supervisione": False},
    "moretti":  {"classifica": True,  "prendiCarico": True,  "assegna": True,  "lavora": True,  "bozze": True,  "supervisione": False},
    "ricci":    {"classifica": True,  "prendiCarico": True,  "assegna": True,  "lavora": True,  "bozze": True,  "supervisione": False},
}

# ---- Categorie documentali (§8.2) — 16 categorie ----------------------
CAT = {
    "istanza_cittadino": {"lbl": "Istanza cittadino", "col": "blu", "ico": "user"},
    "comunicazione_pa": {"lbl": "Comunicazione da altra PA", "col": "azure", "ico": "building"},
    "pratica_tecnica": {"lbl": "Pratica ufficio tecnico", "col": "azure", "ico": "folder"},
    "richiesta_tributi": {"lbl": "Richiesta tributi", "col": "viola", "ico": "tag"},
    "richiesta_anagrafica": {"lbl": "Richiesta anagrafica", "col": "blu", "ico": "users"},
    "documento_contabile": {"lbl": "Documento contabile", "col": "viola", "ico": "fileText"},
    "segnalazione": {"lbl": "Segnalazione", "col": "ambra", "ico": "flag"},
    "reclamo": {"lbl": "Reclamo", "col": "ambra", "ico": "alertCircle"},
    "accesso_atti": {"lbl": "Accesso agli atti", "col": "blu", "ico": "eye"},
    "ordinanza": {"lbl": "Ordinanza", "col": "rosso", "ico": "gavel"},
    "determina": {"lbl": "Determina", "col": "blu", "ico": "fileText"},
    "delibera": {"lbl": "Delibera", "col": "blu", "ico": "fileText"},
    "da_pubblicare": {"lbl": "Documento da pubblicare", "col": "azure", "ico": "book"},
    "richiesta_integrazione": {"lbl": "Richiesta integrazione", "col": "ambra", "ico": "forward"},
    "comunicazione_urgente": {"lbl": "Comunicazione urgente", "col": "rosso", "ico": "bolt"},
    "scadenza_amm": {"lbl": "Scadenza amministrativa", "col": "rosso", "ico": "clock"},
}

# ---- Stati pratica (§8.3) — 9 stati + flusso --------------------------
STATI = {
    "ricevuta": {"lbl": "Ricevuta", "col": "gray", "ico": "inbox"},
    "da_classificare": {"lbl": "Da classificare", "col": "azure", "ico": "sparkles"},
    "assegnata": {"lbl": "Assegnata", "col": "blu", "ico": "forward"},
    "in_lavorazione": {"lbl": "In lavorazione", "col": "blu", "ico": "edit"},
    "in_attesa_integrazione": {"lbl": "In attesa integrazione", "col": "ambra", "ico": "hourglass"},
    "in_attesa_parere": {"lbl": "In attesa parere", "col": "ambra", "ico": "pause"},
    "pronta_firma": {"lbl": "Pronta per firma", "col": "viola", "ico": "signature"},
    "conclusa": {"lbl": "Conclusa", "col": "verde", "ico": "checkCircle"},
    "archiviata": {"lbl": "Archiviata", "col": "gray", "ico": "archive"},
}
FLOW = ["ricevuta", "da_classificare", "assegnata", "in_lavorazione", "pronta_firma", "conclusa"]

PRIO = {
    "bassa": {"lbl": "Bassa", "col": "#8a99a8"},
    "media": {"lbl": "Media", "col": "#0066cc"},
    "alta": {"lbl": "Alta", "col": "#a66300"},
    "urgente": {"lbl": "Urgente", "col": "#d9364f"},
}

# ---- Atti -------------------------------------------------------------
ATTI_TIPI = {
    "determina": {"lbl": "Determinazione", "sigla": "DET", "ico": "fileText", "col": "blu", "albo": True},
    "ordinanza": {"lbl": "Ordinanza", "sigla": "ORD", "ico": "gavel", "col": "rosso", "albo": True},
    "delibera": {"lbl": "Delibera", "sigla": "DEL", "ico": "fileText", "col": "blu", "albo": True},
    "avvio_procedimento": {"lbl": "Comunicazione avvio procedimento", "sigla": "COM", "ico": "send", "col": "azure", "albo": False},
    "richiesta_integrazione": {"lbl": "Richiesta integrazione", "sigla": "COM", "ico": "forward", "col": "ambra", "albo": False},
    "risposta_cittadino": {"lbl": "Risposta al cittadino", "sigla": "COM", "ico": "mail", "col": "azure", "albo": False},
    "nota_ente": {"lbl": "Nota ad altro ente", "sigla": "NOTA", "ico": "building", "col": "azure", "albo": False},
    "sollecito": {"lbl": "Sollecito interno", "sigla": "INT", "ico": "bell", "col": "gray", "albo": False, "interno": True},
    "riepilogo": {"lbl": "Riepilogo pratica", "sigla": "INT", "ico": "list", "col": "gray", "albo": False, "interno": True},
}
ATTI_STATI = {
    "bozza": {"lbl": "Bozza", "col": "gray", "ico": "edit"},
    "in_revisione": {"lbl": "In revisione", "col": "azure", "ico": "eye"},
    "pronta_firma": {"lbl": "Pronto per la firma", "col": "viola", "ico": "signature"},
    "firmato": {"lbl": "Firmato", "col": "blu", "ico": "checkCircle"},
    "protocollato": {"lbl": "Protocollato in uscita", "col": "blu", "ico": "send"},
    "pubblicato": {"lbl": "Pubblicato all'Albo", "col": "verde", "ico": "book"},
    "archiviato": {"lbl": "Archiviato", "col": "gray", "ico": "archive"},
}

# Mapping ruolo Keycloak → permessi di piattaforma
KC_ROLE_PERM: dict[str, dict[str, bool]] = {
    "operatore_protocollo": {"classifica": True, "prendiCarico": True, "assegna": True, "lavora": False, "bozze": False, "supervisione": False},
    "responsabile_ut":      {"classifica": True, "prendiCarico": True, "assegna": True, "lavora": True,  "bozze": True,  "supervisione": False},
    "responsabile_ufficio": {"classifica": True, "prendiCarico": True, "assegna": True, "lavora": True,  "bozze": True,  "supervisione": False},
    "istruttore":           {"classifica": False, "prendiCarico": True, "assegna": False, "lavora": True, "bozze": True,  "supervisione": False},
    "segretario":           {"classifica": False, "prendiCarico": False, "assegna": True, "lavora": False, "bozze": False, "supervisione": True},
}

KC_ROLE_DISPLAY: dict[str, str] = {
    "operatore_protocollo": "Operatore Protocollo",
    "responsabile_ut":      "Responsabile Ufficio Tecnico",
    "responsabile_ufficio": "Responsabile di Ufficio",
    "istruttore":           "Istruttore",
    "segretario":           "Segretario Comunale",
}

# ---- Uffici comunali e relativi flussi documentali --------------------
# Ogni ufficio dichiara: le categorie documentali che gestisce (instradamento),
# i procedimenti tipici (con termine di legge e atto finale prodotto) e l'utente
# responsabile di default. Modello di riferimento per un piccolo Comune.
UFFICI = {
    "segreteria": {
        "lbl": "Segreteria / Protocollo", "prefix": "SG", "ico": "inbox", "col": "blu",
        "descrizione": "Protocollo, affari generali, organi istituzionali, accesso agli atti e pubblicità legale.",
        "responsabileRuolo": "segretario", "responsabileDefault": "bianchi",
        "categorie": ["comunicazione_pa", "accesso_atti", "da_pubblicare", "comunicazione_urgente", "scadenza_amm"],
        "procedimenti": [
            {"nome": "Accesso documentale", "termineGiorni": 30, "norma": "L. 241/1990 art. 22", "attoFinale": "risposta_cittadino"},
            {"nome": "Accesso civico generalizzato (FOIA)", "termineGiorni": 30, "norma": "D.Lgs. 33/2013 art. 5", "attoFinale": "risposta_cittadino"},
            {"nome": "Pubblicazione all'Albo Pretorio", "termineGiorni": 2, "norma": "D.Lgs. 33/2013", "attoFinale": "delibera"},
            {"nome": "Protocollazione e smistamento", "termineGiorni": 1, "norma": "DPR 445/2000", "attoFinale": None},
            {"nome": "Deliberazioni di Giunta e Consiglio", "termineGiorni": 15, "norma": "TUEL D.Lgs. 267/2000", "attoFinale": "delibera"},
        ],
    },
    "tecnico": {
        "lbl": "Ufficio Tecnico", "prefix": "UT", "ico": "route", "col": "azure",
        "descrizione": "Edilizia privata, urbanistica, lavori pubblici, manutenzioni e patrimonio.",
        "responsabileRuolo": "responsabile_ut", "responsabileDefault": "esposito",
        "categorie": ["pratica_tecnica", "segnalazione"],
        "procedimenti": [
            {"nome": "Permesso di Costruire", "termineGiorni": 90, "norma": "DPR 380/2001 art. 20", "attoFinale": "determina"},
            {"nome": "SCIA edilizia", "termineGiorni": 30, "norma": "DPR 380/2001 art. 23", "attoFinale": "avvio_procedimento"},
            {"nome": "Autorizzazione paesaggistica", "termineGiorni": 60, "norma": "D.Lgs. 42/2004 art. 146", "attoFinale": "determina"},
            {"nome": "Certificato destinazione urbanistica (CDU)", "termineGiorni": 30, "norma": "DPR 380/2001 art. 30", "attoFinale": "risposta_cittadino"},
            {"nome": "Autorizzazione occupazione suolo / passo carrabile", "termineGiorni": 30, "norma": "D.Lgs. 285/1992", "attoFinale": "determina"},
            {"nome": "Ordinanza contingibile e urgente", "termineGiorni": 2, "norma": "TUEL art. 54", "attoFinale": "ordinanza"},
        ],
    },
    "tributi": {
        "lbl": "Ragioneria / Tributi", "prefix": "TR", "ico": "tag", "col": "viola",
        "descrizione": "Tributi locali (IMU, TARI, canone unico), bilancio, contabilità e liquidazioni.",
        "responsabileRuolo": "responsabile_ufficio", "responsabileDefault": "ferrara",
        "categorie": ["richiesta_tributi", "documento_contabile"],
        "procedimenti": [
            {"nome": "Rimborso IMU / TARI", "termineGiorni": 180, "norma": "L. 296/2006 art. 1 c. 164", "attoFinale": "determina"},
            {"nome": "Rateizzazione tributi", "termineGiorni": 30, "norma": "Reg. comunale entrate", "attoFinale": "determina"},
            {"nome": "Autotutela / sgravio", "termineGiorni": 90, "norma": "D.Lgs. 545/1992", "attoFinale": "determina"},
            {"nome": "Liquidazione fattura", "termineGiorni": 30, "norma": "D.Lgs. 231/2002", "attoFinale": "determina"},
            {"nome": "Impegno di spesa", "termineGiorni": 30, "norma": "TUEL art. 183", "attoFinale": "determina"},
        ],
    },
    "demografici": {
        "lbl": "Anagrafe e Stato Civile", "prefix": "AN", "ico": "users", "col": "blu",
        "descrizione": "Servizi demografici: anagrafe, stato civile, elettorale, leva e carte d'identità.",
        "responsabileRuolo": "responsabile_ufficio", "responsabileDefault": "russo",
        "categorie": ["richiesta_anagrafica"],
        "procedimenti": [
            {"nome": "Certificazioni anagrafiche", "termineGiorni": 1, "norma": "DPR 223/1989", "attoFinale": None},
            {"nome": "Cambio di residenza / iscrizione APR", "termineGiorni": 45, "norma": "DPR 223/1989 art. 18-bis", "attoFinale": "avvio_procedimento"},
            {"nome": "Carta d'identità elettronica (CIE)", "termineGiorni": 6, "norma": "D.M. 23/12/2015", "attoFinale": None},
            {"nome": "Atti di stato civile (nascita, matrimonio, morte)", "termineGiorni": 1, "norma": "DPR 396/2000", "attoFinale": None},
            {"nome": "Iscrizione liste elettorali", "termineGiorni": 30, "norma": "DPR 223/1967", "attoFinale": "avvio_procedimento"},
        ],
    },
    "vigilanza": {
        "lbl": "Polizia Locale", "prefix": "PL", "ico": "shield", "col": "rosso",
        "descrizione": "Vigilanza, viabilità, sanzioni, esposti, accertamenti e sportello attività produttive (SUAP).",
        "responsabileRuolo": "responsabile_ufficio", "responsabileDefault": "moretti",
        "categorie": ["reclamo", "ordinanza"],
        "procedimenti": [
            {"nome": "Sanzione amministrativa (Codice della Strada)", "termineGiorni": 90, "norma": "D.Lgs. 285/1992", "attoFinale": "ordinanza"},
            {"nome": "Ordinanza viabilità e traffico", "termineGiorni": 10, "norma": "CdS art. 7", "attoFinale": "ordinanza"},
            {"nome": "Gestione esposti e segnalazioni", "termineGiorni": 30, "norma": "L. 241/1990", "attoFinale": "risposta_cittadino"},
            {"nome": "Accertamenti anagrafici per residenza", "termineGiorni": 45, "norma": "DPR 223/1989", "attoFinale": "nota_ente"},
            {"nome": "SCIA attività produttive (SUAP)", "termineGiorni": 60, "norma": "DPR 160/2010", "attoFinale": "avvio_procedimento"},
        ],
    },
    "sociali": {
        "lbl": "Servizi Sociali", "prefix": "SS", "ico": "heart", "col": "verde",
        "descrizione": "Welfare e assistenza: contributi economici, domiciliarità, minori, anziani e disabilità.",
        "responsabileRuolo": "responsabile_ufficio", "responsabileDefault": "ricci",
        "categorie": ["istanza_cittadino"],
        "procedimenti": [
            {"nome": "Contributo economico straordinario (ISEE)", "termineGiorni": 60, "norma": "L. 328/2000", "attoFinale": "determina"},
            {"nome": "Assegno di maternità / nucleo familiare", "termineGiorni": 180, "norma": "D.Lgs. 151/2001", "attoFinale": "determina"},
            {"nome": "Assistenza domiciliare (SAD)", "termineGiorni": 30, "norma": "L. 328/2000", "attoFinale": "determina"},
            {"nome": "Inserimento in struttura", "termineGiorni": 60, "norma": "L. 328/2000", "attoFinale": "determina"},
            {"nome": "Bonus sociali e agevolazioni", "termineGiorni": 30, "norma": "Reg. comunale servizi sociali", "attoFinale": "determina"},
        ],
    },
}

# Prefisso protocollo per etichetta ufficio (compatibilità con codice esistente).
UFF_PREFIX = {u["lbl"]: u["prefix"] for u in UFFICI.values()}

# Instradamento di default: categoria documentale → etichetta ufficio competente.
CAT_UFFICIO = {
    cat: u["lbl"]
    for u in UFFICI.values()
    for cat in u["categorie"]
}


def ufficio_per_categoria(categoria: str) -> str:
    """Ufficio competente di default per una categoria documentale (stringa vuota se ignota)."""
    return CAT_UFFICIO.get(categoria, "")


def procedimenti_ufficio(lbl: str) -> list[dict]:
    """Procedimenti tipici dell'ufficio identificato dall'etichetta."""
    for u in UFFICI.values():
        if u["lbl"] == lbl:
            return u["procedimenti"]
    return []


def flow_atto(tipo: str) -> list[str]:
    t = ATTI_TIPI.get(tipo, {})
    if t.get("albo"):
        return ["bozza", "in_revisione", "pronta_firma", "firmato", "pubblicato"]
    if t.get("interno"):
        return ["bozza", "in_revisione", "pronta_firma", "firmato"]
    return ["bozza", "in_revisione", "pronta_firma", "firmato", "protocollato"]


# ---- helper date (relative a oggi, come il prototipo) -----------------
def iso(d: date) -> str:
    return d.isoformat()


def day_from(n: int) -> str:
    return iso(date.today() + timedelta(days=n))


def meta_dict() -> dict:
    return {
        "ente": {
            "nome": settings.ENTE_NOME,
            "prov": settings.ENTE_PROV,
            "cap": settings.ENTE_CAP,
            "abitanti": settings.ENTE_ABITANTI,
            "pec": settings.ENTE_PEC,
        },
        "tema": {"blu": settings.TEMA_BLU},
        "users": USERS, "perm": PERM, "cat": CAT, "stati": STATI,
        "flow": FLOW, "prio": PRIO, "atti_tipi": ATTI_TIPI, "atti_stati": ATTI_STATI,
        "uffici": UFFICI, "catUfficio": CAT_UFFICIO,
    }
