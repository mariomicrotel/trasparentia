"""Client AI verso il server Ollama on-prem. Integrazione reale con gestione
errori: se il server/modello non è raggiungibile, solleva AIUnavailable e il
chiamante può ricadere sulla proposta già presente (human-in-the-loop)."""
import json
import httpx

from ..config import settings
from ..reference import CAT
from . import prompts


class AIUnavailable(Exception):
    pass


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if settings.AI_API_KEY:
        h["X-API-Key"] = settings.AI_API_KEY
    return h


def _chat(system: str, user: str, fmt_json: bool = False, model: str | None = None) -> str:
    payload = {
        "model": model or settings.AI_MODEL_GEN,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "stream": False,
        "think": False,  # disabilita la modalità "thinking" dei modelli Qwen3 (latenza/JSON puliti)
        "keep_alive": "30m",
        "options": {"temperature": 0.2},
    }
    if fmt_json:
        payload["format"] = "json"
    try:
        r = httpx.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload,
                       headers=_headers(), timeout=settings.AI_TIMEOUT,
                       verify=settings.AI_TLS_VERIFY)
        r.raise_for_status()
        return r.json()["message"]["content"]
    except Exception as e:  # connessione, timeout, modello assente, ecc.
        raise AIUnavailable(str(e))


def _draft_model() -> str:
    """Modello da usare per la redazione/revisione atti. Priorità: AI_MODEL_DRAFT > AI_MODEL_GEN."""
    return settings.AI_MODEL_DRAFT or settings.AI_MODEL_GEN


def status() -> dict:
    """Verifica che Ollama risponda e che il modello sia disponibile."""
    try:
        r = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", headers=_headers(), timeout=5,
                      verify=settings.AI_TLS_VERIFY)
        r.raise_for_status()
        models = [m.get("name", "") for m in r.json().get("models", [])]
        present = any(settings.AI_MODEL_GEN.split(":")[0] in m for m in models)
        return {"ok": True, "online": True, "base_url": settings.OLLAMA_BASE_URL, "model": settings.AI_MODEL_GEN,
                "model_available": present, "models": models}
    except Exception as e:
        return {"ok": False, "online": False, "base_url": settings.OLLAMA_BASE_URL, "model": settings.AI_MODEL_GEN,
                "model_available": False, "error": str(e)}


def test_inference() -> dict:
    """Test completo con log step-by-step: raggiungibilità → modello → inferenza reale."""
    import time
    log = []

    # ── step 1: server raggiungibile? ─────────────────────────────────────
    t0 = time.monotonic()
    try:
        r = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", headers=_headers(), timeout=5,
                      verify=settings.AI_TLS_VERIFY)
        r.raise_for_status()
        models = [m.get("name", "") for m in r.json().get("models", [])]
        ms = int((time.monotonic() - t0) * 1000)
        log.append({"step": "server", "ok": True,
                    "msg": f"Server Ollama raggiungibile · {len(models)} modell{'o' if len(models)==1 else 'i'} trovati",
                    "ms": ms})
    except Exception as e:
        ms = int((time.monotonic() - t0) * 1000)
        log.append({"step": "server", "ok": False,
                    "msg": f"Server non raggiungibile ({settings.OLLAMA_BASE_URL}): {e}",
                    "ms": ms})
        return {"ok": False, "detail": log[-1]["msg"], "log": log, "models": []}

    # ── step 2: modello configurato presente? ──────────────────────────────
    gen_base = settings.AI_MODEL_GEN.split(":")[0]
    present = any(gen_base in m for m in models)
    if present:
        log.append({"step": "modello", "ok": True,
                    "msg": f"Modello «{settings.AI_MODEL_GEN}» presente nella lista Ollama",
                    "ms": None})
    else:
        elenco = ", ".join(models) if models else "nessun modello scaricato"
        log.append({"step": "modello", "ok": False,
                    "msg": (f"Modello «{settings.AI_MODEL_GEN}» NON trovato. "
                            f"Disponibili: {elenco}. "
                            f"→ ollama pull {settings.AI_MODEL_GEN}"),
                    "ms": None})
        return {"ok": False, "detail": log[-1]["msg"], "log": log, "models": models}

    # ── step 3: header API key presente? ──────────────────────────────────
    if settings.AI_API_KEY:
        log.append({"step": "auth", "ok": True,
                    "msg": "Header X-API-Key presente (configurato)",
                    "ms": None})
    else:
        log.append({"step": "auth", "ok": True,
                    "msg": "Nessuna API key — server AI aperto sulla LAN (verifica firewall)",
                    "ms": None})

    # ── step 4: inferenza reale ────────────────────────────────────────────
    t1 = time.monotonic()
    try:
        payload = {
            "model": settings.AI_MODEL_GEN,
            "messages": [{"role": "user", "content": "Rispondi solo con la parola OK."}],
            "stream": False,
            "think": False,
            "options": {"temperature": 0, "num_predict": 8},
            "keep_alive": "30m",
        }
        r = httpx.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload,
                       headers=_headers(), timeout=60,
                       verify=settings.AI_TLS_VERIFY)
        r.raise_for_status()
        latency_ms = int((time.monotonic() - t1) * 1000)
        risposta = r.json()["message"]["content"].strip()
        log.append({"step": "inferenza", "ok": True,
                    "msg": f"Risposta ricevuta in {latency_ms} ms → «{risposta[:80]}»",
                    "ms": latency_ms})
        return {
            "ok": True,
            "detail": f"Modello «{settings.AI_MODEL_GEN}» operativo · latenza {latency_ms} ms",
            "latency_ms": latency_ms,
            "log": log,
            "models": models,
        }
    except Exception as e:
        latency_ms = int((time.monotonic() - t1) * 1000)
        log.append({"step": "inferenza", "ok": False,
                    "msg": f"Inferenza fallita dopo {latency_ms} ms: {e}",
                    "ms": latency_ms})
        return {
            "ok": False,
            "detail": f"Modello non risponde: {e}",
            "latency_ms": latency_ms,
            "log": log,
            "models": models,
        }


def classifica(oggetto: str, corpo: list[str], allegati: list[dict]) -> dict:
    content = _chat(prompts.SYSTEM_CLASSIFICA, prompts.user_classifica(oggetto, corpo, allegati), fmt_json=True)
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise AIUnavailable("Risposta AI non in formato JSON valido")
    # normalizzazione e validazione minima
    cat = data.get("categoria")
    if cat not in CAT:
        cat = "istanza_cittadino"
        data["motivazione"] = "(categoria non riconosciuta, impostata di default — verifica manuale) " + str(data.get("motivazione", ""))
    try:
        conf = float(data.get("confidenza", 0))
    except (TypeError, ValueError):
        conf = 0.0
    return {
        "categoria": cat,
        "confidenza": max(0.0, min(1.0, conf)),
        "tipoProcedimento": data.get("tipoProcedimento", ""),
        "ufficio": data.get("ufficio", ""),
        "responsabile": None,
        "urgenza": data.get("urgenza", "media") if data.get("urgenza") in ("bassa", "media", "alta", "urgente") else "media",
        "termineGiorni": int(data.get("termineGiorni", 30)) if str(data.get("termineGiorni", "")).strip().isdigit() else 30,
        "motivazione": data.get("motivazione", ""),
        "alternative": [a for a in data.get("alternative", []) if isinstance(a, dict) and a.get("categoria") in CAT][:3],
        "_fonte": "ollama",
    }


def bozza(tipo_label: str, oggetto: str, contesto: str = "") -> str:
    return _chat(prompts.SYSTEM_BOZZA, prompts.user_bozza(tipo_label, oggetto, contesto),
                 fmt_json=False, model=_draft_model())


def revisiona(contenuto_attuale: str, istruzioni: str, oggetto: str) -> str:
    """Revisione assistita del testo di un atto. Usa AI_MODEL_DRAFT per qualità superiore."""
    return _chat(prompts.SYSTEM_REVISIONA,
                 prompts.user_revisiona(contenuto_attuale, istruzioni, oggetto),
                 fmt_json=False, model=_draft_model())


def embed(text: str) -> list[float] | None:
    """Embedding del testo via Ollama (modello AI_MODEL_EMBED). Per la ricerca semantica.
    Usa /api/embed (Ollama ≥0.4) con campo 'input'; risposta in embeddings[0]."""
    try:
        r = httpx.post(f"{settings.OLLAMA_BASE_URL}/api/embed",
                       json={"model": settings.AI_MODEL_EMBED, "input": text[:4000]},
                       headers=_headers(), timeout=settings.AI_TIMEOUT,
                       verify=settings.AI_TLS_VERIFY)
        r.raise_for_status()
        data = r.json()
        # Ollama ≥0.4: {"embeddings": [[...]]}; fallback per versioni precedenti
        vecs = data.get("embeddings")
        if vecs and isinstance(vecs, list) and isinstance(vecs[0], list):
            return vecs[0]
        return data.get("embedding")
    except Exception as e:
        raise AIUnavailable(str(e))
