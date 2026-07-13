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
                 max_char: int = 1200, budget_char: int = 4000,
                 max_dist: float | None = None) -> list[dict]:
    """Recupera fino a k passaggi pertinenti dall'Indice (ricerca semantica) per
    fondare la generazione di una bozza/risposta. Un solo chunk per fonte (diversità)
    e un tetto complessivo `budget_char` per tenere il contesto snello → generazione
    più rapida sull'hardware locale. `escludi` contiene chiavi «tipo:id» di fonti da
    saltare (es. il record stesso). Con `max_dist` scarta i passaggi oltre quella
    distanza coseno (evita di allegare fonti non pertinenti, es. nell'assistente).
    Ritorna [] se l'embedding non è disponibile (AI offline o indice non embeddato)."""
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
    dist = models.Indice.embedding.cosine_distance(qv)
    # Sovra-campiona: i chunk della stessa fonte vanno deduplicati a valle.
    rows = (db.query(models.Indice, dist.label("dist"))
              .filter(models.Indice.embedding.is_not(None))
              .order_by(dist)
              .limit(k * 5 + len(escludi) * 3).all())
    passaggi, visti, tot = [], set(), 0
    for r, d in rows:
        if max_dist is not None and d is not None and d > max_dist:
            break  # ordinati per distanza: da qui in poi non pertinenti
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


# ---------- Retrieval lessicale (robusto per query con parole-chiave) ----------
import re as _re

_STOP = {"il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "del", "dello",
         "della", "dei", "degli", "delle", "dell", "e", "ed", "o", "che", "chi", "come",
         "cosa", "quale", "quali", "quando", "quanto", "per", "con", "su", "in", "a", "al",
         "allo", "alla", "ai", "agli", "alle", "da", "dal", "è", "sono", "essere", "fare",
         "mi", "si", "ci", "non", "più", "me", "tra", "fra", "questo", "questa"}


def _termini(query: str) -> list[str]:
    toks = _re.findall(r"[a-zA-Zàèéìòùáí0-9]{3,}", (query or "").lower())
    return [t for t in toks if t not in _STOP]


def _norma_rif_titolo(r) -> tuple[str, str]:
    """Riferimento univoco + titolo leggibile di un NormaChunk. Per i documenti
    con articoli usa l'articolo; per quelli senza (es. PIAO) usa l'id del chunk
    e un numero di estratto, così le citazioni restano distinte e precise."""
    if r.articolo:
        titolo = f"{r.regolamento} — art. {r.articolo}" + (f" ({r.rubrica})" if r.rubrica else "")
        return f"{r.regolamentoId}:{r.articolo}", titolo
    seg = r.id.rsplit("#", 1)[-1] if "#" in (r.id or "") else ""
    return r.id, f"{r.regolamento} — estratto {seg}".strip()


def norme_lessicali(db, query: str, k: int = 5, max_char: int = 1400) -> list[dict]:
    """Ricerca lessicale nel corpus normativo vigente: match dei termini della
    domanda su testo/rubrica/titolo, ordinati per numero di termini presenti.
    Robusta dove la semantica fallisce (nomi di regolamenti, sigle come «IMU»)."""
    termini = _termini(query)
    if not termini:
        return []
    conds = [or_(models.NormaChunk.testo.ilike(f"%{t}%"),
                 models.NormaChunk.rubrica.ilike(f"%{t}%"),
                 models.NormaChunk.regolamento.ilike(f"%{t}%")) for t in termini]
    rows = (db.query(models.NormaChunk)
              .filter(models.NormaChunk.vigente == True, or_(*conds))  # noqa: E712
              .limit(400).all())  # ampio: un solo documento può avere >150 chunk

    # Scoring per CONFINE DI PAROLA: l'ILIKE è solo un prefiltro grezzo (a
    # sottostringa: «funziona» aggancerebbe «funzionario»). Qui contiamo solo i
    # match a parola intera, per non allegare regolamenti a sproposito.
    pats = [_re.compile(rf"\b{_re.escape(t)}\b") for t in termini]

    def score(r):
        blob = f"{r.regolamento} {r.rubrica or ''} {r.testo}".lower()
        return sum(1 for p in pats if p.search(blob))

    rows.sort(key=score, reverse=True)
    out, visti = [], set()
    for r in rows:
        # Dedup per articolo, MA per i documenti senza articoli (articolo=None,
        # es. PIAO) ogni chunk è distinto: dedup per id, altrimenti collasserebbero
        # tutti in uno solo e i passaggi con il dato cercato andrebbero persi.
        key = (r.regolamentoId, r.articolo) if r.articolo else r.id
        if key in visti or score(r) == 0:
            continue
        visti.add(key)
        rif, titolo = _norma_rif_titolo(r)
        out.append({"rif": rif, "titolo": titolo,
                    "testo": (r.testo or "").strip()[:max_char], "tipo": "normativa"})
        if len(out) >= k:
            break
    return out


def contesto_normativo_ibrido(db, query: str, k: int = 5) -> list[dict]:
    """Lessicale-primario: se i termini della domanda combaciano con un
    regolamento (nomi/sigle come «IMU», «suolo pubblico») usa quei match, che
    sono precisi. Solo se la lessicale è vuota ricade su una semantica MOLTO
    stretta. Evita di allegare regolamenti a caso a domande di piattaforma.
    Usata dall'assistente, dove la precisione delle fonti mostrate è cruciale."""
    lex = norme_lessicali(db, query, k=k)
    if lex:
        return lex[:k]
    # Nessun aggancio lessicale: fallback semantico stretto (o niente).
    return contesto_normativo(db, query, k=k, best_floor=0.27, spread=0.05)


# ---------- RAG normativo: fondazione sui regolamenti dell'ente ----------

# Gate di pertinenza (cosine_distance ∈ [0,2], 0 = identico). I modelli di
# embedding comprimono i testi amministrativi italiani in una regione ristretta,
# quindi una soglia assoluta unica è fragile. Usiamo un gate relativo:
#  - il MIGLIORE match deve stare sotto `best_floor` (altrimenti nulla è davvero
#    pertinente → rifiuto);
#  - si tengono poi solo gli articoli entro `spread` dal migliore.
# Valori di default tarati su nomic-embed-text; la calibrazione fine va fatta con
# il golden set (modulo Calibrazione). Sovrascrivibili per adattarsi a bge-m3 ecc.
NORMA_BEST_FLOOR = 0.33
NORMA_SPREAD = 0.14


def contesto_normativo(db, query: str, k: int = 5, materia: str | None = None,
                       max_char: int = 1400, budget_char: int = 5000,
                       best_floor: float = NORMA_BEST_FLOOR, spread: float = NORMA_SPREAD) -> list[dict]:
    """Recupera fino a k articoli PERTINENTI dal corpus normativo VIGENTE
    (tabella NormaChunk) con gate di pertinenza relativo (vedi costanti sopra).
    È la base autorevole per i riferimenti normativi dell'assistente redazionale.
    Ritorna [] se l'AI/embedding non è disponibile o se nulla è pertinente
    (→ il chiamante deve rifiutarsi di inventare)."""
    query = (query or "").strip()
    if not query:
        return []
    try:
        qv = ai.embed(query)
    except ai.AIUnavailable:
        return []
    if not qv or len(qv) != settings.EMBED_DIM:
        return []
    dist = models.NormaChunk.embedding.cosine_distance(qv)
    q = (db.query(models.NormaChunk, dist.label("dist"))
           .filter(models.NormaChunk.vigente == True,          # noqa: E712
                   models.NormaChunk.embedding.is_not(None)))
    if materia:
        q = q.filter(models.NormaChunk.materia == materia)
    rows = q.order_by(dist).limit(k * 4).all()
    if not rows:
        return []
    best = rows[0][1]
    if best is None or best > best_floor:
        return []  # nemmeno il migliore è pertinente → nessuna base normativa
    cutoff = best + spread
    passaggi, visti, tot = [], set(), 0
    for r, d in rows:
        if d is not None and d > cutoff:
            break  # ordinati per distanza: oltre il margine dal migliore
        # Dedup per articolo; per i documenti senza articoli (articolo=None,
        # es. PIAO) ogni chunk è distinto (dedup per id), altrimenti collasserebbero
        # tutti in uno solo perdendo i passaggi col dato cercato.
        key = (r.regolamentoId, r.articolo) if r.articolo else r.id
        if key in visti:
            continue
        testo = (r.testo or "").strip()[:max_char]
        if not testo:
            continue
        if passaggi and tot + len(testo) > budget_char:
            break
        visti.add(key)
        rif, titolo = _norma_rif_titolo(r)
        passaggi.append({"rif": rif, "titolo": titolo, "testo": testo, "tipo": "normativa",
                         "dist": round(float(d), 3) if d is not None else None})
        tot += len(testo)
        if len(passaggi) >= k:
            break
    return passaggi


def contesto_redazionale(db, query: str, tipo_atto: str | None = None,
                         k_norme: int = 5, k_atti: int = 2,
                         materia: str | None = None,
                         escludi: set[str] | None = None) -> dict:
    """Contesto ibrido per la redazione di un atto:
    - `normativa`: articoli dei regolamenti vigenti (base autorevole);
    - `precedenti`: atti già redatti dall'ente (solo modello di struttura/stile).
    Ritorna {"normativa": [...], "precedenti": [...]}."""
    norme = contesto_normativo(db, query, k=k_norme, materia=materia)
    # Precedenti: riusa l'indice generale, ma tiene solo gli atti.
    escl = set(escludi or set())
    grezzi = contesto_per(db, query, k=k_atti * 4, escludi=escl)
    precedenti = [p for p in grezzi if p["rif"].startswith("atto:")][:k_atti]
    for p in precedenti:
        p["tipo"] = "precedente"
    return {"normativa": norme, "precedenti": precedenti}


def blocco_redazionale(ctx: dict) -> tuple[str, bool]:
    """Costruisce il blocco FONTI per la redazione, con NORMATIVA e ATTI PRECEDENTI
    etichettati distintamente. Ritorna (blocco, ha_base_normativa)."""
    norme = ctx.get("normativa") or []
    prec = ctx.get("precedenti") or []
    parti = []
    for i, p in enumerate(norme):
        parti.append(f"[FONTE NORMATIVA {i + 1} — {p['titolo']} ({p['rif']})]\n{p['testo']}")
    for i, p in enumerate(prec):
        parti.append(f"[ATTO PRECEDENTE {i + 1} — {p['titolo']} ({p['rif']})]\n{p['testo']}")
    return ("\n\n".join(parti), bool(norme))


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
