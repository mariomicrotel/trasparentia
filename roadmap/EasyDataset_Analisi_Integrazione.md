# easy-dataset — Analisi e integrazione con TrasParentIA

> Repository analizzato: <https://github.com/ConardLi/easy-dataset> · ~14.5k ⭐ · Licenza **AGPL-3.0** · Stack Next.js + Prisma + Electron.

## 1. Sintesi — cos'è (e cosa NON è)

**easy-dataset è un generatore di dataset per LLM**, non un gestionale documentale.
Prende documenti non strutturati (PDF, DOCX, Markdown, TXT, EPUB) e, tramite un LLM,
produce **dataset strutturati** pronti per:

- **fine-tuning** (addestramento di un modello su contenuti specifici);
- **RAG** (basi di conoscenza per la ricerca aumentata);
- **valutazione** (test di qualità del modello: vero/falso, scelta multipla, risposta aperta).

> ⚠️ **Distinzione importante per non equivocare il ruolo.**
> «Gestire i documenti del Comune» (protocollo, fascicolazione, archiviazione, ricerca,
> conservazione) **lo fa già TrasParentIA** (modelli `Documento`, `Indice`, `pgvector`,
> import massivo, OCR). easy-dataset **non sostituisce** nulla di tutto ciò e non va usato
> come archivio. Il suo valore è un altro: **rendere l'AI on-prem più brava sui documenti
> del Comune** e **alimentare le funzioni di calibrazione/valutazione** che già esistono
> nella piattaforma.

## 2. Pipeline di easy-dataset (in breve)

1. **Ingest** documento → 2. **Chunking** (markdown-aware, ricorsivo, code-aware) →
3. **Generazione domande** dai chunk via LLM → 4. **Generazione risposte** (con
chain-of-thought opzionale) → 5. **Scoring/filtraggio qualità** automatico →
6. **Export** (Alpaca, ShareGPT, JSON/JSONL).

Tipi di dataset: Q&A single-turn, dialoghi multi-turno, Q&A su immagini, e **dataset di
valutazione** (vero/falso, scelta singola/multipla, risposta breve, aperta) con
**Arena (blind test)** per confronto fra modelli.

## 3. Compatibilità con i vincoli di TrasParentIA

| Vincolo TrasParentIA | easy-dataset | Esito |
|---|---|---|
| **Tutto on-prem, nessun dato esce dal Comune** | Supporta **Ollama locale**; DB locale (Prisma, file-based); mount `./local-db`, nessuna telemetria dichiarata | ✅ **a condizione** di usarlo solo con Ollama e disabilitare ogni provider cloud |
| **AI assistiva, non decisionale** | È uno strumento *offline da banco*, non in linea col flusso operativo | ✅ neutro |
| **Riuso dell'AI già installata (Ollama qwen2.5 / nomic-embed)** | Parla con qualsiasi endpoint OpenAI-compatible → punta al reverse proxy Caddy del server AI (`https://192.168.1.10/v1`) | ✅ riusa l'infrastruttura del Runbook |
| **Licenza** | **AGPL-3.0 (copyleft forte)** | ⚠️ vedi §6 — usarlo come **tool separato**, NON inglobarne il codice in TrasParentIA |

### ⛔ Da disattivare tassativamente (rischio esfiltrazione dati)
- Provider cloud (OpenAI, Zhipu, Alibaba Bailian, OpenRouter, MiniMax) → **mai** su atti/PEC reali.
- **Upload su Hugging Face Hub** e parsing PDF via API Gemini/Claude cloud → **disabilitati**.
- Usare **solo** modelli Ollama locali. Far girare easy-dataset su una macchina della LAN
  comunale, sugli stessi confini di rete del server AI.

## 4. Casi d'uso concreti per il Comune

### 4.1 — Alimentare la **Calibrazione AI / golden-set** (uso più immediato)
TrasParentIA ha già `GET /golden-set/campione` e `POST /golden-set/valuta`
([api.py:1230+](backend/app/api.py)) per misurare l'accuratezza della classificazione
e suggerire la soglia di confidenza. easy-dataset può **costruire automaticamente il set
di valutazione**: dai regolamenti e dalle PEC storiche genera coppie *(testo → categoria
attesa / Q&A di controllo)*, da rivedere a mano e poi usare come golden-set ampliato.
→ Migliora la qualità statistica della soglia `SOGLIA_CONFIDENZA_BASSA` senza etichettare tutto a mano.

### 4.2 — **Fine-tuning** del modello locale sul linguaggio dell'ente
Da delibere, determine, regolamenti e atti già pubblicati si genera un dataset in formato
Alpaca/ShareGPT per fare fine-tuning (LoRA) di `qwen2.5:7b-instruct`. Risultato: bozze e
sintesi più aderenti al lessico amministrativo locale, alle diciture ricorrenti e alla
struttura tipica degli atti dell'ente. Resta **assistivo**: il modello propone, l'operatore firma.

### 4.3 — Costruire la **base di conoscenza per la ricerca semantica (RAG)**
TrasParentIA usa già `pgvector` e il modello `Indice`. easy-dataset aiuta a preparare i
chunk e le Q&A di riferimento per un assistente che risponda su regolamenti comunali, TARI,
SUAP, edilizia — citando l'atto di origine. Utile per uno sportello digitale al cittadino o
per supporto interno agli uffici.

### 4.4 — **Dataset di valutazione** per i prompt del Playbook
A partire dai casi d'uso del [Prompt Playbook](roadmap/TrasParentIA_Prompt_Playbook.md),
generare batterie di domande (vero/falso, scelta multipla) per verificare in modo
ripetibile che un cambio di modello o di prompt non faccia regredire la qualità
(test di non-regressione dell'AI).

## 5. Workflow operativo proposto (offline, on-prem)

```bash
# Su una macchina della LAN comunale (NON espone nulla all'esterno)
docker run -d --name easy-dataset -p 1717:1717 \
  -v ./easy-dataset/local-db:/app/local-db \
  -v ./easy-dataset/prisma:/app/prisma \
  <immagine-ufficiale-easy-dataset>
```
1. In **Impostazioni** → unico provider: **Ollama**, endpoint = reverse proxy del server AI
   (`https://192.168.1.10/v1`, header `X-API-Key`), modello `qwen2.5:7b-instruct`.
2. Caricare un campione **anonimizzato/non sensibile** di documenti (regolamenti pubblici prima di tutto).
3. Generare → revisionare a mano (passaggio umano obbligatorio) → esportare JSONL.
4. Usare l'export per: (a) ampliare il golden-set di Calibrazione AI; (b) fine-tuning LoRA offline; (c) base RAG.
5. **Cancellare i dati di lavoro** dalla macchina easy-dataset a fine sessione.

## 6. Nota legale — AGPL-3.0 (da non sottovalutare)

easy-dataset è **AGPL-3.0**: copyleft forte con clausola di rete. Implicazioni:

- ✅ **Uso consigliato:** strumento **separato e indipendente**, da banco, per produrre file
  di dataset. I file generati (JSONL) **non** sono coperti da AGPL → si usano liberamente in TrasParentIA.
- ⛔ **Da evitare:** copiare/incorporare codice di easy-dataset dentro TrasParentIA, o esporlo
  come servizio di rete agli utenti — farebbe scattare gli obblighi AGPL (pubblicazione del
  sorgente dell'intero servizio). Per una fornitura a PA, tenerli **architetturalmente distinti**.

## 7. Verdetto

| Domanda | Risposta |
|---|---|
| Gestisce i documenti del Comune? | **No** — non è un DMS; quello lo fa già TrasParentIA. |
| È utile al progetto? | **Sì, indirettamente**: migliora l'AID on-prem (classificazione, bozze, ricerca, valutazione). |
| Rispetta «tutto on-prem»? | **Sì**, solo con Ollama locale e provider cloud/HuggingFace disattivati. |
| Rischio licenza? | **Gestibile**: usarlo come tool separato; gli output (dataset) restano liberi. |
| Priorità consigliata | **Fase 5+ (AI assistiva)** — strumento di supporto alla calibrazione/qualità, non un modulo di prodotto. |

**Raccomandazione.** Non integrarlo nel prodotto. Adottarlo come **strumento interno di
data-prep** su una macchina della LAN, alimentando le funzioni *già esistenti* di
Calibrazione AI / golden-set e (in seconda battuta) un fine-tuning LoRA del modello locale.
È il modo più sicuro, conforme e a basso rischio di trarne valore.
