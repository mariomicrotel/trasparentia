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


# Chunking per ricerca semantica / RAG. Chunk corti → retrieval più preciso e
# contesto più snello passato al modello (cruciale con poca VRAM: meno token = più veloce).
CHUNK_SIZE = 1400
CHUNK_OVERLAP = 200


def _chunk(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Spezza il testo in segmenti ~size caratteri con sovrapposizione, tagliando su un
    confine naturale (a capo, fine frase, spazio) per non spezzare le parole a metà."""
    text = (text or "").strip()
    if len(text) <= size:
        return [text] if text else []
    chunks, start = [], 0
    while start < len(text):
        end = start + size
        if end < len(text):
            window = text[start:end]
            cut = max(window.rfind("\n"), window.rfind(". "), window.rfind(" "))
            if cut > size - 250:
                end = start + cut + 1
        pezzo = text[start:end].strip()
        if pezzo:
            chunks.append(pezzo)
        if end >= len(text):
            break
        start = end - overlap
    return chunks


def _index_rows(tipo, rid, titolo, testo):
    """Una riga Indice per ogni chunk della fonte (id = «tipo:rid#i»)."""
    parti = _chunk(testo) or [""]
    return [models.Indice(id=f"{tipo}:{rid}#{i}", refTipo=tipo, refId=rid,
                          titolo=titolo or rid, testo=parte)
            for i, parte in enumerate(parti)]


def reindex(db) -> int:
    db.query(models.Indice).delete()
    n = 0
    for tipo, rid, tit, txt in _sources(db):
        for row in _index_rows(tipo, rid, tit, txt):
            db.add(row)
        n += 1
    db.commit()
    return n


def index_one(db, tipo, rid, titolo, testo):
    # Rimpiazza tutti i chunk della fonte (il loro numero può variare a ogni aggiornamento)
    db.query(models.Indice).filter(models.Indice.id.like(f"{tipo}:{rid}#%")).delete(synchronize_session=False)
    old = db.get(models.Indice, f"{tipo}:{rid}")   # compat: vecchia riga non-chunked
    if old:
        db.delete(old)
    rows = _index_rows(tipo, rid, titolo, testo)
    for row in rows:
        db.add(row)
    db.commit()
    try:
        embed_pending(db, limit=len(rows))
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


# ---------- RAG: recupero del contesto per la generazione assistita ----------

def contesto_per(db, query: str, k: int = 4, escludi: set[str] | None = None,
                 max_char: int = 1200, budget_char: int = 4000) -> list[dict]:
    """Recupera fino a k passaggi pertinenti dall'Indice (ricerca semantica) per
    fondare la generazione di una bozza/risposta. Un solo chunk per fonte (diversità)
    e un tetto complessivo `budget_char` per tenere il contesto snello → generazione
    più rapida sull'hardware locale. `escludi` contiene chiavi «tipo:id» di fonti da
    saltare (es. il record stesso). Ritorna [] se l'embedding non è disponibile
    (AI offline o indice non embeddato): la generazione procede comunque senza fonti."""
    query = (query or "").strip()
    if not query:
        return []
    try:
        qv = ai.embed(query)
    except ai.AIUnavailable:
        return []
    if not qv or len(qv) != settings.EMBED_DIM:
        return []
    escludi = escludi or set()
    # Sovra-campiona: i chunk della stessa fonte vanno deduplicati a valle.
    rows = (db.query(models.Indice)
              .filter(models.Indice.embedding.is_not(None))
              .order_by(models.Indice.embedding.cosine_distance(qv))
              .limit(k * 5 + len(escludi) * 3).all())
    passaggi, visti, tot = [], set(), 0
    for r in rows:
        src = f"{r.refTipo}:{r.refId}"
        if src in escludi or src in visti:
            continue
        testo = (r.testo or "").strip()[:max_char]
        if not testo:
            continue
        if passaggi and tot + len(testo) > budget_char:
            break
        visti.add(src)
        passaggi.append({"rif": src, "titolo": r.titolo, "testo": testo})
        tot += len(testo)
        if len(passaggi) >= k:
            break
    return passaggi


def blocco_fonti(passaggi: list[dict]) -> str:
    """Impacchetta i passaggi recuperati nel blocco FONTI da iniettare nel prompt.
    Stringa vuota se non ci sono passaggi → la generazione resta libera."""
    if not passaggi:
        return ""
    return "\n\n".join(
        f"[FONTE {i + 1} — {p['titolo']} ({p['rif']})]\n{p['testo']}"
        for i, p in enumerate(passaggi)
    )


def status(db) -> dict:
    tot = db.query(models.Indice).count()
    emb = db.query(models.Indice).filter(models.Indice.embedding.is_not(None)).count()
    ai_ok = ai.status().get("online", False)
    return {"indicizzati": tot, "conEmbedding": emb, "semanticaPronta": emb > 0,
            "embedModel": settings.AI_MODEL_EMBED, "aiOnline": ai_ok}


def _dedup_per_fonte(rows, limit):
    """Tiene il primo (= più pertinente) chunk per ogni fonte, così la ricerca utente
    mostra ogni documento una sola volta anche se l'indice è suddiviso in chunk."""
    visti, out = set(), []
    for r in rows:
        key = (r.refTipo, r.refId)
        if key in visti:
            continue
        visti.add(key)
        out.append(r)
        if len(out) >= limit:
            break
    return out


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
                    .order_by(models.Indice.embedding.cosine_distance(qv)).limit(limit * 4).all())
            rows = _dedup_per_fonte(rows, limit)
            return {"mode": "semantic", "query": q, "risultati": [_result(db, r) for r in rows]}
        if mode == "semantic":
            return {"mode": "semantic_unavailable", "query": q, "risultati": []}

    terms = [t for t in q.split() if len(t) > 1] or [q]
    conds = [or_(models.Indice.titolo.ilike(f"%{t}%"), models.Indice.testo.ilike(f"%{t}%")) for t in terms]
    rows = db.query(models.Indice).filter(and_(*conds)).limit(limit * 4).all()
    rows = _dedup_per_fonte(rows, limit)
    return {"mode": "lexical", "query": q, "risultati": [_result(db, r) for r in rows]}
