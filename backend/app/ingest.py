"""Ingestione PEC via IMAP. Configurabile da env (PEC_*). Se non configurata,
sync_pec() è un no-op informativo. Per ogni messaggio non letto crea una
Comunicazione, salva gli allegati su MinIO ed estrae il testo; la classificazione
AI è best-effort (fallback se il server AI non è raggiungibile)."""
import email
import imaplib
import uuid
from datetime import datetime
from email.header import decode_header

from .config import settings
from . import models, storage, parsing
from .ai import client as ai
from .reference import CAT


def pec_configured() -> bool:
    return bool(settings.PEC_HOST and settings.PEC_USER and settings.PEC_PASSWORD)


def _dec(s) -> str:
    if not s:
        return ""
    parts = decode_header(s)
    out = []
    for txt, enc in parts:
        out.append(txt.decode(enc or "utf-8", "ignore") if isinstance(txt, bytes) else txt)
    return "".join(out)


def classify_or_default(oggetto: str, corpo: list[str], allegati: list[dict]) -> dict:
    try:
        r = ai.classifica(oggetto, corpo, allegati)
        r["scadenzaSuggerita"] = None
        r["documentiAttesi"] = r.get("documentiAttesi", [])
        return r
    except ai.AIUnavailable:
        return {"categoria": "istanza_cittadino", "confidenza": 0.0,
                "tipoProcedimento": "", "ufficio": "", "responsabile": None,
                "urgenza": "media", "termineGiorni": 30, "scadenzaSuggerita": None,
                "motivazione": "Classificazione AI non disponibile — da verificare manualmente.",
                "alternative": [], "documentiAttesi": [], "_fonte": "fallback"}


def _next_id(db, prefix: str) -> str:
    n = db.query(models.Comunicazione).filter(models.Comunicazione.id.startswith(prefix)).count()
    return f"{prefix}{n + 1:05d}"


def sync_pec(db) -> dict:
    if not pec_configured():
        return {"configured": False,
                "message": "PEC non configurata. Impostare PEC_HOST, PEC_USER, PEC_PASSWORD nel file .env."}
    nuove, errori = 0, []
    try:
        M = imaplib.IMAP4_SSL(settings.PEC_HOST, settings.PEC_PORT)
        M.login(settings.PEC_USER, settings.PEC_PASSWORD)
        M.select(settings.PEC_FOLDER)
        typ, data = M.search(None, "UNSEEN")
        ids = data[0].split() if data and data[0] else []
        # IDs da marcare SEEN solo dopo commit riuscito (evita perdita dati se crash tra SEEN e commit)
        ids_da_marcare = []
        for num in ids:
            try:
                typ, msgdata = M.fetch(num, "(RFC822)")
                msg = email.message_from_bytes(msgdata[0][1])
                oggetto = _dec(msg.get("Subject")) or "(senza oggetto)"
                mittente = _dec(msg.get("From"))
                corpo, allegati = [], []
                for part in msg.walk():
                    cd = str(part.get("Content-Disposition") or "")
                    ctype = part.get_content_type()
                    if part.is_multipart():
                        continue
                    if "attachment" in cd or part.get_filename():
                        fname = _dec(part.get_filename()) or "allegato"
                        payload = part.get_payload(decode=True) or b""
                        key = f"pec/{uuid.uuid4().hex}/{fname}"
                        stored = storage.put(key, payload, ctype)
                        ext = parsing.extract_text(fname, ctype, payload)
                        allegati.append({"nome": fname, "tipo": (fname.split(".")[-1].upper() if "." in fname else "FILE"),
                                         "size": f"{len(payload)//1024} KB"})
                        db.add(models.Documento(id=uuid.uuid4().hex, filename=fname, contentType=ctype,
                                                size=len(payload), objectKey=key if stored else None,
                                                ocr=ext.get("ocr", False), chars=len(ext.get("text", "")),
                                                stato="eccezione" if ext.get("error") else "acquisito",
                                                errore=ext.get("error"), creato=datetime.now().isoformat(),
                                                testo=ext.get("text", "")))
                        if ext.get("text"):
                            corpo.append(ext["text"][:1500])
                    elif ctype == "text/plain":
                        try:
                            corpo.append((part.get_payload(decode=True) or b"").decode("utf-8", "ignore").strip()[:1500])
                        except Exception:
                            pass
                ai_res = classify_or_default(oggetto, corpo, allegati)
                cid = _next_id(db, "PEC-2026-")
                db.add(models.Comunicazione(id=cid, canale="PEC", letto=False, urgente=ai_res.get("urgenza") == "urgente",
                                            arrivo=datetime.now().isoformat(), mittente={"nome": mittente, "pec": "", "tipo": "PEC"},
                                            oggetto=oggetto, corpo=[c for c in corpo if c], allegati=allegati, ai=ai_res, pratica=None))
                ids_da_marcare.append(num)
                nuove += 1
            except Exception as e:
                errori.append(str(e))
        # Commit prima di marcare SEEN: se il commit fallisce le email restano UNSEEN e vengono reingerite
        db.commit()
        for num in ids_da_marcare:
            try:
                M.store(num, "+FLAGS", "\\Seen")
            except Exception:
                pass
        M.logout()
        return {"configured": True, "nuove": nuove, "errori": errori}
    except Exception as e:
        return {"configured": True, "nuove": nuove, "errore_connessione": str(e), "errori": errori}
