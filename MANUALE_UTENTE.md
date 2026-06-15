# Manuale Utente — TrasParentIA Micro PA
**Versione P5 · Comune di [NOME COMUNE]**

---

## Come accedere alla piattaforma

Aprire il browser e navigare all'indirizzo fornito dal Referente ICT (es. `http://192.168.1.20`).

- **Demo / sviluppo**: selezionare il proprio ruolo dal menu a tendina in alto a destra.
- **Produzione (Keycloak attivo)**: inserire le credenziali assegnate dall'amministratore.

Al primo accesso, comunicare al Referente ICT eventuali problemi di accesso.

---

## Ruoli e funzioni

| Ruolo | Chi è | Cosa può fare |
|-------|-------|---------------|
| **Operatore Protocollo** | Addetto alla ricezione PEC e protocollazione | Legge le comunicazioni in arrivo, avvia pratiche, protocolla |
| **Istruttore** | Tecnico/funzionario che istruisce le pratiche | Lavora le pratiche assegnate, redige gli atti, allega documenti |
| **Responsabile di Ufficio** | Responsabile di un ufficio (Tecnico, Tributi, Anagrafe, Polizia Locale, Servizi Sociali) | Firma gli atti, chiude pratiche, gestisce il flusso del proprio ufficio |
| **Segretario** | Segretario Comunale | Accesso completo: supervisione, gestione utenti, configurazione |

---

## Uffici e flussi documentali

La piattaforma modella **6 uffici** comunali. Ogni ufficio gestisce determinate categorie documentali: quando l'AI classifica una comunicazione in arrivo, propone automaticamente l'**ufficio competente** in base a questa mappa. La pagina **Uffici e flussi** (menu *Sistema*) mostra per ciascun ufficio le categorie gestite, i procedimenti tipici con il **termine di legge** e l'**atto finale** prodotto.

| Ufficio | Prefisso | Gestisce (categorie) | Procedimenti tipici |
|---------|----------|----------------------|---------------------|
| **Segreteria / Protocollo** | SG | Comunicazioni da PA, accesso atti, pubblicazioni, urgenze | Accesso documentale (30gg), Accesso civico/FOIA (30gg), Albo Pretorio, Delibere |
| **Ufficio Tecnico** | UT | Pratiche tecniche, segnalazioni | Permesso di Costruire (90gg), SCIA (30gg), Aut. paesaggistica (60gg), CDU (30gg), Ordinanza urgente |
| **Ragioneria / Tributi** | TR | Richieste tributi, documenti contabili | Rimborso IMU/TARI (180gg), Rateizzazione, Autotutela, Liquidazione fattura (30gg), Impegno di spesa |
| **Anagrafe e Stato Civile** | AN | Richieste anagrafiche | Certificazioni, Cambio residenza (45gg), CIE, Atti stato civile, Liste elettorali |
| **Polizia Locale** | PL | Reclami/esposti, ordinanze | Sanzioni CdS (90gg), Ordinanze viabilità (10gg), Esposti (30gg), Accertamenti, SCIA SUAP (60gg) |
| **Servizi Sociali** | SS | Istanze dei cittadini | Contributo economico ISEE (60gg), Assegno maternità (180gg), Assistenza domiciliare, Bonus sociali |

> Lo smistamento proposto dall'AI è sempre **modificabile** dall'operatore di protocollo in fase di presa in carico. Il prefisso identifica l'ufficio nel numero di pratica (es. `TR/2026/012`).

---

## 1. Operatore Protocollo

### 1.1 Leggere le comunicazioni in arrivo

1. Dal menu laterale scegliere **Inbox**.
2. Le comunicazioni non lette sono evidenziate in grassetto.
3. Fare clic su una comunicazione per aprirla.
4. La scheda mostra: mittente, oggetto, testo estratto (OCR se allegato PDF), e la **classificazione AI** proposta (categoria + percentuale di certezza).

> **Attenzione confidenza bassa**: se la barra di certezza è arancione/rossa (< 60%), la classificazione AI è incerta — verificare manualmente prima di procedere.

### 1.2 Avviare una pratica da una comunicazione

1. Aprire la comunicazione.
2. Fare clic su **Avvia pratica**.
3. Verificare la categoria pre-compilata dall'AI e correggerla se necessario.
4. Assegnare l'ufficio e il responsabile.
5. Impostare la scadenza (il sistema la suggerisce in base al tipo di procedimento).
6. Fare clic su **Crea pratica**.

La comunicazione viene collegata alla pratica e il numero di protocollo viene assegnato automaticamente.

### 1.3 Importazione massiva (backlog PEC storiche)

1. Dal menu scegliere **Importazione**.
2. Fare clic su **Nuovo lotto** e assegnare un nome descrittivo.
3. Trascinare i file PDF/EML nella zona di caricamento.
4. Fare clic su **Classifica con AI** per classificare tutti i file del lotto.
5. Revisionare le classificazioni a bassa certezza (icona arancione).
6. Applicare o scartare ogni item.
7. Fare clic su **Chiudi lotto** quando tutti gli item sono stati processati.

---

## 2. Istruttore UT

### 2.1 Lavorare una pratica assegnata

1. Dal **Cruscotto** fare clic sulla pratica da lavorare, oppure andare in **Pratiche** e filtrare per stato "assegnata".
2. Nella scheda pratica fare clic su **Prendi in carico** — la pratica passa in stato "In lavorazione".
3. Leggere i documenti allegati (scheda **Documenti**).
4. Usare la scheda **Note interne** per annotare l'istruttoria.

### 2.2 Redigere un atto con supporto AI

1. Nella scheda pratica fare clic su **Nuovo atto**.
2. Selezionare il tipo (determina, ordinanza, comunicazione...).
3. Fare clic su **Genera bozza AI** — la piattaforma propone un testo sulla base del procedimento.
4. **Leggere e correggere il testo**: la bozza AI è un punto di partenza, non un testo definitivo. Il funzionario è sempre responsabile del contenuto.
5. Salvare come bozza (**Salva**) o inviare per la firma (**Invia a firma**).

> **Nota AI Act art. 50**: quando si stampa un atto generato con supporto AI, la dicitura di legge appare automaticamente in calce.

### 2.3 Consultare lo scadenziario

Dal menu scegliere **Scadenziario** per vedere tutte le pratiche con scadenza imminente (7/3/1 giorni). Le pratiche in ritardo sono evidenziate in rosso.

### 2.4 Ricerca semantica

Il modulo **Ricerca** permette di cercare per testo libero tra tutte le comunicazioni e i documenti indicizzati. La ricerca usa il modello AI di embedding (on-prem).

---

## 3. Responsabile UT

Il Responsabile UT ha gli stessi accessi dell'Istruttore, con in più la possibilità di **firmare e pubblicare gli atti**.

### 3.1 Firmare un atto

1. Dal **Cruscotto** fare clic su **Da firmare** per vedere gli atti in attesa.
2. Aprire l'atto, leggere attentamente il testo.
3. Se corretto fare clic su **Firma e pubblica**.
4. L'atto passa in stato "Pubblicato" e, se l'integrazione con l'albo pretorio è configurata, viene inviato automaticamente all'albo esterno.

### 3.2 Chiudere una pratica

1. Aprire la pratica.
2. Verificare che tutti gli atti necessari siano firmati.
3. Fare clic su **Concludi pratica** — lo stato diventa "Conclusa".
4. Per archiviare definitivamente: **Archivia**.

---

## 4. Segretario Comunale

Il Segretario ha accesso completo a tutti i moduli.

### 4.1 Supervisione e statistiche

Il **Cruscotto** mostra il riepilogo dell'attività: pratiche aperte per categoria, pratiche in ritardo, ultime comunicazioni.

### 4.2 Gestione utenti

1. Dal menu laterale scegliere **Gestione utenti** (sezione *Sistema*).
2. Per aggiungere un utente: fare clic su **Nuovo utente** e compilare il form (username, nome, email, ufficio, ruolo, colore avatar).
3. Per modificare un utente esistente: fare clic su **Modifica**; per revocare l'accesso senza eliminare il profilo, **Sospendi** (riattivabile in seguito).
4. In produzione (Keycloak attivo): il pulsante **Console Keycloak** apre l'amministrazione del realm per creare le credenziali e assegnare il ruolo corrispondente.

> Per la sincronizzazione con Keycloak (produzione), il ruolo assegnato qui deve corrispondere al ruolo nel realm Keycloak.

### 4.3 Configurazione piattaforma

1. Dal menu scegliere **Impostazioni → Configurazione**.
2. Verificare le soglie di confidenza AI, le categorie attive, i dati dell'ente.
3. Fare clic su **Salva** per applicare le modifiche (senza riavvio).

### 4.4 Calibrazione AI

Il modulo **Calibrazione AI** (sezione *Sistema*) misura l'accuratezza della classificazione automatica e suggerisce la soglia di confidenza.

1. Scegliere il **criterio di campionamento** (consigliato: *priorità a bassa confidenza*) e la **dimensione del campione**.
2. Per ogni comunicazione la categoria proposta dall'AI è già pre-selezionata: correggere solo dove l'AI ha sbagliato tramite la tendina **Categoria corretta**.
3. Fare clic su **Valuta accuratezza**: la piattaforma calcola l'accuratezza totale, il dettaglio per categoria e la **soglia di confidenza suggerita**.
4. Se l'accuratezza è sotto il target (80%), impostare in **Configurazione** la soglia suggerita (`SOGLIA_CONFIDENZA_BASSA`): le classificazioni meno sicure verranno inviate a revisione manuale.

### 4.5 Inventario beni

Il modulo **Inventario** elenca i beni comunali (immobili, mobili, infrastrutture) con stato e QR code. Per importare un lotto di beni da foglio di calcolo:

1. Esportare il foglio in formato **CSV** con le colonne obbligatorie `tipo, categoria, denominazione` (opzionali: `ubicazione, codice, stato, responsabile`).
2. Nell'Inventario fare clic su **Importa CSV** e selezionare il file.
3. Al termine un riepilogo indica i beni importati e le eventuali righe scartate (con il numero di riga in errore).

> Template di esempio in `platform/scripts/beni_template.csv` (vedi P4_AVVIO_DATI_REALI.md §5).

### 4.6 Diagnostica e backup

- **Diagnostica**: `Impostazioni → Diagnostica` — mostra lo stato di tutti i servizi (DB, MinIO, AI, PEC).
- **Backup**: Il backup restic è automatico ogni 24h. Per verificare l'ultimo snapshot:
  ```bash
  docker compose exec restic-backup restic snapshots
  ```
  Per la procedura di restore completa, consultare `platform/BACKUP.md`.

---

## Domande frequenti

**La classificazione AI propone una categoria sbagliata — cosa faccio?**
Correggere manualmente la categoria prima di avviare la pratica. L'AI è un supporto, la decisione finale spetta sempre al funzionario. Se gli errori sono frequenti, il Segretario può usare **Calibrazione AI** per misurare l'accuratezza e alzare la soglia di confidenza (§4.4).

**Ricevo l'errore "Autenticazione richiesta".**
Verificare di essere correttamente loggati. In produzione, il token Keycloak dura 30 minuti: aggiornare la pagina per rinnovarlo.

**Non vedo le PEC nuove.**
Il polling è automatico ogni 10 minuti. Se le PEC non arrivano, verificare con il Referente ICT che il servizio Celery sia attivo (`docker compose ps`).

**Come cambio la mia password?**
In produzione (Keycloak): navigare al portale Keycloak (`http://<server>:8091`) → Account → Password. Contattare l'amministratore se necessario.

---

*Supporto tecnico: Referente ICT del Comune · Per problemi al software contattare il fornitore.*
