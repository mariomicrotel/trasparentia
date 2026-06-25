"""API REST di TrasParentIA Micro PA."""
import csv
import io
import random
import uuid
from datetime import date, datetime, timedelta

import segno
from fastapi import APIRouter, Depends, HTTPException, Header, Body, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .db import get_db
from .config import settings
from . import models, storage, parsing, ingest, search, auth as auth_module
from . import diagnostica, backup as backup_module, mailer, configurazione_cfg, importazione as imp_module, integrazione as integ_module, utenti as utenti_module
from . import reference as R
from .reference import day_from
from .ai import client as ai

router = APIRouter(prefix="/api")


def _enqueue_embed():
    """Invia run_embed_pending in coda Celery se disponibile, altrimenti no-op.
    Il task Beat lo eseguirà comunque entro 5 minuti."""
    try:
        from .tasks import run_embed_pending
        run_embed_pending.delay()
    except Exception:
        pass


# ---------- util ----------
def _lid():
    return "L" + "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=6))


def _now_iso():
    return date.today().isoformat()


def newlog(attore, tipo, azione, **opts):
    e = {"id": _lid(), "ts": date.today().isoformat() + "T00:00:00", "attoreId": attore, "tipo": tipo, "azione": azione}
    e.update(opts)
    return e


def require_perm(me: str, perm: str):
    if me not in R.PERM:
        raise HTTPException(403, "Ruolo non valido")
    if not R.PERM[me].get(perm):
        raise HTTPException(403, f"Azione '{perm}' non consentita al ruolo {R.USERS[me]['ruolo']}")


def auth_user(x_role: str | None = Header(None), authorization: str | None = Header(None)) -> str:
    """FastAPI dependency: utente corrente da JWT Keycloak o X-Role header (solo dev)."""
    if settings.KC_AUTH_ENABLED:
        # Con KC attivo X-Role è vietato — solo Bearer JWT
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Autenticazione richiesta: Bearer token Keycloak")
        token = authorization.split(" ", 1)[1]
        username = auth_module.username_from_token(token)
        if not username:
            raise HTTPException(401, "Token non valido")
        if username not in R.USERS:
            # Utente Keycloak non nella lista statica: deriva profilo e permessi dal token
            ctx = auth_module.user_context_from_token(token)
            if not ctx or not ctx["perm"]:
                raise HTTPException(403, "Utente senza ruolo di piattaforma assegnato in Keycloak")
            R.USERS[username] = {k: v for k, v in ctx.items() if k != "perm"}
            R.PERM[username] = ctx["perm"]
        return username
    # Modalità demo/dev: X-Role header
    me = x_role
    if not me or me not in R.USERS:
        raise HTTPException(400, "Autenticazione richiesta: header X-Role o Bearer token")
    return me


def me_from(me_body: str | None, x_role: str | None) -> str:
    me = me_body or x_role
    if not me or me not in R.USERS:
        raise HTTPException(400, "Ruolo (me) mancante o non valido")
    return me


# ---------- numbering (serializzato tramite advisory lock PostgreSQL / mutex SQLite) ----------
import threading as _threading
_num_lock = _threading.Lock()


def _pg_advisory_lock(db, key: int):
    """Acquisisce un advisory lock PostgreSQL (no-op su SQLite)."""
    try:
        db.execute(__import__("sqlalchemy").text(f"SELECT pg_advisory_xact_lock({key})"))
    except Exception:
        pass  # SQLite non supporta advisory lock; il mutex Python è sufficiente in single-process


def next_prot(db):
    with _num_lock:
        _pg_advisory_lock(db, 1001)
        nums = []
        for p in db.query(models.Pratica).all():
            try:
                nums.append(int((p.protocollo or "PG/2026/0").split("/")[-1]))
            except ValueError:
                pass
        return "PG/2026/" + str((max(nums) if nums else 0) + 1)


def next_prat_num(db, prefix):
    with _num_lock:
        nums = []
        for p in db.query(models.Pratica).all():
            if p.id.startswith(prefix):
                try:
                    nums.append(int(p.id.split("/")[-1]))
                except ValueError:
                    pass
        return str((max(nums) if nums else 0) + 1).zfill(3)


def next_atto_id(db):
    with _num_lock:
        _pg_advisory_lock(db, 1002)
        nums = []
        for a in db.query(models.Atto).all():
            try:
                nums.append(int((a.id or "ATTO-2026-0").split("-")[-1]))
            except ValueError:
                pass
        return "ATTO-2026-" + str((max(nums) if nums else 0) + 1).zfill(3)


def next_sigla(db, sigla):
    with _num_lock:
        nums = []
        for a in db.query(models.Atto).all():
            if a.numero and a.numero.startswith(sigla + "/"):
                try:
                    nums.append(int(a.numero.split("/")[-1]))
                except ValueError:
                    pass
        return f"{sigla}/2026/" + str((max(nums) if nums else 0) + 1).zfill(3)


def next_albo(db):
    with _num_lock:
        nums = []
        for a in db.query(models.Atto).all():
            if a.albo:
                try:
                    nums.append(int((a.albo.get("numero") or "0/2026").split("/")[0]))
                except ValueError:
                    pass
        return str((max(nums) if nums else 0) + 1) + "/2026"


def stato_azione(prev, nuovo):
    if nuovo == "in_lavorazione" and prev == "assegnata":
        return "Presa in carico — avvio dell'istruttoria"
    if nuovo == "in_lavorazione":
        return "Istruttoria ripresa"
    if nuovo == "pronta_firma":
        return "Istruttoria conclusa — pratica pronta per la firma"
    if nuovo == "in_attesa_parere":
        return "Richiesto parere ad altro ente"
    if nuovo == "conclusa":
        return "Provvedimento firmato e trasmesso al destinatario"
    if nuovo == "archiviata":
        return "Pratica archiviata"
    return "Stato aggiornato a " + R.STATI.get(nuovo, {}).get("lbl", nuovo)


# ---------- meta / ai ----------
@router.get("/meta")
def get_meta():
    return R.meta_dict()


@router.get("/auth/config")
def auth_config():
    """Configurazione Keycloak per il frontend. enabled=false → usa role-switch demo."""
    if not settings.KC_AUTH_ENABLED:
        return {"enabled": False}
    return {
        "enabled": True,
        "url": settings.KC_PUBLIC_URL,
        "realm": settings.KC_REALM,
        "clientId": settings.KC_CLIENT_ID,
    }


@router.get("/me")
def get_me(me: str = Depends(auth_user)):
    """Profilo dell'utente corrente con permessi. Usato dal frontend dopo il login KC."""
    user = R.USERS.get(me, {"id": me, "nome": me, "ruolo": "", "ufficio": "", "iniz": me[:2].upper(), "col": "#0066cc", "email": ""})
    perm = R.PERM.get(me, {})
    return {**user, "perm": perm}


@router.get("/utenti")
def list_utenti(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Lista utenti di piattaforma (solo supervisione)."""
    require_perm(me, "supervisione")
    rows = db.query(models.Utente).order_by(models.Utente.nome).all()
    kc_admin_url = (
        f"{settings.KC_PUBLIC_URL}/admin/{settings.KC_REALM}/console"
        if settings.KC_AUTH_ENABLED else None
    )
    return {
        "utenti": [utenti_module.to_dict(u) for u in rows],
        "kc_admin_url": kc_admin_url,
        "ruoli": R.KC_ROLE_DISPLAY,
        "uffici": list(R.UFF_PREFIX.keys()),
    }


@router.post("/utenti")
def crea_utente(payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Crea nuovo utente (solo supervisione)."""
    require_perm(me, "supervisione")
    uid = (payload.get("id") or "").strip().lower().replace(" ", "_")
    if not uid:
        raise HTTPException(400, "Username obbligatorio")
    if db.query(models.Utente).filter(models.Utente.id == uid).first():
        raise HTTPException(409, f"Username '{uid}' già esistente")
    ruolo_kc = payload.get("ruolo_kc", "")
    if ruolo_kc not in R.KC_ROLE_PERM:
        raise HTTPException(400, f"Ruolo non valido: {ruolo_kc}")
    nome = (payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(400, "Nome obbligatorio")
    from datetime import date as _date
    u = models.Utente(
        id=uid, nome=nome,
        email=(payload.get("email") or "").strip(),
        ufficio=(payload.get("ufficio") or "").strip(),
        ruolo_kc=ruolo_kc,
        col=payload.get("col") or "#0066cc",
        attivo=True,
        creato=_date.today().isoformat(),
    )
    db.add(u)
    db.commit()
    utenti_module.sync_memory(db)
    return utenti_module.to_dict(u)


@router.patch("/utenti/{uid}")
def aggiorna_utente(uid: str, payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Modifica nome, email, ufficio, ruolo o colore di un utente (solo supervisione)."""
    require_perm(me, "supervisione")
    u = db.query(models.Utente).filter(models.Utente.id == uid).first()
    if not u:
        raise HTTPException(404, "Utente non trovato")
    if "nome" in payload:
        nome = payload["nome"].strip()
        if not nome:
            raise HTTPException(400, "Nome obbligatorio")
        u.nome = nome
    if "email" in payload:
        u.email = payload["email"].strip()
    if "ufficio" in payload:
        u.ufficio = payload["ufficio"].strip()
    if "col" in payload:
        u.col = payload["col"]
    if "ruolo_kc" in payload:
        if payload["ruolo_kc"] not in R.KC_ROLE_PERM:
            raise HTTPException(400, f"Ruolo non valido: {payload['ruolo_kc']}")
        u.ruolo_kc = payload["ruolo_kc"]
    db.commit()
    utenti_module.sync_memory(db)
    return utenti_module.to_dict(u)


@router.post("/utenti/{uid}/sospendi")
def sospendi_utente(uid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Sospende un utente (solo supervisione). Non è possibile auto-sospendersi."""
    require_perm(me, "supervisione")
    if uid == me:
        raise HTTPException(400, "Non puoi sospendere te stesso")
    u = db.query(models.Utente).filter(models.Utente.id == uid).first()
    if not u:
        raise HTTPException(404, "Utente non trovato")
    u.attivo = False
    db.commit()
    utenti_module.sync_memory(db)
    return {"ok": True, "detail": f"Utente {uid} sospeso"}


@router.post("/utenti/{uid}/riattiva")
def riattiva_utente(uid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Riattiva un utente sospeso (solo supervisione)."""
    require_perm(me, "supervisione")
    u = db.query(models.Utente).filter(models.Utente.id == uid).first()
    if not u:
        raise HTTPException(404, "Utente non trovato")
    u.attivo = True
    db.commit()
    utenti_module.sync_memory(db)
    return {"ok": True, "detail": f"Utente {uid} riattivato"}


@router.get("/ai/status")
def ai_status(me: str = Depends(auth_user)):
    return ai.status()


@router.post("/ai/classifica")
def ai_classifica(payload: dict = Body(...), me: str = Depends(auth_user)):
    try:
        return ai.classifica(payload.get("oggetto", ""), payload.get("corpo", []), payload.get("allegati", []))
    except ai.AIUnavailable as e:
        raise HTTPException(503, f"Server AI non disponibile: {e}")


# ---------- comunicazioni ----------
@router.get("/comunicazioni")
def list_com(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    return [c.dict() for c in db.query(models.Comunicazione).all()]


@router.get("/comunicazioni/{cid}")
def get_com(cid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    c = db.get(models.Comunicazione, cid)
    if not c:
        raise HTTPException(404, "Comunicazione non trovata")
    c.letto = True
    db.commit()
    return c.dict()


@router.post("/comunicazioni/import")
async def importa_comunicazione(
    file: UploadFile = File(...),
    oggetto: str = Form(""),
    mittente_nome: str = Form(""),
    mittente_tipo: str = Form("Cittadino"),
    me: str = Depends(auth_user),
    db: Session = Depends(get_db),
):
    """Inserimento manuale assistito: carica un documento → storage MinIO →
    estrazione testo (OCR se necessario) → classificazione AI → Comunicazione."""
    require_perm(me, "classifica")
    data = await file.read()
    fname = file.filename or "documento"
    ext = parsing.extract_text(fname, file.content_type or "", data)

    key = f"upload/{uuid.uuid4().hex}/{fname}"
    stored = storage.put(key, data, file.content_type or "application/octet-stream")
    doc = models.Documento(
        id=uuid.uuid4().hex, filename=fname, contentType=file.content_type or "application/octet-stream",
        size=len(data), objectKey=key if stored else None, ocr=ext.get("ocr", False),
        chars=len(ext.get("text", "")), stato="eccezione" if ext.get("error") else "acquisito",
        errore=ext.get("error"), creato=_now_iso(), testo=ext.get("text", ""),
    )
    db.add(doc)

    corpo = [p.strip() for p in (ext.get("text", "") or "").split("\n") if p.strip()][:8]
    allegati = [{"nome": fname, "tipo": (fname.split(".")[-1].upper() if "." in fname else "FILE"), "size": f"{len(data)//1024} KB"}]
    ai_res = ingest.classify_or_default(oggetto or fname, corpo, allegati)

    cid = ingest._next_id(db, "MAN-2026-")
    com = models.Comunicazione(
        id=cid, canale="Caricamento", letto=True, urgente=ai_res.get("urgenza") == "urgente",
        arrivo=datetime.now().isoformat(),
        mittente={"nome": mittente_nome or "Inserimento manuale", "pec": "", "tipo": mittente_tipo},
        oggetto=oggetto or fname, corpo=corpo, allegati=allegati, ai=ai_res, pratica=None,
    )
    db.add(com)
    doc.comId = cid
    db.commit()
    db.refresh(com)
    try:
        search.index_one(db, "comunicazione", com.id, com.oggetto, " ".join([com.oggetto] + (com.corpo or [])))
    except Exception:
        pass
    out = com.dict()
    out["_documento"] = {"id": doc.id, "ocr": doc.ocr, "chars": doc.chars, "stato": doc.stato, "errore": doc.errore}
    return out


@router.post("/comunicazioni/{cid}/prendi-carico")
def prendi_carico(cid: str, payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "prendiCarico")
    com = db.get(models.Comunicazione, cid)
    if not com:
        raise HTTPException(404, "Comunicazione non trovata")
    if com.pratica:
        raise HTTPException(409, "Comunicazione già presa in carico")

    categoria = payload.get("categoria") or com.ai.get("categoria")
    # Ufficio: scelta operatore → proposta AI → instradamento di default per categoria.
    ufficio = payload.get("ufficio") or com.ai.get("ufficio") or R.ufficio_per_categoria(categoria)
    # Responsabile: scelta operatore → proposta AI → responsabile di default dell'ufficio.
    responsabile = payload.get("responsabile") or com.ai.get("responsabile") or None
    if not responsabile:
        for _u in R.UFFICI.values():
            if _u["lbl"] == ufficio and _u.get("responsabileDefault") in R.USERS:
                responsabile = _u["responsabileDefault"]
                break
    # Scadenza: scelta operatore → suggerita AI → termine del procedimento dell'ufficio.
    scadenza = payload.get("scadenza") or com.ai.get("scadenzaSuggerita")
    if not scadenza:
        _term = com.ai.get("termineGiorni")
        if not _term:
            _procs = R.procedimenti_ufficio(ufficio)
            _term = _procs[0]["termineGiorni"] if _procs else 30
        scadenza = R.day_from(int(_term))
    priorita = payload.get("priorita") or "media"
    override = bool(payload.get("override"))

    prefix = (R.UFF_PREFIX.get(ufficio, "XX")) + "/2026/"
    pid = prefix + next_prat_num(db, prefix)

    # Tenta di ottenere il numero di protocollo dal sistema esterno configurato
    prot_esterno = integ_module.registra_protocollo(
        oggetto=com.oggetto,
        mittente=(com.mittente or {}).get("nome", ""),
        ufficio=ufficio,
        categoria=R.CAT.get(categoria, {}).get("lbl", categoria),
    )
    protocollo = prot_esterno["numero"] if prot_esterno.get("ok") and prot_esterno.get("numero") else next_prot(db)
    nota_prot = prot_esterno["detail"] if prot_esterno.get("ok") and prot_esterno.get("numero") else "Numerazione interna"

    cron = [
        newlog(me, "protocollo", f"Comunicazione protocollata in ingresso — {nota_prot}", dettaglio=protocollo),
        newlog("ai", "classificazione", f"Classificazione AI: «{R.CAT.get(com.ai.get('categoria','istanza_cittadino'), {}).get('lbl', 'documento')}»",
               aiBadge=f"{com.ai.get('confidenza',0):.2f}"),
    ]
    if override:
        cron.append(newlog(me, "override", f"Classificazione corretta manualmente in «{R.CAT.get(categoria, {}).get('lbl', categoria)}» e smistata a {ufficio}",
                           dettaglio="Override della proposta AI da parte dell'operatore."))
    cron.append(newlog(me, "assegnazione", f"Assegnata a {R.USERS[responsabile]['nome'] if responsabile in R.USERS else ufficio}", statoNew="assegnata"))

    prat = models.Pratica(
        id=pid, fascicolo=pid, protocollo=protocollo, oggetto=com.oggetto, categoria=categoria,
        tipoProcedimento=com.ai.get("tipoProcedimento", ""), richiedente=(com.mittente.get("perConto") or com.mittente.get("nome", "")),
        ufficio=ufficio, responsabile=responsabile, stato="assegnata", priorita=priorita,
        apertura=_now_iso(), scadenza=scadenza, comId=cid, cronologia=cron, bozze=[],
    )
    db.add(prat)
    com.pratica = pid
    com.letto = True
    db.commit()
    db.refresh(prat)
    try:
        search.index_one(db, "pratica", prat.id, prat.oggetto, " ".join([prat.oggetto, prat.tipoProcedimento or "", prat.richiedente or ""]))
    except Exception:
        pass
    return prat.dict()


# ---------- pratiche ----------

def _prat_visibili(me: str, db):
    """Pratiche visibili all'utente in base al ruolo.

    - supervisione (segretario)         → tutte
    - nessun lavora (operatore prot.)   → tutte (sono il punto di smistamento)
    - lavora (istruttori/responsabili)  → solo il proprio ufficio + assegnate a me
    """
    perm = R.PERM.get(me, {})
    if perm.get("supervisione") or not perm.get("lavora"):
        return db.query(models.Pratica).all()
    ufficio = (R.USERS.get(me) or {}).get("ufficio", "")
    return (db.query(models.Pratica)
            .filter((models.Pratica.responsabile == me) | (models.Pratica.ufficio == ufficio))
            .all())


@router.get("/pratiche")
def list_prat(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    return [p.dict() for p in _prat_visibili(me, db)]


@router.get("/pratiche/{pid:path}")
def get_prat(pid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    p = db.get(models.Pratica, pid)
    if not p:
        raise HTTPException(404, "Pratica non trovata")
    out = p.dict()
    com = db.get(models.Comunicazione, p.comId) if p.comId else None
    out["com"] = com.dict() if com else None
    atti = (db.query(models.Atto)
            .filter(models.Atto.praticaId == pid)
            .order_by(models.Atto.creato, models.Atto.id)
            .all())
    out["atti"] = [a.dict() for a in atti]
    return out


@router.post("/pratiche/{pid:path}/stato")
def cambio_stato(pid: str, payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "lavora")
    p = db.get(models.Pratica, pid)
    if not p:
        raise HTTPException(404, "Pratica non trovata")
    nuovo = payload.get("nuovo")
    if nuovo not in R.STATI:
        raise HTTPException(400, "Stato non valido")
    azione = stato_azione(p.stato, nuovo)
    p.stato = nuovo
    p.cronologia = [*p.cronologia, newlog(me, "cambio_stato", azione, statoNew=nuovo, dettaglio=payload.get("detail"))]
    db.commit()
    db.refresh(p)
    return p.dict()


@router.post("/pratiche/{pid:path}/riassegna")
def riassegna(pid: str, payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "assegna")
    p = db.get(models.Pratica, pid)
    if not p:
        raise HTTPException(404, "Pratica non trovata")
    resp = payload.get("responsabile")
    p.responsabile = resp
    p.cronologia = [*p.cronologia, newlog(me, "assegnazione", f"Riassegnata a {R.USERS.get(resp, {}).get('nome', resp)}")]
    db.commit()
    db.refresh(p)
    return p.dict()


@router.post("/pratiche/{pid:path}/bozza")
def aggiungi_bozza(pid: str, payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "bozze")
    p = db.get(models.Pratica, pid)
    if not p:
        raise HTTPException(404, "Pratica non trovata")
    tipo = payload.get("tipo")
    lbl = payload.get("lbl") or R.ATTI_TIPI.get(tipo, {}).get("lbl", tipo)

    # contenuto: AI reale se richiesto, altrimenti placeholder
    contenuto = payload.get("testo", "")
    if payload.get("usaAI") and not contenuto:
        # RAG: recupera dall'indice i passaggi pertinenti (regolamenti, atti, precedenti)
        # per fondare la bozza ed evitare riferimenti inventati. Esclude la pratica stessa.
        query = " ".join(filter(None, [lbl, p.oggetto, p.tipoProcedimento]))
        fonti = search.blocco_fonti(search.contesto_per(db, query, k=4, escludi={f"pratica:{pid}"}))
        ogg = f"{p.oggetto} (tipo procedimento: {p.tipoProcedimento})" if p.tipoProcedimento else p.oggetto
        try:
            contenuto = ai.bozza(lbl, ogg, fonti)
        except ai.AIUnavailable:
            contenuto = f"BOZZA generata dall'AI — da verificare.\n\n⟦Testo da completare per: {lbl} — {p.oggetto}⟧"

    cron = list(p.cronologia)
    if tipo == "richiesta_integrazione":
        cron.append(newlog(me, "integrazione", "Inviata richiesta di integrazione documentale", statoNew="in_attesa_integrazione", dettaglio="Protocollata in uscita. Termini sospesi."))
        p.stato = "in_attesa_integrazione"
    elif tipo == "richiesta_parere":
        cron.append(newlog(me, "comunicazione_inviata", "Richiesto parere ad altro ente", statoNew="in_attesa_parere", dettaglio="Termini sospesi in attesa del parere."))
        p.stato = "in_attesa_parere"
    elif tipo == "riepilogo":
        cron.append(newlog(me, "bozza_generata", "Generato riepilogo della pratica (AI)"))
    else:
        cron.append(newlog(me, "bozza_approvata", f"Approvato e protocollato in uscita: {lbl}"))
    p.cronologia = cron

    if tipo != "riepilogo":
        p.bozze = [*(p.bozze or []), {"tipo": tipo, "lbl": lbl, "ts": _now_iso()}]
        # continuità nel registro Atti
        tipo_atto = "nota_ente" if tipo == "richiesta_parere" else tipo
        is_out = tipo in ("richiesta_integrazione", "richiesta_parere", "avvio_procedimento", "risposta_cittadino")
        pg = next_prot(db) if is_out else None
        atto = models.Atto(
            id=next_atto_id(db), tipo=tipo_atto, numero=pg, oggetto=p.oggetto,
            stato="protocollato" if is_out else "bozza", praticaId=pid, autore=me, generatoAI=True,
            creato=_now_iso(), aggiornato=_now_iso(), albo=None, protocollo=pg, contenuto=contenuto,
            cronologia=[newlog("ai", "bozza_generata", f"Bozza generata dall'AI dalla pratica {pid}", aiBadge="AI"),
                        newlog(me, "pubblicazione" if is_out else "creazione",
                               "Protocollata in uscita" if is_out else "Bozza salvata nel registro",
                               statoNew="protocollato" if is_out else "bozza", dettaglio=pg)],
        )
        db.add(atto)

    db.commit()
    db.refresh(p)
    return p.dict()


# ---------- atti ----------
@router.get("/atti")
def list_atti(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    perm = R.PERM.get(me, {})
    if perm.get("supervisione") or not perm.get("lavora"):
        return [a.dict() for a in db.query(models.Atto).all()]
    # atti senza pratica (ordinanze, delibere pubbliche) + atti delle proprie pratiche
    prat_ids = {p.id for p in _prat_visibili(me, db)}
    return [a.dict() for a in db.query(models.Atto).all()
            if a.praticaId is None or a.praticaId in prat_ids]


@router.get("/atti/{aid}")
def get_atto(aid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    a = db.get(models.Atto, aid)
    if not a:
        raise HTTPException(404, "Atto non trovato")
    return a.dict()


@router.post("/atti/{aid}/stato")
def atto_stato(aid: str, payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "bozze")
    a = db.get(models.Atto, aid)
    if not a:
        raise HTTPException(404, "Atto non trovato")
    nuovo = payload.get("nuovo")
    if nuovo not in R.ATTI_STATI:
        raise HTTPException(400, "Stato atto non valido")
    t = R.ATTI_TIPI.get(a.tipo, {})
    azione, ltipo, dettaglio = "Stato aggiornato: " + R.ATTI_STATI[nuovo]["lbl"], "cambio_stato", None
    a.stato = nuovo
    a.aggiornato = _now_iso()
    if nuovo == "in_revisione":
        azione = "Inviato in revisione"
    elif nuovo == "pronta_firma":
        azione = "Contrassegnato come pronto per la firma"
    elif nuovo == "firmato":
        azione = "Atto firmato"
        if t.get("albo") and not a.numero:
            a.numero = next_sigla(db, t["sigla"])
            dettaglio = "Registrato come " + a.numero
    elif nuovo == "protocollato":
        azione, ltipo = "Protocollato in uscita", "pubblicazione"
        pg = next_prot(db)
        a.protocollo = pg
        a.numero = a.numero or pg
        dettaglio = pg
    elif nuovo == "pubblicato":
        azione, ltipo = "Pubblicato all'Albo Pretorio", "pubblicazione"
        a.albo = {"numero": next_albo(db), "dal": _now_iso(), "al": day_from(15)}
        dettaglio = "Albo n. " + a.albo["numero"]
        # Spinge automaticamente all'Albo esterno se configurato (fire-and-forget)
        try:
            esito = integ_module.pubblica_su_albo(a.dict())
            if esito.get("numero_albo"):
                a.albo["numero_esterno"] = esito["numero_albo"]
            dettaglio += f" · {esito['detail']}"
        except Exception:
            pass
    a.cronologia = [*a.cronologia, newlog(me, ltipo, azione, statoNew=nuovo, dettaglio=dettaglio)]
    db.commit()
    db.refresh(a)
    return a.dict()


# Stati in cui il testo dell'atto è ancora modificabile: fino alla firma compresa la
# fase "pronta_firma", così il responsabile può revisionare prima di firmare.
# Dopo «firmato» il testo è bloccato (atto giuridicamente perfezionato).
_ATTO_EDITABILE = ("bozza", "in_revisione", "pronta_firma")


@router.patch("/atti/{aid}/contenuto")
def salva_contenuto(aid: str, payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Salva il testo modificato dell'atto (consentito fino allo stato pronta_firma incluso)."""
    require_perm(me, "bozze")
    a = db.get(models.Atto, aid)
    if not a:
        raise HTTPException(404, "Atto non trovato")
    if a.stato not in _ATTO_EDITABILE:
        raise HTTPException(409, f"Modifica non consentita nello stato «{a.stato}»")
    nuovo_contenuto = (payload.get("contenuto") or "").strip()
    if not nuovo_contenuto:
        raise HTTPException(400, "Il contenuto non può essere vuoto")
    note = (payload.get("note") or "").strip()
    a.contenuto = nuovo_contenuto
    a.aggiornato = _now_iso()
    a.generatoAI = False  # il testo è stato validato/modificato dall'operatore
    azione = "Testo dell'atto modificato dall'ufficio" + (f" — {note}" if note else "")
    a.cronologia = [*a.cronologia, newlog(me, "modifica_testo", azione, dettaglio=note or None)]
    db.commit()
    db.refresh(a)
    try:
        search.index_one(db, "atto", a.id, a.oggetto, " ".join([a.oggetto, a.contenuto or "", a.numero or ""]))
    except Exception:
        pass
    return a.dict()


@router.post("/atti/{aid}/rigenera")
def rigenera_contenuto(aid: str, payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Rigenera la bozza dell'atto con AI secondo le istruzioni fornite. Non salva automaticamente."""
    require_perm(me, "bozze")
    a = db.get(models.Atto, aid)
    if not a:
        raise HTTPException(404, "Atto non trovato")
    if a.stato not in _ATTO_EDITABILE:
        raise HTTPException(409, f"Rigenerazione non consentita nello stato «{a.stato}»")
    istruzioni = (payload.get("istruzioni") or "").strip()
    contenuto_base = (a.contenuto or "").strip()
    try:
        if contenuto_base:
            nuovo = ai.revisiona(contenuto_base, istruzioni, a.oggetto)
        else:
            tipo_lbl = (payload.get("tipo_lbl") or a.tipo)
            # RAG: fonda la prima stesura sui passaggi pertinenti dell'indice (esclude l'atto stesso)
            fonti = search.blocco_fonti(search.contesto_per(db, f"{tipo_lbl} {a.oggetto}", k=4, escludi={f"atto:{a.id}"}))
            nuovo = ai.bozza(tipo_lbl, a.oggetto, fonti)
    except ai.AIUnavailable as e:
        raise HTTPException(503, f"Server AI non disponibile: {e}")
    return {"contenuto_nuovo": nuovo, "modello": settings.AI_MODEL_DRAFT or settings.AI_MODEL_GEN}


# ---------- beni ----------
@router.get("/beni")
def list_beni(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    return [b.dict() for b in db.query(models.Bene).all()]


@router.get("/beni/{bid}")
def get_bene(bid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    b = db.get(models.Bene, bid)
    if not b:
        raise HTTPException(404, "Bene non trovato")
    return b.dict()


@router.patch("/beni/{bid}/geo")
def set_bene_geo(bid: str, payload: dict, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Imposta o aggiorna le coordinate geografiche di un bene."""
    require_perm(me, "supervisione")
    b = db.get(models.Bene, bid)
    if not b:
        raise HTTPException(404, "Bene non trovato")
    lat = payload.get("lat")
    lon = payload.get("lon")
    if lat is not None:
        b.lat = float(lat)
    if lon is not None:
        b.lon = float(lon)
    db.commit()
    return b.dict()


@router.get("/beni/{bid}/qr.png")
def bene_qr(bid: str, db: Session = Depends(get_db)):
    b = db.get(models.Bene, bid)
    if not b:
        raise HTTPException(404, "Bene non trovato")
    buf = io.BytesIO()
    segno.make(f"TRASPARENTIA|{b.id}|{b.codice}", error="m").save(buf, kind="png", scale=5, border=2, dark="#17324d")
    return Response(content=buf.getvalue(), media_type="image/png")


_BENI_STATI_TUTTI = {"ottimo", "buono", "discreto", "scarso", "critico"}


def _float_or_none(v):
    try:
        return float(v) if v not in (None, "", "null") else None
    except (ValueError, TypeError):
        return None


@router.post("/beni", status_code=201)
def crea_bene(payload: dict, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "supervisione")
    denominazione = (payload.get("denominazione") or "").strip()
    tipo = (payload.get("tipo") or "").strip()
    categoria = (payload.get("categoria") or "").strip()
    if not denominazione or not tipo or not categoria:
        raise HTTPException(400, "tipo, categoria e denominazione sono obbligatori")
    stato = (payload.get("stato") or "buono").strip()
    if stato not in _BENI_STATI_TUTTI:
        stato = "buono"
    dati = payload.get("dati") or {}
    b = models.Bene(
        id=str(uuid.uuid4()),
        tipo=tipo,
        categoria=categoria,
        denominazione=denominazione,
        ubicazione=(payload.get("ubicazione") or "").strip(),
        codice=(payload.get("codice") or "").strip(),
        stato=stato,
        responsabile=payload.get("responsabile") or None,
        lat=_float_or_none(payload.get("lat")),
        lon=_float_or_none(payload.get("lon")),
        dati=dati if isinstance(dati, dict) else {},
    )
    db.add(b)
    db.commit()
    return b.dict()


@router.put("/beni/{bid}")
def aggiorna_bene(bid: str, payload: dict, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "supervisione")
    b = db.get(models.Bene, bid)
    if not b:
        raise HTTPException(404, "Bene non trovato")
    if "denominazione" in payload:
        b.denominazione = (payload["denominazione"] or "").strip()
    if "tipo" in payload:
        b.tipo = (payload["tipo"] or "").strip()
    if "categoria" in payload:
        b.categoria = (payload["categoria"] or "").strip()
    if "ubicazione" in payload:
        b.ubicazione = (payload["ubicazione"] or "").strip()
    if "codice" in payload:
        b.codice = (payload["codice"] or "").strip()
    if "stato" in payload:
        s = (payload["stato"] or "buono").strip()
        b.stato = s if s in _BENI_STATI_TUTTI else "buono"
    if "responsabile" in payload:
        b.responsabile = payload["responsabile"] or None
    if "lat" in payload:
        b.lat = _float_or_none(payload["lat"])
    if "lon" in payload:
        b.lon = _float_or_none(payload["lon"])
    if "dati" in payload and isinstance(payload["dati"], dict):
        b.dati = payload["dati"]
    db.commit()
    return b.dict()


@router.delete("/beni/{bid}", status_code=204)
def elimina_bene(bid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "supervisione")
    b = db.get(models.Bene, bid)
    if not b:
        raise HTTPException(404, "Bene non trovato")
    db.delete(b)
    db.commit()


# ---------- sicurezza & log ----------
@router.get("/log")
def log_attivita(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    items = []
    for p in db.query(models.Pratica).all():
        for e in p.cronologia or []:
            items.append({**e, "ref": p.id, "refTipo": "pratica", "oggetto": p.oggetto})
    for a in db.query(models.Atto).all():
        for e in a.cronologia or []:
            items.append({**e, "ref": a.id, "refTipo": "atto", "oggetto": a.oggetto})
    items.sort(key=lambda x: x.get("ts", ""), reverse=True)
    per_attore = {}
    for it in items:
        per_attore[it["attoreId"]] = per_attore.get(it["attoreId"], 0) + 1
    return {"eventi": items[:200], "totale": len(items), "perAttore": per_attore,
            "perm": R.PERM, "users": R.USERS}


# ---------- documenti / PEC (Fase 4) ----------
@router.get("/documenti/{did}/file")
def documento_file(did: str, db: Session = Depends(get_db)):
    d = db.get(models.Documento, did)
    if not d or not d.objectKey:
        raise HTTPException(404, "Documento non disponibile")
    data = storage.get(d.objectKey)
    if data is None:
        raise HTTPException(503, "Storage non raggiungibile")
    return Response(content=data, media_type=d.contentType,
                    headers={"Content-Disposition": f'inline; filename="{d.filename}"'})


@router.get("/eccezioni")
def eccezioni(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    docs = db.query(models.Documento).filter(models.Documento.stato == "eccezione").all()
    return [d.dict() for d in docs]


@router.get("/storage/status")
def storage_status(me: str = Depends(auth_user)):
    return {"available": storage.available(), "bucket": settings.MINIO_BUCKET}


@router.get("/pec/status")
def pec_status(me: str = Depends(auth_user)):
    return {"configured": ingest.pec_configured(), "host": ingest.settings.PEC_HOST or None, "folder": ingest.settings.PEC_FOLDER}


@router.post("/pec/sync")
def pec_sync(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "classifica")
    res = ingest.sync_pec(db)
    if res.get("nuove"):
        try:
            search.reindex(db)
            # Embeddings in coda asincrona se disponibile, altrimenti sincrono
            _enqueue_embed()
        except Exception:
            pass
    return res


# ---------- ricerca (semantica + lessicale) ----------
@router.get("/cerca")
def cerca(q: str = "", mode: str = "auto", me: str = Depends(auth_user), db: Session = Depends(get_db)):
    return search.cerca(db, q, mode)


@router.get("/cerca/status")
def cerca_status(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    return search.status(db)


@router.post("/cerca/reindex")
def cerca_reindex(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "classifica")
    n = search.reindex(db)
    _enqueue_embed()
    return {"indicizzati": n, "embedding_generati": "in_coda", **search.status(db)}


# ---------- cruscotto ----------
def _is_ritardo(p):
    if not p.scadenza:
        return False
    d = (date.fromisoformat(p.scadenza) - date.today()).days
    return d < 0 and p.stato not in ("conclusa", "archiviata", "in_attesa_integrazione", "in_attesa_parere")


@router.get("/cruscotto")
def cruscotto(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    com = db.query(models.Comunicazione).all()
    prat = db.query(models.Pratica).all()
    atti = db.query(models.Atto).all()
    aperte = [p for p in prat if p.stato not in ("conclusa", "archiviata")]

    def giorni(p):
        return (date.fromisoformat(p.scadenza) - date.today()).days if p.scadenza else None

    in_scadenza = [p for p in aperte if (giorni(p) is not None and 0 <= giorni(p) <= 7)]
    critici = [p for p in aperte if (giorni(p) is not None and 0 <= giorni(p) <= 3)]
    in_ritardo = [p for p in prat if _is_ritardo(p)]
    per_ufficio: dict[str, int] = {}
    for p in aperte:
        per_ufficio[p.ufficio] = per_ufficio.get(p.ufficio, 0) + 1
    return {
        "daLavorare": len([c for c in com if not c.pratica]),
        "praticheAperte": len(aperte),
        "inScadenza": len(in_scadenza),
        "critici": len(critici),
        "inRitardo": len(in_ritardo),
        "daFirmare": len([a for a in atti if a.stato == "pronta_firma"]),
        "perUfficio": per_ufficio,
        "pratiche": sorted(
            [{"id": p.id, "oggetto": p.oggetto, "stato": p.stato, "responsabile": p.responsabile,
              "scadenza": p.scadenza, "giorni": giorni(p), "ritardo": _is_ritardo(p)} for p in aperte],
            key=lambda x: (x["giorni"] is None, x["giorni"] if x["giorni"] is not None else 9999),
        ),
        "attiDaFirmare": [{"id": a.id, "oggetto": a.oggetto, "tipo": a.tipo, "generatoAI": a.generatoAI}
                          for a in atti if a.stato == "pronta_firma"],
    }


# ---------- notifiche (Fase 6) ----------
@router.get("/notifiche")
def list_notifiche(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Notifiche per l'utente: proprie + broadcast (destinatario=NULL)."""
    items = db.query(models.Notifica).filter(
        or_(models.Notifica.destinatario == me, models.Notifica.destinatario.is_(None))
    ).order_by(models.Notifica.creata.desc(), models.Notifica.id.desc()).limit(50).all()
    return [n.dict() for n in items]


@router.post("/notifiche/{nid}/letta")
def segna_letta(nid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    n = db.get(models.Notifica, nid)
    if not n:
        raise HTTPException(404, "Notifica non trovata")
    n.letta = True
    db.commit()
    return {"ok": True}


@router.post("/notifiche/segna-tutto-letto")
def segna_tutto_letto(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    db.query(models.Notifica).filter(
        or_(models.Notifica.destinatario == me, models.Notifica.destinatario.is_(None)),
        models.Notifica.letta.is_(False),
    ).update({"letta": True}, synchronize_session=False)
    db.commit()
    return {"ok": True}


# ---------- report periodici (Fase 6) ----------
def _data_chiusura(p) -> str | None:
    for e in reversed(p.cronologia or []):
        if e.get("statoNew") in ("conclusa", "archiviata"):
            return (e.get("ts") or "")[:10]
    return None


@router.get("/report")
def get_report(tipo: str = "settimanale", me: str = Depends(auth_user), db: Session = Depends(get_db)):
    """Report statistico pratiche: settimanale (7 gg) o mensile (30 gg)."""
    oggi = date.today()
    giorni_periodo = 7 if tipo == "settimanale" else 30
    da = (oggi - timedelta(days=giorni_periodo)).isoformat()

    pratiche = db.query(models.Pratica).all()
    aperte = [p for p in pratiche if p.stato not in ("conclusa", "archiviata")]
    aperte_periodo = [p for p in pratiche if (p.apertura or "") >= da]
    concluse_periodo = [p for p in pratiche
                        if p.stato in ("conclusa", "archiviata") and (_data_chiusura(p) or "") >= da]
    in_ritardo = [p for p in pratiche if _is_ritardo(p)]

    per_ufficio: dict[str, dict] = {}
    for p in aperte:
        u = p.ufficio
        if u not in per_ufficio:
            per_ufficio[u] = {"aperte": 0, "inRitardo": 0}
        per_ufficio[u]["aperte"] += 1
        if _is_ritardo(p):
            per_ufficio[u]["inRitardo"] += 1

    tempi = []
    for p in pratiche:
        chius = _data_chiusura(p)
        if chius and p.apertura:
            try:
                days = (date.fromisoformat(chius) - date.fromisoformat(p.apertura)).days
                if days >= 0:
                    tempi.append(days)
            except Exception:
                pass

    return {
        "tipo": tipo,
        "periodo": {"da": da, "a": oggi.isoformat(), "giorni": giorni_periodo},
        "praticheAperte": len(aperte),
        "apertePeriodo": len(aperte_periodo),
        "conclusePeriodo": len(concluse_periodo),
        "inRitardo": len(in_ritardo),
        "tempoMedioGiorni": round(sum(tempi) / len(tempi), 1) if tempi else None,
        "perUfficio": per_ufficio,
        "generato": oggi.isoformat(),
    }


# ---------- diagnostica & configurazione (Fase 3+7) ----------
@router.get("/diagnostica")
def get_diagnostica(me: str = Depends(auth_user)):
    """Stato di tutti i servizi di connessione + configurazione (segreti mascherati)."""
    return diagnostica.panoramica()


@router.post("/diagnostica/test/{servizio}")
def test_servizio(servizio: str, me: str = Depends(auth_user)):
    """Prova la connessione di un singolo servizio in tempo reale."""
    return diagnostica.test_servizio(servizio)


@router.post("/diagnostica/smtp/prova")
def prova_smtp(payload: dict = Body(default={}), me: str = Depends(auth_user)):
    """Invia un'email di prova al destinatario indicato (o all'email dell'utente)."""
    require_perm(me, "supervisione")
    to = (payload.get("to") or "").strip() or R.USERS.get(me, {}).get("email", "")
    if not to:
        raise HTTPException(400, "Nessun destinatario per la prova SMTP.")
    res = mailer.send(to, "[TrasParentIA] Email di prova",
                      "Questa è un'email di prova inviata dalla diagnostica di TrasParentIA.\n"
                      "Se la ricevi, la posta in uscita è configurata correttamente.")
    return res


# ---------- configurazione runtime ----------
@router.get("/configurazione/impostazioni")
def get_impostazioni(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    return configurazione_cfg.leggi_tutte(db)


@router.post("/configurazione/impostazioni")
def post_impostazioni(payload: dict = Body(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "supervisione")
    return configurazione_cfg.salva(db, payload)


_STEMMA_KEY = "stemma/stemma"
_STEMMA_CT_KEY = "STEMMA_CT"


@router.post("/configurazione/stemma")
async def upload_stemma(file: UploadFile = File(...), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "supervisione")
    data = await file.read()
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(413, "File troppo grande (max 2 MB)")
    ct = file.content_type or "image/png"
    if not ct.startswith("image/"):
        raise HTTPException(400, "Solo file immagine (PNG, SVG, JPEG)")
    if not storage.put(_STEMMA_KEY, data, ct):
        raise HTTPException(503, "Storage non disponibile")
    oggi = date.today().isoformat()
    row = db.query(models.ImpostazioneConfig).filter(models.ImpostazioneConfig.chiave == _STEMMA_CT_KEY).first()
    if row:
        row.valore = ct; row.modificata = oggi
    else:
        db.add(models.ImpostazioneConfig(chiave=_STEMMA_CT_KEY, valore=ct, modificata=oggi))
    db.commit()
    return {"ok": True, "content_type": ct}


@router.get("/configurazione/stemma")
def get_stemma(db: Session = Depends(get_db)):
    data = storage.get(_STEMMA_KEY)
    if data is None:
        raise HTTPException(404, "Nessuno stemma caricato")
    row = db.query(models.ImpostazioneConfig).filter(models.ImpostazioneConfig.chiave == _STEMMA_CT_KEY).first()
    ct = row.valore if row else "image/png"
    return Response(content=data, media_type=ct)


# ---------- importazione massiva (Fase 8) ----------
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB per file


@router.get("/import/lotti")
def list_lotti(me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "classifica")
    lotti = db.query(models.LottoImport).order_by(models.LottoImport.creato.desc()).all()
    return {"lotti": [l.dict() for l in lotti]}


@router.post("/import/lotto")
def crea_lotto(payload: dict = Body(default={}), me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "classifica")
    lotto = imp_module.crea_lotto(db, payload.get("nome", ""), me)
    return lotto.dict()


@router.get("/import/lotto/{lid}")
def get_lotto(lid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "classifica")
    lotto = db.query(models.LottoImport).filter(models.LottoImport.id == lid).first()
    if not lotto:
        raise HTTPException(404, "Lotto non trovato")
    items = db.query(models.ItemImport).filter(models.ItemImport.lottoId == lid).order_by(models.ItemImport.creato).all()
    return {**lotto.dict(), "items": [i.dict() for i in items]}


@router.post("/import/lotto/{lid}/upload")
async def upload_items(lid: str, files: list[UploadFile] = File(...),
                       me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "classifica")
    lotto = db.query(models.LottoImport).filter(models.LottoImport.id == lid).first()
    if not lotto:
        raise HTTPException(404, "Lotto non trovato")
    if lotto.stato != "in_corso":
        raise HTTPException(400, "Lotto già completato")
    creati = []
    for f in files:
        data = await f.read()
        if len(data) > _MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"File '{f.filename}' supera il limite di 20 MB")
        item = imp_module.aggiungi_item(db, lid, f.filename, f.content_type or "application/octet-stream", data)
        creati.append(item.dict())
    return {"creati": len(creati), "items": creati}


@router.post("/import/item/{iid}/classifica")
def classifica_item(iid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "classifica")
    item = db.query(models.ItemImport).filter(models.ItemImport.id == iid).first()
    if not item:
        raise HTTPException(404, "Item non trovato")
    item = imp_module.classifica_item(db, item)
    return item.dict()


@router.post("/import/item/{iid}/applica")
def applica_item(iid: str, payload: dict = Body(default={}),
                 me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "prendiCarico")
    item = db.query(models.ItemImport).filter(models.ItemImport.id == iid).first()
    if not item:
        raise HTTPException(404, "Item non trovato")
    if item.stato == "applicato":
        raise HTTPException(400, "Item già applicato")
    com = imp_module.applica_item(db, item, me, payload.get("override"))
    return {"ok": True, "comId": com.id, "item": item.dict()}


@router.post("/import/item/{iid}/scarta")
def scarta_item(iid: str, payload: dict = Body(default={}),
                me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "classifica")
    item = db.query(models.ItemImport).filter(models.ItemImport.id == iid).first()
    if not item:
        raise HTTPException(404, "Item non trovato")
    item = imp_module.scarta_item(db, item, payload.get("nota", ""))
    return item.dict()


@router.post("/import/lotto/{lid}/chiudi")
def chiudi_lotto(lid: str, me: str = Depends(auth_user), db: Session = Depends(get_db)):
    require_perm(me, "supervisione")
    lotto = db.query(models.LottoImport).filter(models.LottoImport.id == lid).first()
    if not lotto:
        raise HTTPException(404, "Lotto non trovato")
    return imp_module.chiudi_lotto(db, lotto).dict()


# ---------- backup (Fase 7) ----------
@router.get("/backup")
def list_backup(me: str = Depends(auth_user)):
    require_perm(me, "supervisione")
    return {"backup": backup_module.elenco(), "dir": settings.BACKUP_DIR}


@router.post("/backup")
def crea_backup(me: str = Depends(auth_user)):
    require_perm(me, "supervisione")
    res = backup_module.esegui()
    if not res.get("ok"):
        raise HTTPException(500, res.get("detail", "Backup fallito"))
    return res


@router.post("/backup/ripristina")
def ripristina_backup(payload: dict = Body(...), me: str = Depends(auth_user)):
    require_perm(me, "supervisione")
    filename = payload.get("file", "")
    if not filename:
        raise HTTPException(400, "Campo 'file' obbligatorio")
    res = backup_module.ripristina(filename)
    if not res.get("ok"):
        raise HTTPException(500, res.get("detail", "Ripristino fallito"))
    return res


# ---------- integrazione sistemi documentali esterni ----------
@router.post("/integrazione/{tipo}/test")
def test_integrazione(tipo: str, me: str = Depends(auth_user)):
    require_perm(me, "supervisione")
    if tipo not in ("albo", "protocollo"):
        raise HTTPException(400, "Tipo non valido (albo | protocollo)")
    return integ_module.test_connessione(tipo)


# ---------- golden set — calibrazione classificazione AI (P4) ----------

@router.get("/golden-set/campione")
def golden_set_campione(
    n: int = 50,
    ordine: str = "confidenza_asc",
    me: str = Depends(auth_user),
    db: Session = Depends(get_db),
):
    """Estrae un campione di comunicazioni con classificazione AI per la validazione manuale.
    ordine: confidenza_asc (priorità bassa confidenza) | recenti | random
    Esportare il risultato, etichettare manualmente la categoria corretta e inviare a POST /golden-set/valuta."""
    require_perm(me, "supervisione")
    rows = db.query(models.Comunicazione).all()
    classificate = [c for c in rows if isinstance(c.ai, dict) and c.ai.get("categoria")]

    if ordine == "confidenza_asc":
        classificate.sort(key=lambda c: float(c.ai.get("confidenza", 1.0)))
    elif ordine == "recenti":
        classificate.sort(key=lambda c: c.arrivo or "", reverse=True)
    else:
        random.shuffle(classificate)

    campione = classificate[: max(1, min(n, 500))]
    return {
        "totale_disponibile": len(classificate),
        "soglia_corrente": settings.SOGLIA_CONFIDENZA_BASSA,
        "campione": [
            {
                "id": c.id,
                "oggetto": c.oggetto,
                "mittente": c.mittente.get("nome", "") if isinstance(c.mittente, dict) else str(c.mittente or ""),
                "arrivo": c.arrivo,
                "canale": c.canale,
                "ai_categoria": c.ai.get("categoria", ""),
                "ai_confidenza": round(float(c.ai.get("confidenza", 0.0)), 3),
                "ai_motivazione": c.ai.get("motivazione", ""),
            }
            for c in campione
        ],
    }


@router.post("/golden-set/valuta")
def golden_set_valuta(
    payload: dict = Body(...),
    me: str = Depends(auth_user),
    db: Session = Depends(get_db),
):
    """Calcola l'accuratezza della classificazione AI su un campione etichettato manualmente.
    Body: {"campione": [{"id": "...", "categoria_corretta": "..."}]}
    Restituisce: accuratezza totale, per categoria, e soglia di confidenza suggerita."""
    require_perm(me, "supervisione")
    campione = payload.get("campione") or []
    if not campione:
        raise HTTPException(400, "Campo 'campione' vuoto o mancante")

    per_categoria: dict[str, dict] = {}
    corretti = 0
    non_trovati = 0

    for item in campione:
        cid = (item.get("id") or "").strip()
        cat_corretta = (item.get("categoria_corretta") or "").strip()
        if not cid or not cat_corretta:
            continue
        c = db.query(models.Comunicazione).filter(models.Comunicazione.id == cid).first()
        if not c or not isinstance(c.ai, dict):
            non_trovati += 1
            continue
        cat_ai = c.ai.get("categoria", "")
        bucket = per_categoria.setdefault(cat_corretta, {"totale": 0, "corretti": 0})
        bucket["totale"] += 1
        if cat_ai == cat_corretta:
            corretti += 1
            bucket["corretti"] += 1

    totale = sum(v["totale"] for v in per_categoria.values())
    accuratezza = round(corretti / totale * 100, 1) if totale else 0.0
    soglia_suggerita = 0.70 if accuratezza >= 85 else (0.60 if accuratezza >= 70 else 0.50)

    return {
        "totale_valutati": totale,
        "corretti": corretti,
        "accuratezza_pct": accuratezza,
        "target_minimo_pct": 80.0,
        "non_trovati": non_trovati,
        "soglia_confidenza_attuale": settings.SOGLIA_CONFIDENZA_BASSA,
        "soglia_suggerita": soglia_suggerita,
        "per_categoria": {
            k: {**v, "accuratezza_pct": round(v["corretti"] / v["totale"] * 100, 1) if v["totale"] else 0.0}
            for k, v in sorted(per_categoria.items())
        },
    }


# ---------- importazione CSV beni (P4) ----------

_BENI_CAMPI_NOTI = {"tipo", "categoria", "denominazione", "ubicazione", "codice", "stato", "responsabile", "lat", "lon"}
_BENI_STATI_VALIDI = {"buono", "discreto", "scarso", "critico"}


@router.post("/beni/import-csv")
async def import_beni_csv(
    file: UploadFile = File(...),
    me: str = Depends(auth_user),
    db: Session = Depends(get_db),
):
    """Importazione massiva beni da CSV (encoding UTF-8 o Latin-1).
    Colonne obbligatorie: tipo, categoria, denominazione.
    Opzionali: ubicazione, codice, stato, responsabile.
    Colonne extra → campo JSON 'dati'."""
    require_perm(me, "supervisione")
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    importati: list[str] = []
    errori: list[dict] = []

    for i, row in enumerate(reader, start=2):
        denominazione = (row.get("denominazione") or "").strip()
        tipo = (row.get("tipo") or "").strip()
        categoria = (row.get("categoria") or "").strip()
        if not denominazione or not tipo or not categoria:
            errori.append({"riga": i, "errore": "tipo, categoria e denominazione sono obbligatori", "raw": dict(row)})
            continue
        stato = (row.get("stato") or "buono").strip()
        if stato not in _BENI_STATI_VALIDI:
            stato = "buono"
        dati_extra = {k: v for k, v in row.items() if k not in _BENI_CAMPI_NOTI and v and k}
        def _float_or_none(v):
            try: return float(v) if v else None
            except (ValueError, TypeError): return None
        bene = models.Bene(
            id=str(uuid.uuid4()),
            tipo=tipo,
            categoria=categoria,
            denominazione=denominazione,
            ubicazione=(row.get("ubicazione") or "").strip(),
            codice=(row.get("codice") or "").strip(),
            stato=stato,
            responsabile=(row.get("responsabile") or None) or None,
            lat=_float_or_none(row.get("lat")),
            lon=_float_or_none(row.get("lon")),
            dati=dati_extra,
        )
        db.add(bene)
        importati.append(bene.id)

    db.commit()
    return {
        "importati": len(importati),
        "errori": len(errori),
        "dettaglio_errori": errori[:20],
    }
