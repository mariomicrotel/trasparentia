"""Scraping delle pubblicazioni dell'Albo Pretorio / sezione "novità" del sito
istituzionale, per tenere aggiornato l'indice di ricerca senza intervento manuale.

Progettato per piattaforme Halley EG (molto diffuse nei Comuni italiani), che
pubblicano avvisi/delibere/atti come pagine sequenziali (es. "novita_123.html")
e servono l'allegato tramite una funzione JS non standard ("SCHIOCCIOLA"): una
POST con un body pseudo-multipart che risponde con un JSON {"PATH": "..."} da
cui scaricare il file vero. Il protocollo è stato verificato manualmente sul
sito del Comune (richiesta esplicita dell'utente, dato pubblico) — cfr. schiocciola.js
sul sito stesso per la definizione originale.

Se la pagina non espone questo pattern (altra piattaforma), i metadati vengono
comunque indicizzati; l'allegato viene semplicemente saltato (nessun errore).

Le pubblicazioni recuperate NON sono fonti normative: vanno in AttoAlbo e
nell'Indice generale (refTipo="albo_pretorio") come riferimento/precedente,
mai in NormaChunk (riservato ai regolamenti vigenti su cui l'assistente fonda
la redazione)."""
import hashlib
import html
import logging
import re
from datetime import date
from urllib.parse import urljoin, urlparse

import httpx

from . import models, parsing, search
from .config import settings

log = logging.getLogger("trasparentia.albo_scraper")

_TIMEOUT = 12
_UA = "Mozilla/5.0 (compatible; TrasParentIA/1.0; +trasparenza amministrativa)"

# Nota: sul sito osservato i link all'elenco NON sono in tag <a> ma in <button
# href="...">  (markup non standard di questo template). Si cattura quindi solo
# l'attributo href, indipendentemente dal tag che lo contiene; il titolo reale
# viene comunque estratto dalla pagina di dettaglio (h1#titolo_social).
# Il path DEVE contenere "/novita/" (il modulo "novità"/pubblicazioni di Halley):
# lo stesso template usa la stessa numerazione "_N.html" anche per pagine
# organizzative (uffici, organi di governo, servizi...) che NON sono
# pubblicazioni e vanno escluse.
_LINK_RE = re.compile(r'href="([^"]*/novita/[^"]+_\d+\.html)"', re.IGNORECASE)
_TITOLO_RE = re.compile(r'<h1[^>]*id="titolo_social"[^>]*>([^<]*)</h1>', re.IGNORECASE)
_TITOLO_FALLBACK_RE = re.compile(r"<title>([^<]*)</title>", re.IGNORECASE)
_DATA_INI_RE = re.compile(r"data_inizio_pubb\s*:\s*['\"]?([\d/-]+)")
_DATA_FINE_RE = re.compile(r"data_fine_pubb\s*:\s*['\"]?([\d/-]+)")
_SCHIOCCIOLA_RE = re.compile(r"SCHIOCCIOLA\(\s*'([^']*)'")


def _slug(url: str) -> str:
    """Id stabile per una pagina, derivato dal suo path (indipendente da titolo)."""
    path = urlparse(url).path
    h = hashlib.sha1(path.encode()).hexdigest()[:16]
    tail = re.sub(r"[^a-zA-Z0-9]+", "_", path.rsplit("/", 1)[-1]).strip("_").lower()
    return f"albo_{tail or 'na'}_{h}"


def discover_links(listing_url: str, http: httpx.Client) -> list[dict]:
    """Estrae dalla pagina di elenco i link alle pubblicazioni (pattern
    «..._<numero>.html», tipico dei moduli "novità" Halley). Deduplica per URL."""
    r = http.get(listing_url, headers={"User-Agent": _UA}, timeout=_TIMEOUT)
    r.raise_for_status()
    visti, out = set(), []
    for m in _LINK_RE.finditer(r.text):
        url = urljoin(listing_url, m.group(1))
        if url in visti:
            continue
        visti.add(url)
        out.append({"url": url})
    return out


def _estrai_pagina(html_testo: str) -> dict:
    tm = _TITOLO_RE.search(html_testo) or _TITOLO_FALLBACK_RE.search(html_testo)
    titolo = html.unescape(tm.group(1).strip()) if tm and tm.group(1).strip() else "Pubblicazione senza titolo"
    dini = _DATA_INI_RE.search(html_testo)
    dfine = _DATA_FINE_RE.search(html_testo)
    sch = _SCHIOCCIOLA_RE.search(html_testo)
    return {
        "titolo": titolo,
        "data_pubblicazione": (dini.group(1).strip() if dini and dini.group(1).strip() else None),
        "data_scadenza": (dfine.group(1).strip() if dfine and dfine.group(1).strip() else None),
        "valmessa": sch.group(1) if sch else None,
    }


def _scarica_allegato(base_url: str, valmessa: str, http: httpx.Client) -> tuple[str, bytes] | None:
    """Replica il protocollo SCHIOCCIOLA (POST pseudo-multipart → JSON {PATH} →
    GET del file). Ritorna (filename, bytes) o None se non disponibile/fallisce."""
    try:
        parsed = urlparse(base_url)
        host = parsed.netloc
        protocollo = parsed.scheme
        boundary = "AZazAZ"
        body = (
            f"--{boundary}\r\n"
            f'&name="protocollo={protocollo}&ser={host}&{valmessa}&PAGINA="\r\n\n'
            f"\r\n--{boundary}--\r\n"
        )
        r = http.post(
            f"{protocollo}://{host}/EG0/EGDOCVISJS.HBL",
            content=body.encode("utf-8"),
            headers={"User-Agent": _UA,
                     "Content-Type": f"text/plain;charset=UTF-8; boundary={boundary}"},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        data = r.json()
        path = data.get("PATH")
        if not path:
            return None
        rf = http.get(path, headers={"User-Agent": _UA}, timeout=_TIMEOUT)
        rf.raise_for_status()
        filename = path.rsplit("/", 1)[-1]
        return filename, rf.content
    except Exception as e:
        log.debug("Allegato non recuperato (%s): %s", base_url, e)
        return None


def sync(db, listing_url: str | None = None, max_items: int | None = None) -> dict:
    """Sincronizza le pubblicazioni: scopre i link, aggiorna solo quelli nuovi o
    cambiati (hash del contenuto), estrae testo dell'allegato se disponibile,
    indicizza nell'Indice generale. Limita il lavoro per run (max_items) per
    restare rispettosi verso il server del Comune e dentro i limiti di tempo
    del task Celery."""
    listing_url = (listing_url or settings.ALBO_SCRAPE_URL or "").strip()
    if not listing_url:
        return {"skipped": True, "reason": "ALBO_SCRAPE_URL non configurato"}
    max_items = max_items or settings.ALBO_SCRAPE_MAX_ITEMS

    nuovi = aggiornati = invariati = errori = 0
    with httpx.Client(follow_redirects=True) as http:
        try:
            link = discover_links(listing_url, http)
        except Exception as e:
            return {"ok": False, "errore": f"Impossibile leggere l'elenco: {e}"}

        elaborati = 0
        for l in link:
            if elaborati >= max_items:
                break
            url = l["url"]
            aid = _slug(url)
            elaborati += 1  # conta ogni richiesta HTTP fatta, non solo le novità:
            # il cap deve limitare il carico sul server del Comune e il tempo del
            # task, non il numero di cambiamenti trovati.
            try:
                rp = http.get(url, headers={"User-Agent": _UA}, timeout=_TIMEOUT)
                rp.raise_for_status()
                pagina_html = rp.text
                content_hash = hashlib.sha1(pagina_html.encode("utf-8", "ignore")).hexdigest()

                esistente = db.get(models.AttoAlbo, aid)
                if esistente and esistente.hashContenuto == content_hash:
                    invariati += 1
                    continue  # pagina non cambiata dall'ultima sincronizzazione

                meta = _estrai_pagina(pagina_html)
                testo = ""
                if meta["valmessa"]:
                    allegato = _scarica_allegato(url, meta["valmessa"], http)
                    if allegato:
                        fname, raw = allegato
                        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "pdf"
                        estratto = parsing.extract_text(fname, f"application/{ext}", raw)
                        testo = estratto.get("text", "")

                oggi = date.today().isoformat()
                if esistente:
                    esistente.titolo = meta["titolo"]
                    esistente.dataPubblicazione = meta["data_pubblicazione"]
                    esistente.dataScadenza = meta["data_scadenza"]
                    esistente.testo = testo
                    esistente.hashContenuto = content_hash
                    esistente.aggiornato = oggi
                    aggiornati += 1
                else:
                    db.add(models.AttoAlbo(
                        id=aid, titolo=meta["titolo"], urlPagina=url,
                        dataPubblicazione=meta["data_pubblicazione"],
                        dataScadenza=meta["data_scadenza"], testo=testo,
                        hashContenuto=content_hash, creato=oggi, aggiornato=oggi,
                    ))
                    nuovi += 1
                db.commit()

                # Indicizzazione best-effort: il testo (o solo il titolo se
                # l'allegato non è stato recuperato) entra nella ricerca generale.
                search.index_one(db, "albo_pretorio", aid, meta["titolo"], testo or meta["titolo"])
            except Exception as e:
                errori += 1
                log.warning("Errore su %s: %s", url, e)
                db.rollback()

    return {"ok": True, "trovati": len(link), "nuovi": nuovi, "aggiornati": aggiornati,
            "invariati": invariati, "errori": errori}


def stato(db) -> dict:
    tot = db.query(models.AttoAlbo).count()
    ultimo = (db.query(models.AttoAlbo.aggiornato)
                .order_by(models.AttoAlbo.aggiornato.desc()).limit(1).scalar())
    return {"totale": tot, "ultimaSincronizzazione": ultimo,
            "configurato": bool(settings.ALBO_SCRAPE_URL), "abilitato": settings.ALBO_SCRAPE_ENABLED}
