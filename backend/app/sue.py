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

# Campi comuni a (quasi) tutti i moduli edilizi: ubicazione + dati catastali.
_CAMPI_BASE = [
    {"key": "immobile_indirizzo", "label": "Ubicazione immobile (via e civico)", "tipo": "text", "required": True},
    {"key": "catasto_foglio", "label": "Foglio catastale", "tipo": "text", "required": True},
    {"key": "catasto_particella", "label": "Particella", "tipo": "text", "required": True},
    {"key": "catasto_sub", "label": "Subalterno", "tipo": "text", "required": False},
    {"key": "tecnico_nome", "label": "Tecnico incaricato", "tipo": "text", "required": True},
    {"key": "tecnico_albo", "label": "Iscrizione albo (n. e ordine)", "tipo": "text", "required": False},
    {"key": "descrizione", "label": "Descrizione dell'intervento", "tipo": "textarea", "required": True},
]

# Catalogo procedimenti SUE (sub_context Residenziale/Produttivo, regime, termine,
# norma di riferimento, ufficio competente, campi del modulo digitale).
PROCEDIMENTI: dict[str, dict] = {
    "cila": {
        "nome": "CILA — Comunicazione Inizio Lavori Asseverata",
        "sub_context": "SUE Residenziale", "regime": "Comunicazione",
        "termineGiorni": 0, "norma": "DPR 380/2001 art. 6-bis", "ufficio": "Ufficio Tecnico",
        "campi": _CAMPI_BASE + [
            {"key": "inizio_lavori", "label": "Data presunta inizio lavori", "tipo": "date", "required": True},
        ],
    },
    "scia_edilizia": {
        "nome": "SCIA edilizia",
        "sub_context": "SUE Residenziale", "regime": "SCIA",
        "termineGiorni": 30, "norma": "DPR 380/2001 art. 22-23", "ufficio": "Ufficio Tecnico",
        "campi": _CAMPI_BASE + [
            {"key": "categoria_intervento", "label": "Categoria d'intervento (es. ristrutturazione)", "tipo": "text", "required": True},
            {"key": "inizio_lavori", "label": "Data presunta inizio lavori", "tipo": "date", "required": True},
        ],
    },
    "permesso_costruire": {
        "nome": "Permesso di costruire",
        "sub_context": "SUE Residenziale", "regime": "Autorizzazione/Domanda",
        "termineGiorni": 90, "norma": "DPR 380/2001 art. 10-20", "ufficio": "Ufficio Tecnico",
        "campi": _CAMPI_BASE + [
            {"key": "volumetria", "label": "Volumetria di progetto (mc)", "tipo": "text", "required": True},
            {"key": "destinazione_uso", "label": "Destinazione d'uso", "tipo": "text", "required": True},
        ],
    },
    "agibilita": {
        "nome": "Segnalazione certificata di agibilità",
        "sub_context": "SUE Residenziale", "regime": "SCIA",
        "termineGiorni": 0, "norma": "DPR 380/2001 art. 24", "ufficio": "Ufficio Tecnico",
        "campi": _CAMPI_BASE + [
            {"key": "titolo_edilizio", "label": "Estremi del titolo edilizio", "tipo": "text", "required": True},
            {"key": "fine_lavori", "label": "Data fine lavori", "tipo": "date", "required": True},
        ],
    },
    "scia_produttiva": {
        "nome": "SCIA edilizia per edilizia produttiva",
        "sub_context": "SUE Produttivo", "regime": "SCIA",
        "termineGiorni": 30, "norma": "DPR 380/2001 · DPR 160/2010", "ufficio": "Ufficio Tecnico",
        "campi": _CAMPI_BASE + [
            {"key": "attivita", "label": "Attività produttiva insediata", "tipo": "text", "required": True},
            {"key": "impresa", "label": "Impresa / P.IVA", "tipo": "text", "required": True},
        ],
    },
}


def catalogo() -> list[dict]:
    """Elenco procedimenti SUE per il Front-office (senza dettagli operativi)."""
    return [{"id": pid, "nome": p["nome"], "sub_context": p["sub_context"],
             "regime": p["regime"], "termineGiorni": p["termineGiorni"],
             "norma": p["norma"], "campi": p["campi"]}
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


def crea_istanza(db, procedimento_id: str, presentatore: dict, dati: dict,
                 allegati: list[dict], cui: str, pratica_id: str, protocollo: str) -> models.IstanzaSUE:
    proc = PROCEDIMENTI[procedimento_id]
    ist = models.IstanzaSUE(
        id=cui, cui=cui, context=CONTEXT, subContext=proc["sub_context"],
        procedimentoId=procedimento_id, procedimento=proc["nome"], regime=proc["regime"],
        presentatoreNome=(presentatore or {}).get("nome", ""),
        presentatoreCF=(presentatore or {}).get("cf", ""),
        presentatoreEmail=(presentatore or {}).get("email", ""),
        datiModulo=dati or {}, allegati=allegati or [],
        stato="presentata", praticaId=pratica_id, protocollo=protocollo,
        creato=date.today().isoformat(),
    )
    db.add(ist)
    return ist


def lista(db) -> list[dict]:
    return [i.dict() for i in db.query(models.IstanzaSUE)
            .order_by(models.IstanzaSUE.creato.desc()).all()]


def dettaglio(db, cui: str) -> dict | None:
    i = db.get(models.IstanzaSUE, cui)
    return i.dict() if i else None
