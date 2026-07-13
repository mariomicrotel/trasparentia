"""Client AI verso il server Ollama on-prem. Integrazione reale con gestione
errori: se il server/modello non è raggiungibile, solleva AIUnavailable e il
chiamante può ricadere sulla proposta già presente (human-in-the-loop)."""
import json
import re
import time as _time
from collections import deque

import httpx

from ..config import settings
from ..reference import CAT
from . import prompts

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)

# Serie temporale delle ultime inferenze per il monitor di sforzo inferenziale.
# Ogni campione deriva dai timing restituiti da Ollama (token/s, latenza).
_METRICHE: deque = deque(maxlen=90)


def _registra_metrica(kind: str, model: str, data: dict) -> None:
    """Estrae i timing dalla risposta Ollama e li accoda alla serie del monitor."""
    try:
        ev = data.get("eval_count") or 0
        evd = data.get("eval_duration") or 0          # durata generazione (ns)
        pev = data.get("prompt_eval_count") or 0
        pevd = data.get("prompt_eval_duration") or 0  # durata prefill prompt (ns)
        tot = data.get("total_duration") or 0          # durata totale (ns)
        load = data.get("load_duration") or 0          # caricamento modello (ns)
        tps = round(ev / (evd / 1e9), 1) if evd else 0.0
        ptps = round(pev / (pevd / 1e9), 1) if pevd else 0.0
        _METRICHE.append({
            "ts": _time.time(), "kind": kind, "model": model,
            "tokens_s": tps, "prompt_tokens_s": ptps,
            "eval_count": ev, "prompt_tokens": pev,
            "total_ms": int(tot / 1e6) if tot else None,
            "load_ms": int(load / 1e6) if load else 0,
        })
    except Exception:
        pass

# Client persistente: riusa le connessioni TCP verso il server AI (RTT ridotto, meno overhead TLS).
# max_connections=4 basta per un Comune piccolo (un solo worker GPU attivo alla volta).
# Lazy init: settings.AI_TLS_VERIFY è disponibile a runtime (variabile d'env), non da DB.
_http: httpx.Client | None = None


def _get_http() -> httpx.Client:
    global _http
    if _http is None or _http.is_closed:
        _http = httpx.Client(
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=2, keepalive_expiry=30),
            verify=settings.AI_TLS_VERIFY,
        )
    return _http


def close() -> None:
    global _http
    if _http is not None and not _http.is_closed:
        _http.close()
        _http = None


class AIUnavailable(Exception):
    pass


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if settings.AI_API_KEY:
        h["X-API-Key"] = settings.AI_API_KEY
    return h


def _chat(system: str, user: str, fmt_json: bool = False, model: str | None = None,
          num_predict: int | None = None, repeat_penalty: float | None = None) -> str:
    mdl = model or settings.AI_MODEL_GEN
    # I modelli Qwen3 spesso ignorano "think": false e "ragionano ad alta voce":
    # output sporco e generazione lentissima (rischio timeout). Il direttivo /no_think
    # nel prompt è il modo affidabile per disattivare il reasoning su questi modelli.
    if "qwen3" in mdl.lower():
        system = (system or "") + "\n/no_think"
    options = {"temperature": 0.2}
    if num_predict:
        options["num_predict"] = num_predict  # tetto di sicurezza alla lunghezza (latenza limitata)
    if repeat_penalty:
        options["repeat_penalty"] = repeat_penalty  # evita i loop di ripetizione nelle bozze lunghe
    payload = {
        "model": mdl,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "stream": False,
        "think": False,
        "keep_alive": "30m",
        "options": options,
    }
    if fmt_json:
        payload["format"] = "json"
    try:
        r = _get_http().post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload,
                             headers=_headers(), timeout=settings.AI_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        _registra_metrica("classifica" if fmt_json else "generazione", mdl, data)
        content = data["message"]["content"]
        # rimuove eventuali blocchi di reasoning residui (<think>…</think>) lasciati dal modello
        return _THINK_RE.sub("", content).strip()
    except Exception as e:  # connessione, timeout, modello assente, ecc.
        raise AIUnavailable(str(e))


def _chat_messages(system: str, messages: list[dict], model: str | None = None,
                   num_predict: int | None = None) -> str:
    """Come _chat ma con storia conversazionale multi-turn (lista di
    {"role","content"}). Usato dall'assistente chat globale."""
    mdl = model or settings.AI_MODEL_GEN
    if "qwen3" in mdl.lower():
        system = (system or "") + "\n/no_think"
    options = {"temperature": 0.2}
    if num_predict:
        options["num_predict"] = num_predict
    payload = {
        "model": mdl,
        "messages": [{"role": "system", "content": system}] + messages,
        "stream": False, "think": False, "keep_alive": "30m", "options": options,
    }
    try:
        r = _get_http().post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload,
                             headers=_headers(), timeout=settings.AI_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        _registra_metrica("assistente", mdl, data)
        return _THINK_RE.sub("", data["message"]["content"]).strip()
    except Exception as e:
        raise AIUnavailable(str(e))


def assistente(domanda: str, storia: list[dict], contesto: str) -> str:
    """Assistente chat globale: risponde su piattaforma + corpus normativo + dati
    operativi, fondandosi sul contesto recuperato (RAG). `storia` = turni recenti
    [{"ruolo","testo"}]. Il contesto è iniettato sull'ultima domanda."""
    msgs = []
    for t in (storia or [])[-6:]:
        role = "assistant" if t.get("ruolo") == "assistant" else "user"
        testo = (t.get("testo") or "").strip()
        if testo:
            msgs.append({"role": role, "content": testo})
    msgs.append({"role": "user", "content": prompts.user_assistente(domanda, contesto)})
    return _chat_messages(prompts.SYSTEM_ASSISTENTE, msgs, num_predict=900)


def _draft_model() -> str:
    """Modello da usare per la redazione/revisione atti. Priorità: AI_MODEL_DRAFT > AI_MODEL_GEN."""
    return settings.AI_MODEL_DRAFT or settings.AI_MODEL_GEN


def status() -> dict:
    """Verifica che Ollama risponda e che il modello sia disponibile."""
    try:
        r = _get_http().get(f"{settings.OLLAMA_BASE_URL}/api/tags", headers=_headers(), timeout=5)
        r.raise_for_status()
        models = [m.get("name", "") for m in r.json().get("models", [])]
        present = any(settings.AI_MODEL_GEN.split(":")[0] in m for m in models)
        return {"ok": True, "online": True, "base_url": settings.OLLAMA_BASE_URL, "model": settings.AI_MODEL_GEN,
                "model_available": present, "models": models}
    except Exception as e:
        return {"ok": False, "online": False, "base_url": settings.OLLAMA_BASE_URL, "model": settings.AI_MODEL_GEN,
                "model_available": False, "error": str(e)}


def _keepalive_sec(expires_at: str | None) -> int | None:
    """Secondi rimanenti prima che il modello venga scaricato dalla VRAM."""
    if not expires_at:
        return None
    try:
        from datetime import datetime, timezone
        s = re.sub(r"(\.\d{6})\d+", r"\1", expires_at)  # tronca a microsecondi
        exp = datetime.fromisoformat(s)
        return max(0, int((exp - datetime.now(timezone.utc)).total_seconds()))
    except Exception:
        return None


def _aggrega(campioni: list[dict]) -> dict:
    """KPI aggregati sulle inferenze recenti (media/max, prefill, cold start, totali)."""
    if not campioni:
        return {"n": 0}
    tps = [c["tokens_s"] for c in campioni if c.get("tokens_s")]
    ptps = [c["prompt_tokens_s"] for c in campioni if c.get("prompt_tokens_s")]
    lat = [c["total_ms"] for c in campioni if c.get("total_ms")]
    cold = [c for c in campioni if (c.get("load_ms") or 0) > 500]
    per_tipo = {}
    for c in campioni:
        per_tipo[c["kind"]] = per_tipo.get(c["kind"], 0) + 1
    med = lambda xs: round(sum(xs) / len(xs), 1) if xs else 0.0
    return {
        "n": len(campioni),
        "tps_medio": med(tps), "tps_max": max(tps) if tps else 0.0,
        "prompt_tps_medio": med(ptps),
        "latenza_media_ms": int(med(lat)) if lat else 0,
        "latenza_max_ms": max(lat) if lat else 0,
        "token_generati": sum(c.get("eval_count", 0) for c in campioni),
        "prompt_tokens_tot": sum(c.get("prompt_tokens", 0) for c in campioni),
        "cold_start": len(cold), "ultimo_load_ms": campioni[-1].get("load_ms", 0),
        "per_tipo": per_tipo,
    }


def _gpu_stats() -> list[dict] | None:
    """Telemetria GPU dall'exporter nvidia-smi (se configurato). Best-effort:
    None se non configurato o non raggiungibile → il monitor mostra la nota."""
    url = (settings.AI_GPU_STATS_URL or "").strip()
    if not url:
        return None
    try:
        r = _get_http().get(url, headers=_headers(), timeout=3)
        r.raise_for_status()
        data = r.json()
        gpus = data.get("gpus") if isinstance(data, dict) else data
        return gpus if isinstance(gpus, list) and gpus else None
    except Exception:
        return None


def metriche() -> dict:
    """Snapshot per il monitor di sforzo inferenziale: stato VRAM/modelli caricati
    (live da /api/ps) + serie temporale e KPI aggregati delle inferenze + (se
    l'exporter è configurato) telemetria GPU reale."""
    campioni = list(_METRICHE)
    gen_base = settings.AI_MODEL_GEN.split(":")[0]
    gpu = _gpu_stats()
    out = {"online": False, "base_url": settings.OLLAMA_BASE_URL,
           "vram_totale_gb": settings.AI_VRAM_GB, "campioni": campioni,
           "kpi": _aggrega(campioni), "gpu": gpu,
           # Nota mostrata solo se l'exporter GPU non è configurato/raggiungibile.
           "gpu_note": None if gpu else "Utilizzo GPU, temperatura e consumo non sono esposti dall'API Ollama: attiva l'exporter nvidia-smi sul server AI (vedi platform/scripts/gpu-exporter.py) e imposta AI_GPU_STATS_URL."}
    try:
        r = _get_http().get(f"{settings.OLLAMA_BASE_URL}/api/ps", headers=_headers(), timeout=5)
        r.raise_for_status()
        ms = r.json().get("models", [])
        vram = sum(m.get("size_vram", 0) or 0 for m in ms)
        out["online"] = True
        out["modelli"] = [{"name": m.get("name"), "vram_bytes": m.get("size_vram", 0) or 0,
                           "context_length": m.get("context_length"),
                           "keepalive_sec": _keepalive_sec(m.get("expires_at")),
                           "is_gen": gen_base in (m.get("name") or "")} for m in ms]
        out["vram_bytes"] = vram
        out["vram_gb"] = round(vram / 1e9, 2)
        out["vram_libera_gb"] = round(max(0.0, settings.AI_VRAM_GB - vram / 1e9), 2)
        out["vram_pct"] = round(vram / 1e9 / settings.AI_VRAM_GB * 100) if settings.AI_VRAM_GB else 0
        out["gen_residente"] = any(m["is_gen"] for m in out["modelli"])
    except Exception as e:
        out["errore"] = str(e)
        out["modelli"] = []
        out["vram_bytes"] = 0
        out["vram_gb"] = 0.0
        out["vram_libera_gb"] = settings.AI_VRAM_GB
        out["vram_pct"] = 0
        out["gen_residente"] = False
    return out


def test_inference() -> dict:
    """Test completo con log step-by-step: raggiungibilità → modello → inferenza reale."""
    import time
    log = []

    # ── step 1: server raggiungibile? ─────────────────────────────────────
    t0 = time.monotonic()
    try:
        r = _get_http().get(f"{settings.OLLAMA_BASE_URL}/api/tags", headers=_headers(), timeout=5)
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
        r = _get_http().post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload,
                             headers=_headers(), timeout=60)
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
                 fmt_json=False, model=_draft_model(), num_predict=1500, repeat_penalty=1.3)


def redazionale(tipo_label: str, oggetto: str, fonti: str) -> str:
    """Redazione atto fondata sul corpus normativo (+ atti precedenti come modello).
    Il prompt impone la fondazione esclusiva sulle FONTI NORMATIVE e il rifiuto se
    non pertinenti (cfr. SYSTEM_REDAZIONALE)."""
    return _chat(prompts.SYSTEM_REDAZIONALE, prompts.user_redazionale(tipo_label, oggetto, fonti),
                 fmt_json=False, model=_draft_model(), num_predict=1500, repeat_penalty=1.3)


def revisiona(contenuto_attuale: str, istruzioni: str, oggetto: str) -> str:
    """Revisione assistita del testo di un atto. Usa AI_MODEL_DRAFT per qualità superiore."""
    return _chat(prompts.SYSTEM_REVISIONA,
                 prompts.user_revisiona(contenuto_attuale, istruzioni, oggetto),
                 fmt_json=False, model=_draft_model(), num_predict=1500, repeat_penalty=1.3)


def embed(text: str) -> list[float] | None:
    """Embedding del testo via Ollama (modello AI_MODEL_EMBED). Per la ricerca semantica.
    Usa /api/embed (Ollama ≥0.4) con campo 'input'; risposta in embeddings[0]."""
    try:
        r = _get_http().post(f"{settings.OLLAMA_BASE_URL}/api/embed",
                             json={"model": settings.AI_MODEL_EMBED, "input": text[:4000]},
                             headers=_headers(), timeout=settings.AI_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        # Ollama ≥0.4: {"embeddings": [[...]]}; fallback per versioni precedenti
        vecs = data.get("embeddings")
        if vecs and isinstance(vecs, list) and isinstance(vecs[0], list):
            return vecs[0]
        return data.get("embedding")
    except Exception as e:
        raise AIUnavailable(str(e))
