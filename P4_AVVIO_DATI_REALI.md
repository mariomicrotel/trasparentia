# P4 — Guida operativa: Go-live dati reali
## TrasParentIA Micro PA

**Prerequisiti:** P2 completato (Keycloak attivo, credenziali cambiate, backup testato).  
**Durata stimata:** 3–6 settimane operatively. Le attività possono sovrapporsi.

---

## 1. Collegamento casella PEC istituzionale

### 1.1 Configurare le credenziali PEC

Aprire `platform/.env` e impostare le variabili PEC:

```bash
PEC_HOST=mail.pec.nome-provider.it     # server IMAP del provider PEC
PEC_PORT=993                           # IMAP SSL standard
PEC_USER=comune@pec.comune.xxx.it      # indirizzo PEC istituzionale
PEC_PASSWORD=<password casella PEC>    # password IMAP
PEC_FOLDER=INBOX                       # cartella (default INBOX)
```

### 1.2 Testare la connessione

```bash
# Test IMAP via diagnostica
curl -X POST http://localhost/api/diagnostica/test/imap \
  -H "Authorization: Bearer <token>"
```

Risposta attesa:
```json
{"ok": true, "detail": "Login OK · cartella «INBOX»: 1247 messaggi (89 non letti)."}
```

In caso di errore: verificare firewall del server PEC, porta 993, e credenziali.

### 1.3 Primo polling manuale PEC

```bash
# Trigger manuale (sostituisce il polling automatico in Celery Beat)
curl -X POST http://localhost/api/pec/sync \
  -H "Authorization: Bearer <token>"
```

Verificare nel cruscotto che le prime PEC compaiano nell'Inbox. Il polling automatico ogni 10 minuti è già attivo via Celery Beat (configurato in P1).

### 1.4 Verificare OCR allegati

Aprire alcune comunicazioni con allegati PDF e controllare che il testo estratto sia corretto nella vista Comunicazione. Se l'OCR fallisce su alcuni allegati, impostare `OCR_ENABLED=true` nel `.env`.

---

## 2. Primo lotto documentale — PEC storiche

### 2.1 Esportare le PEC degli ultimi 6–12 mesi

Prima di attivare il polling in avanti, è conveniente importare il backlog storico tramite l'**Importazione massiva** (modulo Import nella piattaforma).

**Procedura:**
1. Esportare le PEC dal provider come file EML o PDF (consultare la documentazione del provider)
2. Aprire il modulo **Importazione massiva** nell'interfaccia
3. Creare un nuovo lotto con nome descrittivo (es. "PEC storiche 2024–2025")
4. Caricare i file (max 20 MB per file)
5. Classificare ogni file tramite il pulsante "Classifica con AI"
6. Revisionare le classificazioni a bassa confidenza (< 60%)
7. Applicare o scartare ogni item
8. Chiudere il lotto

### 2.2 Importare determine/delibere/ordinanze storiche

Stessa procedura del §2.1 per i documenti prodotti dall'ufficio (in formato PDF).  
Creare lotti separati per tipo (es. "Determine 2024", "Delibere 2024").

---

## 3. Golden set — calibrazione accuratezza AI

Il golden set è un campione di comunicazioni classificate dall'AI e **verificate manualmente** dal personale: serve a misurare quanto è accurata la classificazione e a calibrare la soglia di confidenza.

### 3.1 Estrarre il campione

```bash
# Estrae 80 comunicazioni ordinate per confidenza crescente (revisionare prima le meno certe)
curl "http://localhost/api/golden-set/campione?n=80&ordine=confidenza_asc" \
  -H "Authorization: Bearer <token>" > campione_golden.json
```

### 3.2 Compilare le etichette manuali

Aprire `campione_golden.json` e per ogni record aggiungere il campo `categoria_corretta` (la categoria che un esperto assegnerebbe). Le categorie ammesse sono quelle in `reference.py` (es. `permesso_costruire`, `scia`, `accesso_atti`, `istanza_cittadino`, ecc.).

Formato per la valutazione:
```json
{
  "campione": [
    {"id": "abc123", "categoria_corretta": "permesso_costruire"},
    {"id": "def456", "categoria_corretta": "scia"},
    ...
  ]
}
```

### 3.3 Valutare l'accuratezza

```bash
curl -X POST http://localhost/api/golden-set/valuta \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @campione_etichettato.json
```

Risposta di esempio:
```json
{
  "totale_valutati": 80,
  "corretti": 68,
  "accuratezza_pct": 85.0,
  "target_minimo_pct": 80.0,
  "soglia_confidenza_attuale": 0.6,
  "soglia_suggerita": 0.7,
  "per_categoria": {
    "permesso_costruire": {"totale": 25, "corretti": 23, "accuratezza_pct": 92.0},
    "scia": {"totale": 18, "corretti": 14, "accuratezza_pct": 77.8},
    ...
  }
}
```

### 3.4 Interpretare i risultati

| Accuratezza | Azione |
|-------------|--------|
| ≥ 85% | Ottimo. Usare la `soglia_suggerita` per aggiornare `SOGLIA_CONFIDENZA_BASSA` in `.env` |
| 70–84% | Accettabile. Monitorare le categorie con accuratezza < 70% e verificare i prompt |
| < 70% | Insufficiente. Rivedere le categorie del Comune (vedi §3.5) |

### 3.5 Aggiustamenti se l'accuratezza è bassa

1. **Categorie non pertinenti**: alcune delle 16 categorie di default potrebbero non essere usate dal Comune. Disattivarle o rinominarle in `platform/backend/app/reference.py` → `CATEGORIE`.
2. **Modello alternativo**: se la qualità è bassa anche dopo la calibrazione, provare `AI_MODEL_GEN=qwen2.5:14b-instruct` (richiede GPU ≥12 GB).
3. **Ripetere la valutazione** dopo aver modificato le categorie.

### 3.6 Aggiornare la soglia di confidenza

```bash
# In platform/.env
SOGLIA_CONFIDENZA_BASSA=0.70   # o il valore suggerito dall'API

# Riavviare il backend per applicare
docker compose restart backend
```

---

## 4. Integrazioni sistemi documentali esterni (opzionale)

Se il Comune usa un sistema di **albo pretorio** o un **protocollo informatico** esterno (Halley, Maggioli, JDOC, Maggioli Suite, PA Digitale, ecc.):

### 4.1 Configurare gli endpoint

```bash
# In platform/.env
ALBO_ESTERNO_URL=https://albo.comune.xxx.it/api
ALBO_ESTERNO_API_KEY=<chiave-API-albo>
PROTOCOLLO_ESTERNO_URL=https://protocollo.comune.xxx.it/api
PROTOCOLLO_ESTERNO_API_KEY=<chiave-API-protocollo>
```

### 4.2 Testare la connessione

```bash
curl -X POST http://localhost/api/integrazione/albo/test \
  -H "Authorization: Bearer <token>"

curl -X POST http://localhost/api/integrazione/protocollo/test \
  -H "Authorization: Bearer <token>"
```

Risposta attesa: `{"ok": true, "detail": "Connessione OK"}`.

Se il sistema esterno non espone un endpoint `/ping`, verificare manualmente con una richiesta di prova.

### 4.3 Verifica dell'invio automatico

Quando un atto viene pubblicato all'Albo nella piattaforma, TrasParentIA chiama automaticamente `POST <ALBO_ESTERNO_URL>/pubblica`. Il numero di albo assegnato viene registrato nell'atto. Testare il flusso completo con un atto di prova.

---

## 5. Caricamento beni reali in inventario

### 5.1 Preparare il CSV

Usare il template in `platform/scripts/beni_template.csv` come riferimento.

**Colonne obbligatorie:** `tipo`, `categoria`, `denominazione`  
**Colonne opzionali:** `ubicazione`, `codice`, `stato` (buono|discreto|scarso|critico), `responsabile`  
**Colonne extra:** qualsiasi altra colonna viene salvata nel campo `dati` (JSON) del bene

Valori tipici per `tipo`: `immobile`, `mobile`, `infrastruttura`  
Valori tipici per `categoria`: `edificio_pubblico`, `area_verde`, `veicolo`, `strada`, `rete_idrica`, `impianto`, `altro`

### 5.2 Importare tramite API

```bash
curl -X POST http://localhost/api/beni/import-csv \
  -H "Authorization: Bearer <token>" \
  -F "file=@beni_comunali.csv"
```

Risposta:
```json
{"importati": 142, "errori": 3, "dettaglio_errori": [...]}
```

Correggere gli errori nel CSV e reimportare le righe problematiche (duplicati non creati in automatico — impostare `codice` univoco per idempotenza manuale).

### 5.3 Verificare in inventario

Aprire il modulo **Inventario beni** nell'interfaccia e verificare che i beni siano visibili, con QR code generato automaticamente.

---

## 6. Checklist di completamento P4

- [ ] PEC istituzionale configurata e collegata (`diagnostica/test/imap` → OK)
- [ ] Primo polling PEC riuscito (comunicazioni visibili nell'Inbox)
- [ ] Backlog PEC storiche importato (lotti Import chiusi)
- [ ] Golden set compilato su ≥ 50 comunicazioni reali
- [ ] Accuratezza classificazione ≥ 80% (o piano di miglioramento documentato)
- [ ] `SOGLIA_CONFIDENZA_BASSA` aggiornata nel `.env` in base ai risultati
- [ ] Integrazioni esterne testate (o documentate come "non applicabili" per questo Comune)
- [ ] Beni reali caricati in inventario
- [ ] Segnalazioni operative portate al Referente ICT e al Segretario Comunale

**Quando tutti i punti sono spuntati, procedere con P5 (formazione + collaudo + cutover).**
