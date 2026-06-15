"""Task Celery: polling PEC automatico, embeddings in background."""
import logging

from .celery_app import celery
from .db import SessionLocal
from . import ingest, search

log = logging.getLogger("trasparentia.tasks")


@celery.task(name="app.tasks.poll_pec", bind=True, max_retries=3, default_retry_delay=60)
def poll_pec(self):
    """Polling automatico casella PEC. Schedulato via Celery Beat ogni N minuti.
    È idempotente: legge solo messaggi non letti e usa UUID come deduplication key."""
    if not ingest.pec_configured():
        return {"skipped": True, "reason": "PEC non configurata"}
    db = SessionLocal()
    try:
        res = ingest.sync_pec(db)
        if res.get("nuove"):
            try:
                search.reindex(db)
                search.embed_pending(db)
            except Exception as e:
                log.warning("embed_pending fallito dopo PEC sync: %s", e)
        log.info("PEC poll completato: %s", res)
        return res
    except Exception as exc:
        log.error("Errore poll PEC: %s", exc)
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery.task(name="app.tasks.run_embed_pending")
def run_embed_pending():
    """Genera embedding pendenti su pgvector. Schedulato ogni 5 minuti via Beat."""
    db = SessionLocal()
    try:
        n = search.embed_pending(db)
        if n:
            log.info("Embedding generati: %d", n)
        return {"embedding_generati": n}
    except Exception as e:
        log.warning("embed_pending errore: %s", e)
        return {"error": str(e)}
    finally:
        db.close()
