"""Ricerca ibrida: lessicale (sempre disponibile) + semantica via pgvector.
L'indice unifica comunicazioni, pratiche, atti e documenti. Gli embedding sono
generati best-effort tramite il server AI esterno (modello di embedding)."""
from sqlalchemy import or_, and_

from . import models
from .ai import client as ai
from .config import settings


def _sources(db):
    rows = []
    for c in db.query(models.Comunicazione).all():
        rows.append(("comunicazione", c.id, c.oggetto,
                     " ".join([c.oggetto, (c.mittente or {}).get("nome", ""), " ".join(c.corpo or [])])))
    for p in db.query(models.Pratica).all():
        rows.append(("pratica", p.id, p.oggetto,
                     " ".join([p.oggetto, p.tipoProcedimento or "", p.richiedente or "", p.protocollo or ""])))
    for a in db.query(models.Atto).all():
        rows.append(("atto", a.id, a.oggetto, " ".join([a.oggetto, a.contenuto or "", a.numero or ""])))
    for d in db.query(models.Documento).all():
        rows.append(("documento", d.id, d.filename, d.testo or ""))
    return rows


def reindex(db) -> int:
    db.query(models.Indice).delete()
    n = 0
    for tipo, rid, tit, txt in _sources(db):
        db.add(models.Indice(id=f"{tipo}:{rid}", refTipo=tipo, refId=rid, titolo=tit or rid, testo=(txt or "")[:8000]))
        n += 1
    db.commit()
    return n


def index_one(db, tipo, rid, titolo, testo):
    iid = f"{tipo}:{rid}"
    existing = db.get(models.Indice, iid)
    if existing:
        existing.titolo = titolo or rid
        existing.testo = (testo or "")[:8000]
        existing.embedding = None
    else:
        db.add(models.Indice(id=iid, refTipo=tipo, refId=rid, titolo=titolo or rid, testo=(testo or "")[:8000]))
    db.commit()
    try:
        embed_pending(db, limit=1)
    except Exception:
        pass


def embed_pending(db, limit=1000) -> int:
    pend = db.query(models.Indice).filter(models.Indice.embedding.is_(None)).limit(limit).all()
    done = 0
    for row in pend:
        try:
            v = ai.embed((row.titolo + "\n" + row.testo)[:4000])
        except ai.AIUnavailable:
            break  # server AI non raggiungibile: ci si ferma, riprovabile più tardi
        if v and len(v) == settings.EMBED_DIM:
            row.embedding = v
            done += 1
    if done:
        db.commit()
    return done


def _result(db, row):
    snip = (row.testo or "").strip().replace("\n", " ")
    return {"refTipo": row.refTipo, "refId": row.refId, "titolo": row.titolo,
            "snippet": (snip[:180] + "…") if len(snip) > 180 else snip}


def status(db) -> dict:
    tot = db.query(models.Indice).count()
    emb = db.query(models.Indice).filter(models.Indice.embedding.is_not(None)).count()
    ai_ok = ai.status().get("online", False)
    return {"indicizzati": tot, "conEmbedding": emb, "semanticaPronta": emb > 0,
            "embedModel": settings.AI_MODEL_EMBED, "aiOnline": ai_ok}


def cerca(db, q: str, mode: str = "auto", limit: int = 25) -> dict:
    q = (q or "").strip()
    if not q:
        return {"mode": "none", "query": q, "risultati": []}

    if mode in ("auto", "semantic"):
        qv = None
        try:
            qv = ai.embed(q)
        except ai.AIUnavailable:
            qv = None
        has_emb = db.query(models.Indice).filter(models.Indice.embedding.is_not(None)).count()
        if qv and len(qv) == settings.EMBED_DIM and has_emb:
            rows = (db.query(models.Indice).filter(models.Indice.embedding.is_not(None))
                    .order_by(models.Indice.embedding.cosine_distance(qv)).limit(limit).all())
            return {"mode": "semantic", "query": q, "risultati": [_result(db, r) for r in rows]}
        if mode == "semantic":
            return {"mode": "semantic_unavailable", "query": q, "risultati": []}

    terms = [t for t in q.split() if len(t) > 1] or [q]
    conds = [or_(models.Indice.titolo.ilike(f"%{t}%"), models.Indice.testo.ilike(f"%{t}%")) for t in terms]
    rows = db.query(models.Indice).filter(and_(*conds)).limit(limit).all()
    return {"mode": "lexical", "query": q, "risultati": [_result(db, r) for r in rows]}
