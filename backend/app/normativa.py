"""Corpus normativo dell'ente: ingestione di regolamenti/delibere/statuti e
loro indicizzazione per ARTICOLO. È la base di conoscenza su cui l'assistente
redazionale fonda i riferimenti normativi (retrieval in `search.contesto_normativo`).

Il chunking è per articolo quando la struttura è riconoscibile (Art. N), con
fallback a finestra fissa per testi non strutturati. Ogni chunk porta i metadati
(regolamento, articolo, rubrica, materia, vigenza) che rendono possibili citazioni
precise ("art. 12 del Regolamento edilizio") e il filtro sulle norme vigenti."""
import re
import unicodedata
from datetime import date

from . import models
from .ai import client as ai
from .config import settings
from .search import _chunk  # riuso del chunker a finestra per il fallback

# Intestazione di articolo: "Art. 12", "Articolo 12", "ART. 12-bis", con
# eventuale rubrica sulla stessa riga dopo un separatore (— : . -).
_ART_RE = re.compile(
    r"(?im)^[ \t]*art(?:icolo)?[\.\s]+"
    r"(\d+(?:[\-\s]?(?:bis|ter|quater|quinquies|sexies))?)"
    r"\b[ \t]*[\.\)\-–—:]*[ \t]*(.*)$"
)

_MAX_ART_CHARS = 1800  # oltre questa soglia l'articolo viene sotto-chunkato


def _slug(s: str, maxlen: int = 40) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "_", s).strip("_").lower()
    return (s or "regolamento")[:maxlen]


def parse_articoli(testo: str) -> list[dict]:
    """Spezza il testo in articoli. Ritorna [{articolo, rubrica, testo}].
    Se non riconosce alcun articolo, ritorna un solo blocco con articolo=None
    (il chiamante applicherà il chunking a finestra)."""
    testo = (testo or "").strip()
    if not testo:
        return []
    matches = list(_ART_RE.finditer(testo))
    if not matches:
        return [{"articolo": None, "rubrica": None, "testo": testo}]

    articoli: list[dict] = []
    # Preambolo prima del primo articolo (di norma intestazione/indice): scartato.
    for i, m in enumerate(matches):
        num = re.sub(r"\s+", "-", m.group(1).strip().lower())
        rubrica = (m.group(2) or "").strip(" .:-–—") or None
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(testo)
        corpo = testo[start:end].strip()
        # Se la rubrica non era sulla stessa riga, prova a prenderla dalla prima riga del corpo.
        if not rubrica and corpo:
            prima, _, resto = corpo.partition("\n")
            if 0 < len(prima) <= 90 and not prima.endswith("."):
                rubrica, corpo = prima.strip(), resto.strip()
        if corpo:
            articoli.append({"articolo": num, "rubrica": rubrica, "testo": corpo})
    return articoli or [{"articolo": None, "rubrica": None, "testo": testo}]


def _chunks_per_articolo(art: dict) -> list[str]:
    testo = art["testo"]
    if len(testo) <= _MAX_ART_CHARS:
        return [testo]
    return _chunk(testo)  # articolo lungo: sotto-chunk a finestra con overlap


def _embed_norma_pending(db, limit: int = 2000) -> int:
    pend = (db.query(models.NormaChunk)
              .filter(models.NormaChunk.embedding.is_(None))
              .limit(limit).all())
    done = 0
    for row in pend:
        testo = f"{row.regolamento} — art. {row.articolo or '?'} {row.rubrica or ''}\n{row.testo}"
        try:
            v = ai.embed(testo[:4000])
        except ai.AIUnavailable:
            break  # AI offline: riprovabile più tardi
        if v and len(v) == settings.EMBED_DIM:
            row.embedding = v
            done += 1
    if done:
        db.commit()
    return done


def ingest(db, titolo: str, testo: str, materia: str | None = None,
           fonte: str | None = None, reg_id: str | None = None) -> dict:
    """Crea/aggiorna un Regolamento e i suoi NormaChunk (uno per articolo), poi
    genera gli embedding best-effort. Idempotente su reg_id: rimpiazza i chunk."""
    titolo = (titolo or "").strip() or "Regolamento senza titolo"
    reg_id = reg_id or _slug(titolo)
    oggi = date.today().isoformat()

    articoli = parse_articoli(testo)
    if not articoli:
        raise ValueError("Nessun testo estraibile dalla fonte")

    # Rimpiazza eventuali chunk esistenti di questo regolamento.
    db.query(models.NormaChunk).filter(
        models.NormaChunk.regolamentoId == reg_id
    ).delete(synchronize_session=False)

    reg = db.get(models.Regolamento, reg_id)
    if reg is None:
        reg = models.Regolamento(id=reg_id, titolo=titolo, materia=materia,
                                 fonte=fonte, vigente=True, creato=oggi, aggiornato=oggi)
        db.add(reg)
    else:
        reg.titolo, reg.materia, reg.aggiornato = titolo, materia or reg.materia, oggi
        if fonte:
            reg.fonte = fonte

    n_chunk = 0
    for art in articoli:
        for i, pezzo in enumerate(_chunks_per_articolo(art)):
            cid = f"{reg_id}:art_{art['articolo'] or 'na'}#{i}"
            db.add(models.NormaChunk(
                id=cid, regolamentoId=reg_id, regolamento=titolo,
                articolo=art["articolo"], rubrica=art["rubrica"],
                materia=materia, vigente=True, testo=pezzo,
            ))
            n_chunk += 1

    reg.nArticoli = sum(1 for a in articoli if a["articolo"])
    db.commit()

    embeddati = 0
    try:
        embeddati = _embed_norma_pending(db)
    except Exception:
        pass

    return {"regolamentoId": reg_id, "titolo": titolo, "articoli": reg.nArticoli,
            "chunk": n_chunk, "embeddati": embeddati}


def set_vigente(db, reg_id: str, vigente: bool) -> bool:
    reg = db.get(models.Regolamento, reg_id)
    if not reg:
        return False
    reg.vigente = vigente
    reg.aggiornato = date.today().isoformat()
    # I chunk seguono la vigenza del regolamento (usati nel filtro di retrieval).
    db.query(models.NormaChunk).filter(
        models.NormaChunk.regolamentoId == reg_id
    ).update({models.NormaChunk.vigente: vigente}, synchronize_session=False)
    db.commit()
    return True


def elimina(db, reg_id: str) -> bool:
    reg = db.get(models.Regolamento, reg_id)
    if not reg:
        return False
    db.query(models.NormaChunk).filter(
        models.NormaChunk.regolamentoId == reg_id
    ).delete(synchronize_session=False)
    db.delete(reg)
    db.commit()
    return True


def lista(db) -> list[dict]:
    out = []
    for r in db.query(models.Regolamento).order_by(models.Regolamento.titolo).all():
        emb = (db.query(models.NormaChunk)
                 .filter(models.NormaChunk.regolamentoId == r.id,
                         models.NormaChunk.embedding.is_not(None)).count())
        tot = db.query(models.NormaChunk).filter(models.NormaChunk.regolamentoId == r.id).count()
        out.append({**r.dict(), "chunk": tot, "conEmbedding": emb})
    return out


def embed_pending(db, limit: int = 2000) -> int:
    """Esposto per rigenerare gli embedding mancanti (es. dopo che l'AI torna online)."""
    return _embed_norma_pending(db, limit)


def status(db) -> dict:
    tot = db.query(models.NormaChunk).count()
    emb = db.query(models.NormaChunk).filter(models.NormaChunk.embedding.is_not(None)).count()
    regs = db.query(models.Regolamento).count()
    vig = db.query(models.Regolamento).filter(models.Regolamento.vigente == True).count()  # noqa: E712
    return {"regolamenti": regs, "vigenti": vig, "chunk": tot, "conEmbedding": emb,
            "semanticaPronta": emb > 0}
