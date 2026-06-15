"""Storage documenti su MinIO (S3-compatibile). Resiliente: se MinIO non è
raggiungibile le funzioni restituiscono False/None senza far cadere l'app."""
import io

from minio import Minio

from .config import settings

_client = None


def client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(settings.MINIO_ENDPOINT, access_key=settings.MINIO_ACCESS_KEY,
                        secret_key=settings.MINIO_SECRET_KEY, secure=settings.MINIO_SECURE)
    return _client


def ensure_bucket() -> bool:
    try:
        c = client()
        if not c.bucket_exists(settings.MINIO_BUCKET):
            c.make_bucket(settings.MINIO_BUCKET)
        return True
    except Exception:
        return False


def available() -> bool:
    return ensure_bucket()


def put(key: str, data: bytes, content_type: str = "application/octet-stream") -> bool:
    try:
        client().put_object(settings.MINIO_BUCKET, key, io.BytesIO(data), length=len(data), content_type=content_type)
        return True
    except Exception:
        return False


def get(key: str) -> bytes | None:
    try:
        resp = client().get_object(settings.MINIO_BUCKET, key)
        data = resp.read()
        resp.close(); resp.release_conn()
        return data
    except Exception:
        return None
