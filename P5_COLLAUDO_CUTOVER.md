# P5 — Collaudo, formazione e cutover
## TrasParentIA Micro PA

**Prerequisiti:** P4 completato (PEC collegata, golden set validato, beni importati).  
**Durata stimata:** 1–2 settimane.

---

## 1. Suite di test automatici (smoke test)

### 1.1 Eseguire i test

```bash
cd platform/backend
pip install -r requirements-dev.txt
pytest tests/ -v
```

**Output atteso:**

```
tests/test_api_flows.py::test_health PASSED
tests/test_api_flows.py::test_auth_config_disabled PASSED
tests/test_api_flows.py::test_unauth_rejected PASSED
tests/test_api_flows.py::test_meta PASSED
tests/test_api_flows.py::test_cruscotto PASSED
...
```

Tutti e 19 i test devono passare. Se un test fallisce, consultare il traceback e correggere prima di procedere con il collaudo manuale.

### 1.2 Criteri di accettazione tecnica

- [ ] `pytest tests/ -v` → 0 errori, 0 failure
- [ ] Nessuna regressione su `GET /health`, auth, liste principali
- [ ] Import CSV beni: riga valida importata, riga con campo mancante rigettata correttamente
- [ ] Golden set campione restituisce lista e valuta accuratezza

---

## 2. Piano di collaudo funzionale (E2E)

Eseguire questi scenari **su ambiente di staging** (o su produzione con dati di prova prima del go-live).

### Scenario A — Ricezione e protocollazione PEC

| Passo | Attore | Azione | Risultato atteso |
|-------|--------|--------|-----------------|
| A1 | Operatore Protocollo | Invia una PEC di prova alla casella istituzionale | — |
| A2 | Sistema | Polling automatico (max 10 min) | PEC compare in Inbox |
| A3 | Operatore Protocollo | Apre la comunicazione | Testo estratto leggibile, categoria AI proposta |
| A4 | Operatore Protocollo | Verifica/corregge categoria, avvia pratica | Pratica creata con numero protocollo univoco |
| A5 | Sistema | Cruscotto aggiornato | Pratica visibile in "Da lavorare" |

### Scenario B — Istruttoria e redazione atto

| Passo | Attore | Azione | Risultato atteso |
|-------|--------|--------|-----------------|
| B1 | Istruttore UT | Prende in carico la pratica da A4 | Stato → "In lavorazione" |
| B2 | Istruttore UT | Clicca "Genera bozza AI" su nuovo atto tipo "Determina" | Testo bozza generato entro 30 s |
| B3 | Istruttore UT | Corregge il testo, salva bozza | Bozza salvata con versioning |
| B4 | Istruttore UT | Clicca "Invia a firma" | Atto passa in stato "Pronto firma" |
| B5 | Responsabile UT | Vede l'atto in "Da firmare" nel cruscotto | Notifica / alert presente |
| B6 | Responsabile UT | Firma e pubblica | Atto → "Pubblicato", numero determina assegnato |
| B7 | Responsabile UT | Chiude la pratica | Pratica → "Conclusa" |

### Scenario C — Stampa con marcatura AI Act

| Passo | Attore | Azione | Risultato atteso |
|-------|--------|--------|-----------------|
| C1 | Qualsiasi | Apre un atto con `generatoAI=true` | — |
| C2 | Qualsiasi | Clicca "Stampa" (o Ctrl+P) | Anteprima di stampa mostra la dicitura art. 50 AI Act / L.132/2025 in calce |
| C3 | Qualsiasi | Stampa un atto senza AI | Dicitura NON presente |

### Scenario D — Accesso tastiera (WCAG)

| Passo | Attore | Azione | Risultato atteso |
|-------|--------|--------|-----------------|
| D1 | Tester accessibilità | Naviga Inbox solo con Tab + Invio | Tutte le comunicazioni apribili da tastiera |
| D2 | Tester accessibilità | Naviga Pratiche, Cruscotto, Inventario | Nessun elemento cliccabile inaccessibile da tastiera |

### Scenario E — Backup e restore (gate P2)

| Passo | Attore | Azione | Risultato atteso |
|-------|--------|--------|-----------------|
| E1 | Referente ICT | `docker compose exec restic-backup restic snapshots` | Almeno uno snapshot presente |
| E2 | Referente ICT | Segue procedura BACKUP.md §Scenario A | Restore completato, dati verificati |
| E3 | Referente ICT | Annotare RTO effettivo | RTO ≤ 15 min |

### Scenario F — Keycloak (gate P2)

| Passo | Attore | Azione | Risultato atteso |
|-------|--------|--------|-----------------|
| F1 | Segretario | Imposta `KC_AUTH_ENABLED=true`, riavvia backend | — |
| F2 | Segretario | Apre la piattaforma | Redirect a login Keycloak |
| F3 | Segretario | Accede con credenziali Keycloak | Login riuscito, ruolo corretto mostrato |
| F4 | Segretario | Tenta accesso con X-Role header via curl | Risposta 401 (header non accettato in modalità KC) |

---

## 3. Formazione del personale

Vedi `compliance/P3_Governance/Piano_Formazione.md` per il programma completo.

### Checklist formazione pre-cutover

- [ ] **Modulo BASE (2h)**: tutti gli utenti — obiettivi piattaforma, navigazione, accesso
- [ ] **Modulo CLASSIFICAZIONE (1h)**: operatori protocollo — lettura classificazioni, correzione manuale
- [ ] **Modulo PRATICHE (2h)**: istruttori e responsabili — flusso completo pratica → atto → firma
- [ ] **Modulo SUPERVISIONE (1-2h)**: segretario e responsabili — cruscotto, statistiche, golden set
- [ ] **Modulo TECNICO (3h)**: Referente ICT — backup, aggiornamenti, diagnostica, Keycloak

Tenere verbale delle sessioni di formazione (data, partecipanti, firma).

---

## 4. Checklist cutover (go-live)

### 4.1 Gate P2 — OBBLIGATORI prima del go-live

- [ ] `KC_AUTH_ENABLED=true` in `.env` — Keycloak attivo
- [ ] Nessuna credenziale di default (verificare con `scripts/gen-env.sh` o manualmente)
- [ ] `POSTGRES_PASSWORD` ≠ `CAMBIA_QUESTA_PASSWORD_DB`
- [ ] `MINIO_SECRET_KEY` ≠ `CAMBIA_QUESTA_CHIAVE_MINIO`
- [ ] `KC_ADMIN_PASSWORD` ≠ `CAMBIA_QUESTA_PASSWORD_KC`
- [ ] `RESTIC_PASSWORD` ≠ `CAMBIA_QUESTA_CHIAVE_RESTIC`
- [ ] Backup testato con restore (Scenario E superato, RTO documentato)

### 4.2 Gate P3 — Compliance

- [ ] DPIA firmata dal DPO e dal titolare del trattamento
- [ ] Informativa cittadini pubblicata sul sito istituzionale
- [ ] Policy Uso Responsabile AI adottata con delibera/determina
- [ ] DPA firmato con il fornitore (se applicabile)
- [ ] Formazione completata per tutti i ruoli (verbali presenti)

### 4.3 Gate P4 — Dati reali

- [ ] PEC istituzionale collegata e polling attivo
- [ ] Accuratezza golden set ≥ 80% (o piano di miglioramento documentato)
- [ ] `SOGLIA_CONFIDENZA_BASSA` calibrata e impostata nel `.env`
- [ ] Beni comunali importati e verificati in inventario

### 4.4 Gate P5 — Collaudo

- [ ] Suite smoke test: 0 failure
- [ ] Scenari A–F superati (firmare ogni riga della tabella)
- [ ] Formazione completata (verbali firmati)
- [ ] MANUALE_UTENTE.md distribuito a tutti gli utenti

### 4.5 Operazioni di cutover (sequenza)

1. **Comunicare la data di go-live** al personale con almeno 5 giorni di anticipo.
2. **Finestra di manutenzione** (es. venerdì sera dopo le 18:00):
   ```bash
   # 1. Forzare un backup prima del cutover
   docker compose exec restic-backup restic backup /data/backup --tag pre-cutover
   # 2. Impostare KC_AUTH_ENABLED=true in .env
   # 3. Riavviare i servizi
   docker compose down && docker compose up -d
   # 4. Verificare che tutti i container siano healthy
   docker compose ps
   ```
3. **Smoke test rapido in produzione**:
   ```bash
   curl http://localhost/health
   curl http://localhost/api/auth/config
   ```
4. **Verifica login con utente reale**: un operatore si autentica via Keycloak.
5. **Dichiarare il go-live** e avviare il presidio post go-live (§5).

---

## 5. Presidio post go-live (prime 2 settimane)

### 5.1 Monitoraggio giornaliero (Referente ICT)

```bash
# Stato servizi
docker compose ps

# Log backend (errori nelle ultime 4 ore)
docker compose logs backend --since 4h | grep -E "ERROR|CRITICAL|Exception"

# Spazio disco (backup + DB)
df -h

# Snapshot backup
docker compose exec restic-backup restic snapshots --last
```

### 5.2 Soglie di allerta

| Metrica | Soglia | Azione |
|---------|--------|--------|
| Errori backend nell'ultima ora | > 10 | Verificare log, notificare fornitore |
| Risposta `/health` | ≠ 200 | Riavviare backend: `docker compose restart backend` |
| Spazio disco | < 20% libero | Aggiungere storage o spostare vecchi backup |
| Pratiche in ritardo | > 20% del totale aperte | Segnalare ai Responsabili UT |
| Accuratezza AI (dopo 1 settimana) | < 70% | Ripetere golden set e ricalibrare soglia |

### 5.3 Raccolta feedback (prima settimana)

Raccogliere feedback dagli utenti su:
- Qualità classificazione AI (categorie spesso errate?)
- Velocità di generazione bozze (accettabile?)
- Problemi di usabilità (cosa non è chiaro nel manuale?)

Portare i feedback alla **riunione di verifica post go-live** (entro 7 giorni dal cutover).

### 5.4 Revisione golden set dopo 1 mese

Dopo 4 settimane di utilizzo reale:
1. Estrarre un nuovo campione di 100 comunicazioni classificate.
2. Far verificare manualmente le classificazioni a un operatore esperto.
3. Rivalutare con `POST /api/golden-set/valuta`.
4. Se accuratezza < 80%: rivedere categorie o modello AI.
5. Aggiornare `SOGLIA_CONFIDENZA_BASSA` in `.env` e riavviare.

---

## 6. Criteri di accettazione complessivi P5

- [ ] Test automatici: 0 failure
- [ ] Scenari E2E A–F: tutti superati
- [ ] Gate P2 (sicurezza): tutti spuntati
- [ ] Gate P3 (compliance): tutti spuntati
- [ ] Formazione: tutti i moduli completati, verbali firmati
- [ ] RTO backup documentato (≤ 15 min)
- [ ] Presidio post go-live attivo per 2 settimane

**Quando tutti i criteri sono soddisfatti, TrasParentIA Micro PA è in produzione.**

---

*Referente ICT: [NOME E CONTATTO]*  
*Data cutover pianificata: [DATA]*  
*Firma Segretario Comunale: ______________________________*
