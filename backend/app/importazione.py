"""Importazione massiva documenti storici (Fase 8).
Gestisce lotti di upload, parsing testo, classificazione AI e creazione comunicazioni."""
import uuid
from datetime import date
from . import models, storage, parsing
from .ai import client as ai
from .reference import CAT


def _sid() -> str:
    return str(uuid.uuid4())[:8]


def crea_lotto(db, nome: str, creatore: str) -> models.LottoImport:
    lotto = models.LottoImport(
        id=_sid(),
        nome=nome or f"Importazione {date.today().isoformat()}",
        creato=date.today().isoformat(),
        creatore=creatore,
    )
    db.add(lotto)
    db.commit()
    db.refresh(lotto)
    return lotto


def aggiungi_item(db, lotto_id: str, filename: str, content_type: str,
                  file_bytes: bytes) -> models.ItemImport:
    """Salva il file su MinIO, estrae il testo, crea un ItemImport in_coda."""
    # Storage
    object_key = f"import/{lotto_id}/{_sid()}_{filename}"
    try:
        storage.put(object_key, file_bytes, content_type)
    except Exception:
        object_key = None

    # Estrazione testo
    testo = ""
    try:
        result = parsing.extract_text(filename, content_type, file_bytes)
        testo = result.get("text", "") or ""
    except Exception:
        pass

    item = models.ItemImport(
        id="I" + _sid(),
        lottoId=lotto_id,
        filename=filename,
        contentType=content_type,
        testo=testo[:20_000],
        objectKey=object_key,
        stato="in_coda",
        creato=date.today().isoformat(),
    )
    db.add(item)

    lotto = db.query(models.LottoImport).filter(models.LottoImport.id == lotto_id).first()
    if lotto:
        lotto.totale += 1
    db.commit()
    db.refresh(item)
    return item


def classifica_item(db, item: models.ItemImport) -> models.ItemImport:
    """Classifica un singolo item tramite AI e aggiorna stato → classificato."""
    stato_precedente = item.stato

    if not item.testo.strip():
        item.ai = {
            "categoria": "istanza_cittadino", "confidenza": 0.0,
            "motivazione": "Nessun testo estratto dal documento.",
            "_fonte": "fallback",
        }
    else:
        try:
            nome_senza_ext = item.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ")
            result = ai.classifica(nome_senza_ext, [item.testo[:3000]], [])
            item.ai = result
        except ai.AIUnavailable:
            item.ai = {
                "categoria": "istanza_cittadino", "confidenza": 0.0,
                "motivazione": "Server AI non raggiungibile — classificazione manuale richiesta.",
                "_fonte": "fallback",
            }
        except Exception as exc:
            item.ai = {
                "categoria": "istanza_cittadino", "confidenza": 0.0,
                "motivazione": f"Errore classificazione: {exc}",
                "_fonte": "errore",
            }

    item.stato = "classificato"
    # Incrementa solo se era in_coda (evita desync su ri-classificazione)
    if stato_precedente == "in_coda":
        lotto = db.query(models.LottoImport).filter(models.LottoImport.id == item.lottoId).first()
        if lotto:
            lotto.classificati += 1
    db.commit()
    db.refresh(item)
    return item


def applica_item(db, item: models.ItemImport, creatore: str,
                 override: dict | None = None) -> models.Comunicazione:
    """Crea una Comunicazione a partire dall'item e lo segna come applicato."""
    if item.stato == "applicato":
        raise ValueError("Item già applicato")
    stato_precedente = item.stato

    ai_data = override or item.ai or {}
    nome_base = item.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ")

    com = models.Comunicazione(
        id="IMP" + _sid(),
        canale="Importazione",
        letto=False,
        urgente=(ai_data.get("urgenza", "media") in ("alta", "urgente")),
        arrivo=item.creato,
        mittente={"nome": "(importazione massiva)", "email": "", "tipo": "import"},
        oggetto=nome_base,
        corpo=[{"tipo": "testo", "valore": item.testo[:5000]}] if item.testo else [],
        allegati=[{
            "nome": item.filename,
            "tipo": item.contentType,
            "size": 0,
            "objectKey": item.objectKey,
            "id": "A" + item.id,
        }] if item.objectKey else [],
        ai=ai_data,
        pratica=None,
    )
    db.add(com)

    item.stato = "applicato"
    item.comId = com.id

    lotto = db.query(models.LottoImport).filter(models.LottoImport.id == item.lottoId).first()
    if lotto:
        lotto.applicati += 1
        # Il classificato non è più "in attesa": correggi il contatore
        if stato_precedente == "classificato":
            lotto.classificati = max(0, lotto.classificati - 1)

    db.commit()
    return com


def scarta_item(db, item: models.ItemImport, nota: str = "") -> models.ItemImport:
    stato_precedente = item.stato
    item.stato = "scartato"
    item.note = nota

    lotto = db.query(models.LottoImport).filter(models.LottoImport.id == item.lottoId).first()
    if lotto:
        lotto.scartati += 1
        if stato_precedente == "classificato":
            lotto.classificati = max(0, lotto.classificati - 1)

    db.commit()
    db.refresh(item)
    return item


def chiudi_lotto(db, lotto: models.LottoImport) -> models.LottoImport:
    lotto.stato = "completato"
    db.commit()
    db.refresh(lotto)
    return lotto
