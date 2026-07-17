"""Sportello Unico per l'Edilizia (SUE) — prototipo del flusso Front-office +
Back-office integrati (Allegato Tecnico SUE, PNRR Sub-investimento 2.2.3).

Prototipo dimostrativo: il Catalogo SSU nazionale, la PDND e l'identità SPID/CIE
sono MOCKati. Il valore sta nel flusso end-to-end dentro la piattaforma:
il presentatore compila un modulo digitale → validazione formale → generazione
CUI (codice unico istanza) → l'istanza diventa una Pratica istruibile dal
Back-office con tutte le funzionalità esistenti (RAG normativo, atti, scadenze).

Il catalogo dei procedimenti è qui in codice (nel sistema reale arriverebbe dal
Catalogo SSU via e-service). Ogni procedimento porta il suo modulo digitale come
elenco di campi: nel sistema reale sarebbe uno XSD+Schematron, qui un form-schema
JSON sufficiente a dimostrare compilazione e validazione formale.
"""
import uuid
from datetime import date

from . import models

CONTEXT = "SUE"

# I campi del modulo digitale sono raggruppati per SEZIONE (come nella modulistica
# edilizia unificata nazionale, Conferenza Unificata 4/5/2017). Ogni campo:
# {key, label, tipo, required, sezione}.
_CAMPI_BASE = [
    {"key": "titolare_qualita", "label": "In qualità di", "tipo": "select", "required": True,
     "sezione": "Titolarità",
     "opzioni": ["Proprietario", "Comproprietario", "Usufruttuario", "Altro avente titolo"]},
    {"key": "titolare_residenza", "label": "Residenza del richiedente", "tipo": "text", "required": True, "sezione": "Titolarità"},
    {"key": "immobile_indirizzo", "label": "Ubicazione immobile (via e civico)", "tipo": "text", "required": True, "sezione": "Immobile"},
    {"key": "catasto_foglio", "label": "Foglio catastale", "tipo": "text", "required": True, "sezione": "Immobile"},
    {"key": "catasto_particella", "label": "Particella", "tipo": "text", "required": True, "sezione": "Immobile"},
    {"key": "catasto_sub", "label": "Subalterno", "tipo": "text", "required": False, "sezione": "Immobile"},
    {"key": "tecnico_nome", "label": "Tecnico incaricato", "tipo": "text", "required": True, "sezione": "Progettista"},
    {"key": "tecnico_albo", "label": "Iscrizione albo (n. e ordine)", "tipo": "text", "required": False, "sezione": "Progettista"},
    {"key": "descrizione", "label": "Descrizione dell'intervento", "tipo": "textarea", "required": True, "sezione": "Intervento"},
]

# Documenti di base richiesti in (quasi) tutti i procedimenti.
_DOC_BASE = [
    {"key": "documento_identita", "label": "Copia del documento d'identità", "obbligatorio": True},
    {"key": "elaborati_grafici", "label": "Elaborati grafici di progetto", "obbligatorio": True},
    {"key": "relazione_asseverazione", "label": "Relazione tecnica di asseverazione", "obbligatorio": True},
]

# Documento richiesto SOLO quando la domanda è presentata da un tecnico delegato:
# la procura/delega con cui il titolare incarica il tecnico a presentare l'istanza.
DOC_DELEGA = {"key": "atto_delega",
              "label": "Atto di delega / procura speciale al tecnico incaricato",
              "obbligatorio": True}

# Catalogo procedimenti SUE (sub_context Residenziale/Produttivo, regime, termine,
# norma di riferimento, ufficio competente, campi del modulo digitale).
PROCEDIMENTI: dict[str, dict] = {
    "cila": {
        "nome": "CILA — Comunicazione Inizio Lavori Asseverata",
        "sub_context": "SUE Residenziale", "regime": "Comunicazione",
        "termineGiorni": 0, "norma": "DPR 380/2001 art. 6-bis", "ufficio": "Ufficio Tecnico",
        "campi": _CAMPI_BASE + [
            {"key": "inizio_lavori", "label": "Data presunta inizio lavori", "tipo": "date", "required": True, "sezione": "Intervento"},
        ],
        "documenti": _DOC_BASE,
    },
    "scia_edilizia": {
        "nome": "SCIA edilizia",
        "sub_context": "SUE Residenziale", "regime": "SCIA",
        "termineGiorni": 30, "norma": "DPR 380/2001 art. 22-23", "ufficio": "Ufficio Tecnico",
        "campi": _CAMPI_BASE + [
            {"key": "categoria_intervento", "label": "Categoria d'intervento (es. ristrutturazione)", "tipo": "text", "required": True, "sezione": "Intervento"},
            {"key": "inizio_lavori", "label": "Data presunta inizio lavori", "tipo": "date", "required": True, "sezione": "Intervento"},
        ],
        "documenti": _DOC_BASE + [
            {"key": "doc_stato_legittimo", "label": "Documentazione dello stato legittimo dell'immobile", "obbligatorio": True},
            {"key": "doc_fotografica", "label": "Documentazione fotografica", "obbligatorio": False},
        ],
    },
    # ── Permesso di costruire — modellato sull'iter reale dello Sportello Unico
    # del Cilento (DPR 380/2001 art. 20). Campi per sezione (modulistica unificata)
    # e documenti richiesti tratti dall'elenco pubblicato dallo sportello.
    "permesso_costruire": {
        "nome": "Permesso di costruire",
        "sub_context": "SUE Residenziale", "regime": "Autorizzazione/Domanda",
        "termineGiorni": 45, "norma": "DPR 380/2001 art. 20", "ufficio": "Ufficio Tecnico",
        "campi": [
            # Titolarità
            {"key": "titolare_qualita", "label": "In qualità di", "tipo": "select", "required": True, "sezione": "Titolarità",
             "opzioni": ["Proprietario", "Comproprietario", "Usufruttuario", "Superficiario", "Altro avente titolo"]},
            {"key": "titolare_residenza", "label": "Residenza del richiedente", "tipo": "text", "required": True, "sezione": "Titolarità"},
            {"key": "titolare_nato", "label": "Luogo e data di nascita", "tipo": "text", "required": False, "sezione": "Titolarità"},
            # Immobile
            {"key": "immobile_indirizzo", "label": "Ubicazione immobile (via e civico)", "tipo": "text", "required": True, "sezione": "Immobile"},
            {"key": "immobile_zona", "label": "Zona urbanistica (PUC/PRG)", "tipo": "text", "required": True, "sezione": "Immobile"},
            {"key": "catasto_foglio", "label": "Foglio catastale", "tipo": "text", "required": True, "sezione": "Immobile"},
            {"key": "catasto_particella", "label": "Particella", "tipo": "text", "required": True, "sezione": "Immobile"},
            {"key": "catasto_sub", "label": "Subalterno", "tipo": "text", "required": False, "sezione": "Immobile"},
            {"key": "destinazione_uso", "label": "Destinazione d'uso", "tipo": "text", "required": True, "sezione": "Immobile"},
            {"key": "stato_legittimo", "label": "Stato legittimo (estremi titolo esistente o «ante 1967»)", "tipo": "text", "required": True, "sezione": "Immobile"},
            # Intervento
            {"key": "tipologia_intervento", "label": "Tipologia d'intervento", "tipo": "select", "required": True, "sezione": "Intervento",
             "opzioni": ["Nuova costruzione", "Ristrutturazione urbanistica", "Ristrutturazione edilizia pesante", "Ampliamento", "Mutamento d'uso con opere"]},
            {"key": "descrizione", "label": "Descrizione dell'intervento", "tipo": "textarea", "required": True, "sezione": "Intervento"},
            {"key": "volumetria", "label": "Volumetria di progetto (mc)", "tipo": "text", "required": True, "sezione": "Intervento"},
            {"key": "superficie_utile", "label": "Superficie utile (mq)", "tipo": "text", "required": False, "sezione": "Intervento"},
            # Progettista e direzione lavori
            {"key": "tecnico_nome", "label": "Progettista incaricato", "tipo": "text", "required": True, "sezione": "Progettista e DL"},
            {"key": "tecnico_albo", "label": "Iscrizione albo (n. e ordine)", "tipo": "text", "required": True, "sezione": "Progettista e DL"},
            {"key": "direttore_lavori", "label": "Direttore dei lavori", "tipo": "text", "required": False, "sezione": "Progettista e DL"},
            # Impresa esecutrice (può essere comunicata prima dell'inizio lavori)
            {"key": "impresa_denominazione", "label": "Impresa esecutrice (denominazione)", "tipo": "text", "required": False, "sezione": "Impresa esecutrice"},
            {"key": "impresa_piva", "label": "Partita IVA impresa", "tipo": "text", "required": False, "sezione": "Impresa esecutrice"},
        ],
        "documenti": [
            {"key": "richiesta_pdc", "label": "Richiesta di Permesso di costruire (modulo firmato)", "obbligatorio": True},
            {"key": "documento_identita", "label": "Copia del documento d'identità", "obbligatorio": True},
            {"key": "elaborati_grafici", "label": "Elaborati grafici di progetto", "obbligatorio": True},
            {"key": "relazione_asseverazione", "label": "Relazione tecnica di asseverazione", "obbligatorio": True},
            {"key": "doc_stato_legittimo", "label": "Documentazione dimostrativa dello stato legittimo", "obbligatorio": True},
            {"key": "doc_fotografica", "label": "Documentazione fotografica", "obbligatorio": True},
            {"key": "doc_tecnica_contributo", "label": "Documentazione tecnica per il conteggio del contributo", "obbligatorio": True},
            {"key": "attestazione_contributo", "label": "Attestazione pagamento contributo di costruzione o monetizzazione", "obbligatorio": True},
            {"key": "lettera_incarico", "label": "Lettera di affidamento incarico o contratto", "obbligatorio": True},
            {"key": "notifica_preliminare", "label": "Notifica preliminare (se dovuta, D.Lgs. 81/2008)", "obbligatorio": False},
            {"key": "dich_spettanze", "label": "Dichiarazione sostitutiva pagamento spettanze del committente", "obbligatorio": False},
            {"key": "ricevuta_oblazione", "label": "Ricevuta versamento sanzione/oblazione (solo sanatoria)", "obbligatorio": False},
        ],
    },
    "agibilita": {
        "nome": "Segnalazione certificata di agibilità",
        "sub_context": "SUE Residenziale", "regime": "SCIA",
        "termineGiorni": 0, "norma": "DPR 380/2001 art. 24", "ufficio": "Ufficio Tecnico",
        "campi": _CAMPI_BASE + [
            {"key": "titolo_edilizio", "label": "Estremi del titolo edilizio", "tipo": "text", "required": True, "sezione": "Intervento"},
            {"key": "fine_lavori", "label": "Data fine lavori", "tipo": "date", "required": True, "sezione": "Intervento"},
        ],
        "documenti": _DOC_BASE + [
            {"key": "certificato_collaudo", "label": "Certificato di collaudo / regolare esecuzione", "obbligatorio": True},
            {"key": "accatastamento", "label": "Attestazione di avvenuto accatastamento", "obbligatorio": True},
        ],
    },
    "scia_produttiva": {
        "nome": "SCIA edilizia per edilizia produttiva",
        "sub_context": "SUE Produttivo", "regime": "SCIA",
        "termineGiorni": 30, "norma": "DPR 380/2001 · DPR 160/2010", "ufficio": "Ufficio Tecnico",
        "campi": _CAMPI_BASE + [
            {"key": "attivita", "label": "Attività produttiva insediata", "tipo": "text", "required": True, "sezione": "Intervento"},
            {"key": "impresa", "label": "Impresa / P.IVA", "tipo": "text", "required": True, "sezione": "Impresa esecutrice"},
        ],
        "documenti": _DOC_BASE + [
            {"key": "doc_stato_legittimo", "label": "Documentazione dello stato legittimo dell'immobile", "obbligatorio": True},
        ],
    },
}


def catalogo() -> list[dict]:
    """Elenco procedimenti SUE per il Front-office: campi del modulo (per sezione)
    e documenti richiesti (obbligatori/facoltativi)."""
    return [{"id": pid, "nome": p["nome"], "sub_context": p["sub_context"],
             "regime": p["regime"], "termineGiorni": p["termineGiorni"],
             "norma": p["norma"], "campi": p["campi"], "documenti": p.get("documenti", [])}
            for pid, p in PROCEDIMENTI.items()]


def genera_cui(db, sub_context: str) -> str:
    """Genera il Codice Unico Istanza. Nel sistema reale è emesso dal Catalogo SSU
    (path `request_cui`); qui è mockato con una struttura plausibile e univoca."""
    anno = date.today().isoformat()[:4]
    sc = "PROD" if "Produttivo" in sub_context else "RES"
    seq = db.query(models.IstanzaSUE).count() + 1
    return f"SUE-{CONTEXT}-{sc}-{anno}-{seq:05d}-{uuid.uuid4().hex[:6].upper()}"


def valida_modulo(procedimento_id: str, dati: dict) -> list[str]:
    """Controllo formale automatico (precondizione all'invio, cap. 5 delle specifiche).
    Nel sistema reale = validazione XSD+Schematron; qui verifica i campi obbligatori.
    Ritorna la lista delle etichette dei campi mancanti (vuota = modulo valido)."""
    proc = PROCEDIMENTI.get(procedimento_id)
    if not proc:
        return ["Procedimento non riconosciuto"]
    mancanti = []
    for campo in proc["campi"]:
        if campo["required"] and not str((dati or {}).get(campo["key"], "")).strip():
            mancanti.append(campo["label"])
    return mancanti


def documenti_richiesti(procedimento_id: str, ruolo: str = "in_proprio") -> list[dict]:
    """Elenco dei documenti richiesti per il procedimento, tenendo conto del ruolo
    del presentatore: se è un tecnico delegato si aggiunge l'atto di delega."""
    proc = PROCEDIMENTI.get(procedimento_id)
    if not proc:
        return []
    docs = list(proc.get("documenti", []))
    if ruolo == "tecnico_delegato":
        docs = docs + [DOC_DELEGA]
    return docs


def valida_documenti(procedimento_id: str, allegati: list[dict], ruolo: str = "in_proprio") -> list[str]:
    """Verifica che tutti i documenti OBBLIGATORI del procedimento siano allegati.
    `allegati` = [{tipoDoc, nome, ...}]. Se il presentatore è un tecnico delegato,
    include anche l'atto di delega. Ritorna le etichette dei documenti mancanti."""
    presenti = {a.get("tipoDoc") for a in (allegati or []) if a.get("tipoDoc")}
    return [d["label"] for d in documenti_richiesti(procedimento_id, ruolo)
            if d["obbligatorio"] and d["key"] not in presenti]


def crea_istanza(db, procedimento_id: str, presentatore: dict, dati: dict,
                 allegati: list[dict], cui: str, pratica_id: str, protocollo: str,
                 ruolo: str = "in_proprio", delegante: dict | None = None) -> models.IstanzaSUE:
    proc = PROCEDIMENTI[procedimento_id]
    delegante = delegante or {}
    ist = models.IstanzaSUE(
        id=cui, cui=cui, context=CONTEXT, subContext=proc["sub_context"],
        procedimentoId=procedimento_id, procedimento=proc["nome"], regime=proc["regime"],
        ruoloPresentatore=ruolo,
        presentatoreNome=(presentatore or {}).get("nome", ""),
        presentatoreCognome=(presentatore or {}).get("cognome", ""),
        presentatoreCF=(presentatore or {}).get("cf", ""),
        presentatoreEmail=(presentatore or {}).get("email", ""),
        deleganteNome=delegante.get("nome", ""),
        deleganteCognome=delegante.get("cognome", ""),
        deleganteCF=delegante.get("cf", ""),
        datiModulo=dati or {}, allegati=allegati or [],
        stato="presentata", praticaId=pratica_id, protocollo=protocollo,
        creato=date.today().isoformat(),
    )
    db.add(ist)
    return ist


def lista(db) -> list[dict]:
    return [i.dict() for i in db.query(models.IstanzaSUE)
            .order_by(models.IstanzaSUE.creato.desc()).all()]


def lista_per_cf(db, cf: str) -> list[dict]:
    """«Le mie istanze» (Front-office): le istanze in cui il codice fiscale
    compare come presentatore o come titolare delegante. Il cittadino/tecnico
    vede così tutte le pratiche presentate in proprio o per conto di altri."""
    cf = (cf or "").strip().upper()
    if not cf:
        return []
    rows = (db.query(models.IstanzaSUE)
            .filter((models.IstanzaSUE.presentatoreCF == cf) | (models.IstanzaSUE.deleganteCF == cf))
            .order_by(models.IstanzaSUE.creato.desc()).all())
    return [i.dict() for i in rows]


def dettaglio(db, cui: str) -> dict | None:
    i = db.get(models.IstanzaSUE, cui)
    return i.dict() if i else None
