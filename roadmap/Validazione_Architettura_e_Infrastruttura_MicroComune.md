# TrasParentIA — Validazione dell'architettura e infrastruttura minima per un micro-comune

> Documento in due parti: **(A)** esito dei test di validazione eseguiti sullo stack reale in esecuzione; **(B)** raccomandazioni di infrastruttura minima per un micro-comune (~5.000 abitanti, 5–15 operatori), basate sul consumo di risorse misurato.

---

## Parte A — Validazione dell'architettura (test empirici)

### A.1 Topologia osservata
Lo stack è **interamente containerizzato (Docker Compose)** e separa nettamente due piani:

- **Piano Piattaforma** (8 servizi): `backend` (FastAPI), `worker` + `beat` (Celery: OCR, parsing, embeddings, scadenze), `db` (PostgreSQL + **pgvector**), `minio` (storage S3), `redis` (broker), `caddy` (reverse proxy), `restic-backup`. + `frontend` (nginx) e `keycloak` (opzionale).
- **Piano AI** (server **separato**, on-prem): Ollama su `192.168.14.221`. La piattaforma vi si collega via rete; **non richiede GPU**.

Questa separazione è coerente con l'invariante di sicurezza «AI isolata, nessun dato esce dal Comune» e con il *Runbook Server AI*.

### A.2 Test eseguiti ed esiti

| # | Test | Esito | Evidenza |
|---|------|-------|----------|
| 1 | Servizi **critici** (PostgreSQL, MinIO) | ✅ | `db` e `minio` `critico=true`, entrambi `ok=true` |
| 2 | Persistenza dati | ✅ | 7 comunicazioni, 13 pratiche, 14 atti, 25 beni, 9 utenti, 36 chunk indice |
| 3 | **Write path** end-to-end (HTTP → ORM → Postgres) | ✅ | crea bene → UUID; elimina → `HTTP 204` |
| 4 | Reattività API non-AI | ✅ | **38 ms** medi, 304 ms max (cold) su `/api/beni` ×10 |
| 5 | Ricerca semantica / **RAG** (pgvector) | ✅ | 36/36 chunk embeddati; retrieval e dedup per fonte OK |
| 6 | **Backup** | ✅ | dump `*.sql.gz` presenti + `restic-backup` attivo |
| 7 | **Degradazione graceful** AI offline/lenta | ✅ | la bozza ripiega su placeholder senza errori |
| 8 | Autenticazione | ⚙️ | Keycloak presente ma disabilitato (modalità demo role-switch) |

### A.3 AI: correzione applicata e latenze reali misurate

**Problema trovato e risolto.** Il modello configurato (`qwen3:4b`) non era presente sul server AI di produzione `192.168.14.221` (che ha `qwen2.5:7b-instruct`, `llama3.1:8b`, `llama3.2:3b`, `bge-m3`, `nomic-embed-text`). Corretto impostando `AI_MODEL_GEN`/`AI_MODEL_DRAFT = qwen2.5:7b-instruct` via override DB.

> ⚠️ **Precedenza configurazione:** le impostazioni AI effettive arrivano dalla tabella DB `ImpostazioneConfig` (override runtime applicato all'avvio), che **prevale sul `.env`**. Cambiare il `.env` non basta: va modificato il valore dall'UI Configurazione (o nel DB) e riavviato il backend.

**Latenze reali** (server `192.168.14.221`, `qwen2.5:7b-instruct`, a regime/caldo):

| Operazione | Latenza | Giudizio |
|---|---|---|
| Embedding (RAG/indicizzazione) | **~1.1 s** | ottimo |
| Classificazione PEC (JSON) | **~7–8 s** | buono (è async, in background) |
| **Bozza con contesto RAG** | **~6–10 s** | ottimo per uso interattivo |

> Nota: una prima versione dei test risultava lentissima (timeout >180 s) perché colpiva per errore un Ollama *locale* di sviluppo (`qwen3:4b` su hardware debole), **non** il server di produzione. Sul server reale la generazione è fluida. Le bozze lunghe potevano entrare in **loop di ripetizione**: risolto con `repeat_penalty=1.3` + tetto `num_predict` lato client.

### A.4 Verdetto
L'**architettura è solida e validata end-to-end**: servizi critici stabili, dato persistente, backup presente, piattaforma leggera e reattiva, **degradazione graceful** se l'AI è offline, e — con il modello corretto — **catena RAG→generazione fluida** (bozza coerente, citata e ancorata alle fonti in ~10 s). Nessun problema di disegno; le criticità erano di **configurazione AI**, ora risolte.

---

## Parte B — Infrastruttura minima per un micro-comune

### B.1 Principio guida
Due macchine, per sicurezza e per natura del carico:

- **Server Piattaforma** — carico leggero, **CPU-only** (no GPU).
- **Server AI** — carico GPU, **separato** (cfr. *Runbook Server AI*).

L'isolamento non è solo prudenza: è richiesto dall'invariante di sicurezza (l'AI non deve stare sullo stesso host dei dati applicativi).

### B.2 Consumo di risorse misurato (piattaforma, a riposo)
Somma dei container `platform-*`: **~530 MiB RAM**, CPU ~0 % in idle.
I picchi reali vengono da: **OCR/parsing** dei documenti (worker), **batch embeddings**, **PostgreSQL** sotto query, e **Keycloak** (JVM, ~400–600 MiB) se attivo.

### B.3 Server Piattaforma — sizing

| | **Minimo** | **Consigliato** |
|---|---|---|
| CPU | 4 vCPU | 4–8 vCPU |
| RAM | **8 GB** | **16 GB** |
| Disco | 128 GB SSD | 256–512 GB **NVMe** |
| OS | Debian 12 | Debian 12 |
| Runtime | Docker + Compose | Docker + Compose |

> Note: a riposo bastano <1 GB, ma 8 GB è il **minimo onesto** per assorbire OCR + embeddings + Postgres + (eventuale) Keycloak senza swappare. Il disco cresce con i documenti archiviati su MinIO: per un micro-comune 256 GB coprono anni, ma prevedere espansione/monitoraggio. SSD/NVMe è importante per Postgres e pgvector.

### B.4 Server AI — sizing
Rimando al **Runbook Server AI** per l'installazione. **Dato di campo:** il server AI di produzione gestisce il modello **7B fluidamente** (embed ~1.1 s, classificazione ~7–8 s, bozza+RAG ~6–10 s). Questa classe di prestazioni è **adeguata** per un micro-comune.

- Bersaglio modelli: **7–8B Q4** (`qwen2.5:7b-instruct`) per generazione/classificazione + embeddings (`nomic-embed-text`/`bge-m3`).
- VRAM: **8 GB sono sufficienti** per un 7B Q4 *purché il modello giri davvero su GPU* (verificare con `nvidia-smi` durante l'inferenza — su CPU la stessa operazione è ~5–10× più lenta). 12–16 GB danno margine per contesti lunghi e per tenere caricati 2 modelli.
- `OLLAMA_MAX_LOADED_MODELS`: con 1 solo slot, il flusso RAG alterna embedding e generazione con possibili cold-load; se VRAM lo consente, **2 slot** eliminano il thrashing.
- Parametri di generazione (lato app, già impostati): `repeat_penalty=1.3` per evitare loop di ripetizione, tetto `num_predict` per limitare la latenza.

### B.5 Due scenari di deployment

**Scenario A — Due server (consigliato, conforme alla sicurezza)**
- *Server Piattaforma* (B.3) + *Server AI* (B.4) sulla stessa LAN comunale.
- Firewall allowlist + reverse proxy + API key come da Runbook.
- È la configurazione minima **corretta** per andare in produzione.

**Scenario B — Server unico (solo budget estremo, sconsigliato)**
- Piattaforma + AI sulla stessa macchina con GPU: richiede **32 GB RAM**, **8+ core**, GPU dedicata.
- **Indebolisce l'isolamento** dati/AI → accettabile solo per pilota/demo, non per il go-live con dati reali.

### B.6 Contorno indispensabile
- **Rete:** LAN comunale, IP statici/reservation, firewall (allowlist verso il server AI).
- **Backup 3-2-1:** `restic` è già nello stack → puntarlo a una destinazione **off-site/NAS** e testare il **ripristino** (è un gate P2).
- **UPS** su entrambi i server (continuità + spegnimento pulito di Postgres).
- **TLS interno** (Caddy) e, prima del go-live, **Keycloak attivo** + niente credenziali di default (gate P2).
- **Monitoraggio** base: spazio disco MinIO/DB, stato container, esito backup.

### B.7 Sintesi operativa
| Componente | Minimo micro-comune |
|---|---|
| Server Piattaforma | 4 vCPU · 8 GB RAM · 128 GB SSD · Debian 12 · Docker |
| Server AI | cfr. Runbook · GPU ≥8 GB (meglio 12–16) · modelli 7–8B Q4 |
| Rete/sicurezza | LAN, IP statici, firewall allowlist, TLS, Keycloak |
| Continuità | UPS ×2 · backup restic off-site testato |

**In una riga:** la piattaforma gira comodamente su un piccolo server CPU-only (8 GB); il vero investimento è la **GPU del server AI**, ed è lì — non sulla piattaforma — che conviene spendere per la fluidità.
