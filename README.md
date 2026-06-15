# TrasParentIA Micro PA — Piattaforma (primo incremento)

Fetta verticale funzionante del flusso **Ufficio Tecnico**: dalla PEC in ingresso alla
classificazione AI, presa in carico, lavorazione della pratica, assistente atti e cruscotto.
Stack on-prem, eseguibile con **Docker Desktop**.

## Stack

- **Frontend**: React + Vite, servito da nginx (ricrea il design del prototipo, Bootstrap Italia / Titillium Web).
- **Backend**: FastAPI (Python 3.12).
- **Database**: PostgreSQL 16 (immagine `pgvector/pgvector` — l'estensione vettoriale è pronta per la ricerca semantica nei prossimi incrementi).
- **Storage documenti**: **MinIO** (S3-compatibile) — console su http://localhost:9101.
- **Parsing/OCR**: pypdf + **Tesseract** (italiano) + poppler per le scansioni.
- **AI**: client verso **Ollama** su server esterno (configurabile), con fallback se non raggiungibile.

## Avvio

```bash
cd platform
cp .env.example .env     # opzionale: personalizza ente e server AI
docker compose up -d --build
```

Aperture (le porte host 8000/8080 sono spesso occupate, quindi si usano 8008/8099):

- **Interfaccia**: http://localhost:8099
- **API + documentazione OpenAPI**: http://localhost:8008/docs

Per cambiare le porte, modificare la sezione `ports:` in `docker-compose.yml`.

## Configurazione del server AI esterno

L'AI (Ollama) gira su un server dedicato esterno. Impostare in `.env`:

```
OLLAMA_BASE_URL=https://<ip-o-host-del-server-ai>     # es. https://192.168.1.10
AI_API_KEY=<chiave-se-il-reverse-proxy-la-richiede>    # header X-API-Key
AI_MODEL_GEN=qwen2.5:7b-instruct                       # modello per classificazione/sintesi
AI_MODEL_DRAFT=qwen2.5:14b-instruct                    # modello per l'editor di redazione (opzionale, default AI_MODEL_GEN)
```

Poi `docker compose up -d backend`. Senza un server AI raggiungibile la piattaforma
funziona comunque: usa le classificazioni già presenti nei dati (la classificazione *live*
e la generazione bozze AI si attivano quando il server è configurato). Lo stato del
collegamento è visibile su `GET /api/ai/status`.

## Ruoli (demo)

In alto a destra si cambia ruolo (RBAC applicato dal backend):

**Protocollo**
- **Maria Rossi** — Operatore protocollo (classifica, prende in carico, smista)
- **Dott.ssa Bianchi** — Segretario (supervisione, cruscotto completo)

**Istruttori**
- **Geom. Esposito** — Responsabile Ufficio Tecnico (lavora, genera bozze)
- **Geom. De Luca** — Istruttore tecnico (istruttoria, bozze)

**Responsabili di ufficio**
- **Rag. Ferrara** — Ragioneria / Tributi (IMU, TARI, liquidazioni)
- **Dott. Russo** — Anagrafe e Stato Civile (demografici, residenza)
- **Comm. Moretti** — Polizia Locale (viabilità, sanzioni, SUAP)
- **A.S. Ricci** — Servizi Sociali (contributi, SAD, welfare)

## Flusso dimostrabile

1. **Comunicazioni** → apri una PEC → vedi la **classificazione AI** (categoria, confidenza, motivazione, alternative, documenti attesi).
2. **Prendi in carico** (eventuale override tracciato) → si apre la **Pratica** con numero di protocollo.
3. **Pratica** → avanzamento stati, **richiesta integrazione** (sospende i termini), **assistente atti** (bozze), tracciabilità.
4. **Cruscotto** → indicatori in tempo reale; **Scadenziario** → pratiche per stato/scadenza.

## Cosa è incluso / prossimi incrementi

Incluso: PEC/classificazione (8.1/8.2), scadenziario (8.3), AI assistiva atti (8.4),
cruscotto (8.5), sicurezza/RBAC e tracciabilità (8.6), registro Atti e Inventario beni con QR (8.7),
e **Fase 4** — collegamento documenti: ingestione **PEC via IMAP** (configurabile), **inserimento
manuale assistito** (upload → storage MinIO → estrazione testo/OCR → classificazione AI),
gestione eccezioni di parsing.

E **ricerca ibrida** (5.9): la barra di ricerca in alto cerca su comunicazioni, pratiche, atti
e documenti. Modalità **testuale** (sempre attiva, multi-termine) + **semantica con pgvector**
quando il server AI espone un modello di embedding (`AI_MODEL_EMBED`, default `nomic-embed-text`,
768 dimensioni — vedi `EMBED_DIM`). Con embedding assenti il sistema usa la ricerca testuale e
offre il pulsante "Genera indice semantico" (richiede AI raggiungibile).

Configurazione PEC (in `.env`): `PEC_HOST`, `PEC_PORT`, `PEC_USER`, `PEC_PASSWORD`, `PEC_FOLDER`.
Senza queste variabili il pulsante "Sincronizza PEC" segnala che la casella non è configurata.

E **editor di redazione atti**: in ogni atto in stato *bozza* o *in revisione*, il pulsante
"Modifica testo" apre l'editor inline con textarea auto-crescente. Il pulsante "Rigenera con AI"
invia le istruzioni di revisione al server AI (`AI_MODEL_DRAFT`) e propone il testo nell'editor
senza salvare — verifica e conferma con "Salva testo". Ogni modifica è tracciata in cronologia.

E **autenticazione Keycloak** (Fase 7): login reale con SSO, JWT RS256, PKCE. Abilitabile con
`KC_AUTH_ENABLED=true` in `.env` e avviando il servizio `keycloak` nel compose (vedi sotto).

## Struttura

```
platform/
  docker-compose.yml
  .env.example
  backend/    FastAPI: models, seed, reference (16 categorie/9 stati), ai/ (Ollama), api.py
  frontend/   React+Vite: shell, viste (Inbox, Comunicazione, Pratica, Scadenziario, Cruscotto)
```

## Configurazione & diagnostica dei servizi (Fase 3+7)

La voce **Configurazione** in sidebar apre una pagina di diagnostica che mostra lo stato live di tutti i servizi di connessione on-prem e permette di **provare ogni connessione** con un clic:

| Servizio | Verifica |
|---|---|
| **Server AI (Ollama)** | server online + modello presente |
| **PEC in entrata (IMAP)** | login, cartella, conteggio messaggi |
| **Posta in uscita (SMTP/PEC)** | handshake + login (senza inviare) |
| **Storage (MinIO)** | bucket raggiungibile |
| **Database (PostgreSQL)** | query di prova |
| **Autenticazione (Keycloak)** | realm + chiavi JWKS |

I valori di configurazione sono mostrati in **sola lettura con i segreti mascherati**. Le azioni amministrative (riservate al **Segretario**, permesso `supervisione`):

- **Prova posta in uscita**: invia un'email di test per validare SMTP/PEC.
- **Backup database**: esegue un `pg_dump` (Postgres) o copia il file (SQLite) nella cartella `BACKUP_DIR` (volume `backupdata`); elenca i backup esistenti.

Configurazione SMTP in `.env` (necessaria perché i promemoria della Fase 6 vengano recapitati via email):
```
SMTP_HOST=smtp.pec.esempio.it
SMTP_PORT=587
SMTP_USER=protocollo@pec.comune.roccadaspide.sa.it
SMTP_PASSWORD=...
SMTP_FROM=protocollo@pec.comune.roccadaspide.sa.it
NOTIFICHE_EMAIL_ENABLED=true     # abilita il recapito email dei promemoria
```

## Promemoria scadenze e notifiche (Fase 6)

All'avvio il backend controlla automaticamente le pratiche aperte e genera notifiche persistenti per:

- Scadenza tra **7, 3 o 1 giorno/i** (soglie configurabili)
- Pratiche **in ritardo** (scadenza superata)

Il controllo si ripete ogni 6 ore (configurabile). Le notifiche sono visibili cliccando la **campanella** nella topbar: il badge mostra quelle non lette, "Segna tutto letto" le azzera in un clic.

Il **Cruscotto** mostra un **banner rosso** se ci sono pratiche in ritardo o che scadono entro 3 giorni, e una **sezione Report** (settimanale/mensile) con: pratiche aperte, aperte/concluse nel periodo, in ritardo, tempo medio di conclusione, distribuzione per ufficio.

Se SMTP è configurato e `NOTIFICHE_EMAIL_ENABLED=true`, ad ogni ciclo lo scheduler recapita anche un **digest email** al responsabile con le scadenze del giorno (vedi Fase 3+7).

Configurazione in `.env`:
```
NOTIFICHE_ENABLED=true          # default: true
PROMEMORIA_SOGLIE=7,3,1         # giorni prima della scadenza
SCHEDULER_INTERVAL_HOURS=6      # frequenza controllo (ore)
```

## Autenticazione Keycloak (Fase 7)

Per default la piattaforma usa il **role-switch demo** (nessun login reale). Per attivare Keycloak:

```bash
# 1. Abilitare KC nel .env
echo "KC_AUTH_ENABLED=true" >> .env

# 2. Avviare il compose (include il servizio keycloak)
docker compose up -d

# 3. Attendere ~30s che Keycloak si avvii e importi il realm
# Console admin: http://localhost:8091  (admin / admin)
```

Utenti pre-configurati nel realm `trasparentia` (password: `comune2026!`):

| Username | Ruolo | Permessi |
|---|---|---|
| `rossi` | Operatore protocollo | classifica, protocolla |
| `esposito` | Responsabile UT | lavora pratiche, genera bozze |
| `deluca` | Istruttore tecnico | istruttoria, bozze |
| `bianchi` | Segretario | supervisione, riassegna |

Con `KC_AUTH_ENABLED=false` (default) si torna alla modalità demo.

## Documentazione

| Documento | Contenuto |
|---|---|
| [`docs/TrasParentIA_Flussi_Uffici.md`](docs/TrasParentIA_Flussi_Uffici.md) | Flussi lavorativi dettagliati dei 6 uffici: procedimenti, termini, atti finali, flussi inter-ufficio |
| [`P4_AVVIO_DATI_REALI.md`](P4_AVVIO_DATI_REALI.md) | Guida go-live dati reali (PEC reale, primo lotto, golden set) |
| [`P5_COLLAUDO_CUTOVER.md`](P5_COLLAUDO_CUTOVER.md) | Collaudo end-to-end e cutover in produzione |
| [`BACKUP.md`](BACKUP.md) | Backup, ripristino e disaster recovery |
| [`MANUALE_UTENTE.md`](MANUALE_UTENTE.md) | Manuale operativo per il personale comunale |

## Comandi utili

```bash
docker compose ps            # stato servizi
docker compose logs -f backend
docker compose down          # ferma
docker compose down -v       # ferma e azzera il DB (ricarica il seed al riavvio)
```
