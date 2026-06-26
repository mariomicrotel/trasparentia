"""Istanza Celery condivisa da backend e worker container."""
from celery import Celery
from .config import settings

celery = Celery(
    "trasparentia",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Rome",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    # Limiti di tempo: evitano task bloccati (IMAP hung, AI timeout non gestito, ecc.)
    task_soft_time_limit=270,   # SoftTimeLimitExceeded → il task può fare cleanup
    task_time_limit=300,        # SIGKILL dopo 5 min (hard kill assoluto)
    beat_schedule={
        "poll-pec": {
            "task": "app.tasks.poll_pec",
            "schedule": settings.PEC_POLL_INTERVAL_MINUTES * 60,
            "options": {"expires": settings.PEC_POLL_INTERVAL_MINUTES * 60 - 5},
        },
        "embed-pending": {
            "task": "app.tasks.run_embed_pending",
            "schedule": 300,
            "options": {"expires": 295},
        },
    },
)
