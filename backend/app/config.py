"""Configurazione applicativa (da variabili d'ambiente)."""
import os


class Settings:
    # Database: Postgres in Docker, SQLite per sviluppo/verifica rapida
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./trasparentia.db")

    # Server AI on-prem (Ollama). In Docker il default punta all'host.
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")  # header X-API-Key verso il reverse proxy
    AI_MODEL_GEN: str = os.getenv("AI_MODEL_GEN", "qwen2.5:7b-instruct")
    AI_MODEL_EMBED: str = os.getenv("AI_MODEL_EMBED", "nomic-embed-text")
    # Modello dedicato alla redazione/revisione degli atti (editor). Default: AI_MODEL_GEN.
    # Consigliato: qwen2.5:14b-instruct su GPU ≥12 GB per qualità superiore sul testo formale.
    AI_MODEL_DRAFT: str = os.getenv("AI_MODEL_DRAFT", "")
    AI_TIMEOUT: float = float(os.getenv("AI_TIMEOUT", "180"))
    AI_TLS_VERIFY: bool = os.getenv("AI_TLS_VERIFY", "true").lower() == "true"

    # Storage documenti (MinIO, S3-compatibile)
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "minio:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "trasparentia")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "trasparentia")
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "trasparentia")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"

    # Ingestione PEC (IMAP). Vuoto = non configurata (sync no-op).
    PEC_HOST: str = os.getenv("PEC_HOST", "")
    PEC_PORT: int = int(os.getenv("PEC_PORT", "993"))
    PEC_USER: str = os.getenv("PEC_USER", "")
    PEC_PASSWORD: str = os.getenv("PEC_PASSWORD", "")
    PEC_FOLDER: str = os.getenv("PEC_FOLDER", "INBOX")

    OCR_ENABLED: bool = os.getenv("OCR_ENABLED", "true").lower() == "true"

    # Ricerca semantica: dimensione embedding (nomic-embed-text=768, bge-m3=1024)
    EMBED_DIM: int = int(os.getenv("EMBED_DIM", "768"))

    # Ente di riferimento per il seed (personalizzabile)
    ENTE_NOME: str = os.getenv("ENTE_NOME", "Comune di Roccadaspide")

    # Autenticazione Keycloak (Fase 7). Default: disabilitata (usa X-Role per demo).
    KC_AUTH_ENABLED: bool = os.getenv("KC_AUTH_ENABLED", "false").lower() == "true"
    KC_INTERNAL_URL: str = os.getenv("KC_INTERNAL_URL", "http://keycloak:8080")
    KC_REALM: str = os.getenv("KC_REALM", "trasparentia")
    KC_CLIENT_ID: str = os.getenv("KC_CLIENT_ID", "trasparentia-app")
    KC_PUBLIC_URL: str = os.getenv("KC_PUBLIC_URL", "http://localhost:8090")

    # Motore promemoria scadenze (Fase 6)
    NOTIFICHE_ENABLED: bool = os.getenv("NOTIFICHE_ENABLED", "true").lower() == "true"
    PROMEMORIA_SOGLIE: list[int] = [int(x) for x in os.getenv("PROMEMORIA_SOGLIE", "7,3,1").split(",")]
    SCHEDULER_INTERVAL_HOURS: int = int(os.getenv("SCHEDULER_INTERVAL_HOURS", "6"))

    # Posta in uscita SMTP/PEC (Fase 3+7). Vuoto = non configurata.
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "true").lower() == "true"
    # Invio email dei promemoria (opt-in: richiede SMTP configurato)
    NOTIFICHE_EMAIL_ENABLED: bool = os.getenv("NOTIFICHE_EMAIL_ENABLED", "false").lower() == "true"

    # Backup database (Fase 7)
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "/data/backup")

    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:4173"
    ).split(",")

    # Coda asincrona (Redis + Celery). Usata dal worker e da Celery Beat.
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    # Intervallo polling PEC automatico via Celery Beat (minuti)
    PEC_POLL_INTERVAL_MINUTES: int = int(os.getenv("PEC_POLL_INTERVAL_MINUTES", "10"))

    # Soglia di confidenza AI sotto la quale la classificazione è marcata a bassa certezza
    # (0.0–1.0). Usata dalla Procedura di Sorveglianza Umana (P3).
    SOGLIA_CONFIDENZA_BASSA: float = float(os.getenv("SOGLIA_CONFIDENZA_BASSA", "0.60"))

    # Integrazione sistemi documentali comunali esistenti (opzionale)
    # Se vuoti: TrasParentIA usa numerazione interna e non spinge all'esterno.
    ALBO_ESTERNO_URL: str = os.getenv("ALBO_ESTERNO_URL", "")
    ALBO_ESTERNO_API_KEY: str = os.getenv("ALBO_ESTERNO_API_KEY", "")
    PROTOCOLLO_ESTERNO_URL: str = os.getenv("PROTOCOLLO_ESTERNO_URL", "")
    PROTOCOLLO_ESTERNO_API_KEY: str = os.getenv("PROTOCOLLO_ESTERNO_API_KEY", "")


settings = Settings()


def apply_overrides(overrides: dict) -> None:
    """Applica sovrascritture runtime al settings object (da DB o API)."""
    for key, raw in overrides.items():
        if not hasattr(settings, key):
            continue
        current = getattr(settings, key)
        if isinstance(current, bool):
            setattr(settings, key, str(raw).lower() in ("true", "1", "yes"))
        elif isinstance(current, int):
            try:
                setattr(settings, key, int(raw))
            except (ValueError, TypeError):
                pass
        elif isinstance(current, float):
            try:
                setattr(settings, key, float(raw))
            except (ValueError, TypeError):
                pass
        else:
            setattr(settings, key, "" if raw is None else str(raw))
