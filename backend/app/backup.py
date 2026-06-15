"""Backup del database (Fase 7). Postgres → pg_dump; SQLite → copia file.
I backup restano on-prem nella cartella BACKUP_DIR (volume Docker)."""
import os
import re
import shutil
import subprocess
from datetime import datetime
from urllib.parse import urlparse

from .config import settings


def _backup_dir() -> str:
    os.makedirs(settings.BACKUP_DIR, exist_ok=True)
    return settings.BACKUP_DIR


def _stamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def _pg_params() -> dict:
    """Estrae host/porta/db/utente/password dalla DATABASE_URL SQLAlchemy."""
    url = re.sub(r"\+psycopg2", "", settings.DATABASE_URL)
    p = urlparse(url)
    return {"host": p.hostname or "db", "port": str(p.port or 5432),
            "db": (p.path or "/trasparentia").lstrip("/"),
            "user": p.username or "trasparentia", "password": p.password or ""}


def esegui() -> dict:
    """Esegue un backup. Ritorna {ok, file, size, detail}."""
    bdir = _backup_dir()
    try:
        if settings.DATABASE_URL.startswith("sqlite"):
            src = settings.DATABASE_URL.replace("sqlite:///", "").replace("sqlite://", "")
            if not os.path.exists(src):
                return {"ok": False, "detail": f"File SQLite non trovato: {src}"}
            dest = os.path.join(bdir, f"trasparentia-{_stamp()}.db")
            shutil.copy2(src, dest)
            return {"ok": True, "file": os.path.basename(dest),
                    "size": os.path.getsize(dest), "detail": "Copia SQLite completata."}

        pg = _pg_params()
        dest = os.path.join(bdir, f"trasparentia-{_stamp()}.sql.gz")
        env = {**os.environ, "PGPASSWORD": pg["password"]}
        with open(dest, "wb") as out:
            dump = subprocess.Popen(
                ["pg_dump", "-h", pg["host"], "-p", pg["port"], "-U", pg["user"], pg["db"]],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
            gz = subprocess.Popen(["gzip"], stdin=dump.stdout, stdout=out)
            dump.stdout.close()
            _, err = dump.communicate()
            gz.communicate()
            if dump.returncode != 0:
                if os.path.exists(dest):
                    os.remove(dest)
                return {"ok": False, "detail": f"pg_dump fallito: {err.decode('utf-8', 'ignore')[:300]}"}
        return {"ok": True, "file": os.path.basename(dest),
                "size": os.path.getsize(dest), "detail": "Backup PostgreSQL (pg_dump) completato."}
    except FileNotFoundError:
        return {"ok": False, "detail": "pg_dump non disponibile nel container. Verificare l'immagine backend."}
    except Exception as e:
        return {"ok": False, "detail": f"Errore backup: {e}"}


def elenco() -> list[dict]:
    """Elenco dei backup presenti, dal più recente."""
    bdir = _backup_dir()
    items = []
    for name in os.listdir(bdir):
        path = os.path.join(bdir, name)
        if os.path.isfile(path):
            st = os.stat(path)
            items.append({"file": name, "size": st.st_size,
                          "creato": datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds")})
    items.sort(key=lambda x: x["creato"], reverse=True)
    return items


def ripristina(filename: str) -> dict:
    """Ripristina il database da un file di backup (.sql.gz per PG, .db per SQLite).
    ATTENZIONE: operazione distruttiva — sovrascrive il database corrente."""
    bdir = _backup_dir()
    # Valida il nome file: solo caratteri alfanumerici, trattini, underscore, punto
    if not re.fullmatch(r"[\w.\-]+", filename):
        return {"ok": False, "detail": "Nome file non valido"}
    path = os.path.join(bdir, filename)
    if not os.path.exists(path):
        return {"ok": False, "detail": "File di backup non trovato"}
    # Impedisce path traversal
    if not os.path.abspath(path).startswith(os.path.abspath(bdir)):
        return {"ok": False, "detail": "Percorso non consentito"}

    try:
        if filename.endswith(".db"):
            # SQLite: sovrascrive il file corrente
            src = settings.DATABASE_URL.replace("sqlite:///", "").replace("sqlite://", "")
            shutil.copy2(path, src)
            return {"ok": True, "detail": "Database SQLite ripristinato. Riavviare il backend."}

        if filename.endswith(".sql.gz"):
            pg = _pg_params()
            env = {**os.environ, "PGPASSWORD": pg["password"]}
            # psql su Postgres: decomprime e applica
            gunzip = subprocess.Popen(["gunzip", "-c", path], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            psql = subprocess.Popen(
                ["psql", "-h", pg["host"], "-p", pg["port"], "-U", pg["user"], pg["db"]],
                stdin=gunzip.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
            gunzip.stdout.close()
            _, err = psql.communicate()
            gunzip.wait()
            if psql.returncode != 0:
                return {"ok": False, "detail": f"psql fallito: {err.decode('utf-8', 'ignore')[:400]}"}
            return {"ok": True, "detail": "Database PostgreSQL ripristinato. Riavviare il backend."}

        return {"ok": False, "detail": "Formato backup non riconosciuto (attesi .db o .sql.gz)"}
    except FileNotFoundError as e:
        return {"ok": False, "detail": f"Strumento non disponibile: {e}"}
    except Exception as e:
        return {"ok": False, "detail": f"Errore ripristino: {e}"}
