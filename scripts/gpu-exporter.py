#!/usr/bin/env python3
"""Exporter telemetria GPU per TrasParentIA — da installare sul SERVER AI.

Espone su http://127.0.0.1:9110/ un JSON con lo stato delle GPU letto da
`nvidia-smi`. NON ha autenticazione: va esposto solo su localhost e pubblicato
in LAN tramite il reverse proxy Caddy già usato per Ollama (che aggiunge TLS e
l'header X-API-Key). Nessun dato dell'ente transita: solo metriche hardware.

── Installazione sul server AI (Debian/RHEL) ──────────────────────────────────
  sudo install -m 755 gpu-exporter.py /usr/local/bin/gpu-exporter.py
  sudo cp gpu-exporter.service /etc/systemd/system/
  sudo systemctl daemon-reload && sudo systemctl enable --now gpu-exporter
  systemctl status gpu-exporter        # deve risultare active (running)
  curl -s http://127.0.0.1:9110/       # verifica il JSON

── Rotta nel Caddyfile del server AI (accanto a Ollama) ───────────────────────
  # dentro il blocco `https://192.168.14.221 { ... }`, con la stessa X-API-Key:
  handle /gpu {
      reverse_proxy 127.0.0.1:9110
  }
  # (il gate @noauth con X-API-Key già presente protegge anche /gpu)

── Lato TrasParentIA ──────────────────────────────────────────────────────────
  Imposta AI_GPU_STATS_URL=https://192.168.14.221/gpu (stessa AI_API_KEY).
  Il Monitor AI mostrerà utilizzo, temperatura, consumo e memoria della GPU.
"""
import json
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST, PORT = "127.0.0.1", 9110

_CAMPI = [
    "index", "name", "utilization.gpu", "utilization.memory", "temperature.gpu",
    "power.draw", "power.limit", "memory.used", "memory.total",
]


def _num(v):
    v = (v or "").strip()
    if v in ("", "[N/A]", "[Not Supported]"):
        return None
    try:
        return float(v) if "." in v else int(v)
    except ValueError:
        return v


def leggi_gpu():
    out = subprocess.run(
        ["nvidia-smi", f"--query-gpu={','.join(_CAMPI)}", "--format=csv,noheader,nounits"],
        capture_output=True, text=True, timeout=8,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or "nvidia-smi ha restituito errore")
    gpus = []
    for riga in out.stdout.strip().splitlines():
        c = [x.strip() for x in riga.split(",")]
        if len(c) < len(_CAMPI):
            continue
        gpus.append({
            "index": _num(c[0]), "name": c[1],
            "util_pct": _num(c[2]), "mem_util_pct": _num(c[3]),
            "temp_c": _num(c[4]), "power_w": _num(c[5]), "power_limit_w": _num(c[6]),
            "mem_used_mb": _num(c[7]), "mem_total_mb": _num(c[8]),
        })
    return gpus


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            body = json.dumps({"gpus": leggi_gpu()}).encode()
            code = 200
        except Exception as e:
            body = json.dumps({"error": str(e), "gpus": []}).encode()
            code = 500
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass  # silenzioso


if __name__ == "__main__":
    print(f"GPU exporter in ascolto su http://{HOST}:{PORT}/")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
