# TrasParentIA Micro PA — Flussi lavorativi degli uffici

> Roadmap di dettaglio che **determina i flussi lavorativi di ciascun ufficio** del Comune.
> Estende la `TrasParentIA_Roadmap_Implementazione.md` (piano demo → produzione) e la
> `TrasParentIA_Funzionamento_e_Flussi.md` (flusso generale), scendendo al livello del
> **singolo ufficio e del singolo procedimento**: chi fa cosa, in quale stato, con quale
> termine di legge, dove l'AI assiste e dove decide la persona.
>
> Il modello qui descritto è **ancorato al codice**: il catalogo uffici, i procedimenti, i
> termini e gli atti finali corrispondono uno-a-uno a `backend/app/reference.py` (`UFFICI`,
> `CAT_UFFICIO`, `ATTI_TIPI`, `STATI`) e agli utenti di `backend/app/utenti.py`.
>
> **Principio invariante:** l'AI classifica, sintetizza, propone bozze e segnala documenti
> mancanti. **Non decide, non assegna in via definitiva, non firma.** Ogni provvedimento è in
> capo al responsabile del procedimento.

---

## 1. La spina dorsale comune a tutti gli uffici

Ogni ufficio applica lo **stesso schema di lavorazione** (il flusso end-to-end della piattaforma),
istanziato sui propri procedimenti. Sette passaggi, mappati sui 9 stati pratica:

| # | Passaggio | Stato pratica | Chi agisce | Ruolo dell'AI |
|---|---|---|---|---|
| 1 | Ingestione PEC/istanza | `ricevuta` | Sistema (worker IMAP) | Estrazione testo + OCR allegati |
| 2 | Classificazione assistita | `da_classificare` | Operatore protocollo | Categoria + confidenza + ufficio + termine + completezza |
| 3 | Protocollazione e smistamento | `assegnata` | Operatore protocollo | Smistamento suggerito (override tracciato) |
| 4 | Istruttoria | `in_lavorazione` | Responsabile / Istruttore di ufficio | Sintesi, bozze, analisi completezza |
| 5 | Sospensioni eventuali | `in_attesa_integrazione` / `in_attesa_parere` | Responsabile di ufficio | Bozza richiesta integrazione/parere; **termini sospesi** |
| 6 | Predisposizione atto + firma | `pronta_firma` | Responsabile → firmatario | Bozza atto marcata "AI", sempre da verificare |
| 7 | Conclusione e pubblicità | `conclusa` → `archiviata` | Responsabile / Segreteria | — (numero atto, protocollo, Albo automatici) |

> La differenza tra un ufficio e l'altro **non è il flusso** ma il *contenuto*: le **categorie**
> instradate, i **procedimenti** con i rispettivi **termini di legge**, l'**atto finale** prodotto
> e il **firmatario competente**. Le sezioni 4–9 specializzano questo schema ufficio per ufficio.

### 1.1 Regole di visibilità (chi vede cosa)

La piattaforma applica un filtro per ruolo (`_prat_visibili` in `api.py`):

- **Segretario / supervisione** → vede **tutte** le pratiche e gli atti dell'ente.
- **Operatore protocollo** (hub, senza `lavora`) → vede **tutto** per poter smistare.
- **Responsabile / Istruttore di ufficio** (con `lavora`) → vede **solo** le pratiche del
  **proprio ufficio** o quelle di cui è **responsabile assegnato**, più gli atti collegati.

> Conseguenza operativa: ogni operatore di ufficio lavora una **coda pulita**, contenente solo
> ciò che il protocollo gli ha smistato o che gli è stato riassegnato. Il segretario mantiene la
> visione d'insieme dal Cruscotto.

## 2. Attori e matrice RBAC

| Utente | Ruolo (Keycloak) | Ufficio | classifica | prendiCarico | assegna | lavora | bozze | supervisione |
|---|---|---|---|---|---|---|---|---|
| Maria Rossi | operatore_protocollo | Segreteria / Protocollo | ✓ | ✓ | ✓ | — | — | — |
| Dott.ssa Anna Bianchi | segretario | Segreteria Generale | — | — | ✓ | — | — | ✓ |
| Geom. Luigi Esposito | responsabile_ut | Ufficio Tecnico | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Geom. Sara De Luca | istruttore | Ufficio Tecnico | — | ✓ | — | ✓ | ✓ | — |
| Rag. Carla Ferrara | responsabile_ufficio | Ragioneria / Tributi | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Dott. Marco Russo | responsabile_ufficio | Anagrafe e Stato Civile | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Comm. Anna Moretti | responsabile_ufficio | Polizia Locale | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| A.S. Lucia Ricci | responsabile_ufficio | Servizi Sociali | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| TrasParentIA | — (assistente) | — | proposta | — | — | — | proposta | — |

> Il **responsabile di ufficio** è anche, di norma, il **responsabile del procedimento** (L.
> 241/1990) e — dove non riservato a Sindaco/Giunta/Consiglio — il **firmatario** dell'atto finale.

## 3. Instradamento: dalla categoria all'ufficio

Il protocollo (assistito dall'AI) instrada ogni comunicazione all'ufficio competente in base alla
**categoria documentale**. Mappatura di default (`CAT_UFFICIO`):

| Categoria documentale | Ufficio competente |
|---|---|
| Comunicazione da altra PA, Accesso agli atti, Documento da pubblicare, Comunicazione urgente, Scadenza amministrativa | Segreteria / Protocollo |
| Pratica ufficio tecnico, Segnalazione | Ufficio Tecnico |
| Richiesta tributi, Documento contabile | Ragioneria / Tributi |
| Richiesta anagrafica | Anagrafe e Stato Civile |
| Reclamo, Ordinanza | Polizia Locale |
| Istanza cittadino | Servizi Sociali |

> L'instradamento è una **proposta**: l'operatore può correggerlo (override tracciato a
> cronologia). I casi a bassa confidenza espongono un banner ambra che invita alla verifica
> manuale, com'è giusto per documenti ambigui (es. un *dehors*: tecnico + tributario).

---

## 4. Ufficio: Segreteria / Protocollo — `SG`

**Responsabile:** Dott.ssa Anna Bianchi (Segretario) · **Operatività:** Maria Rossi (Operatore protocollo)
**Funzione:** Protocollo, affari generali, organi istituzionali, accesso agli atti e pubblicità legale.
**Categorie gestite:** comunicazione da altra PA, accesso agli atti, da pubblicare, comunicazione urgente, scadenza amministrativa.

È l'**hub di ingresso** dell'ente: riceve e smista *tutto*, e in proprio lavora gli affari
generali e la pubblicità legale.

| Procedimento | Termine | Norma | Atto finale |
|---|---|---|---|
| Accesso documentale | 30 gg | L. 241/1990 art. 22 | Risposta al cittadino |
| Accesso civico generalizzato (FOIA) | 30 gg | D.Lgs. 33/2013 art. 5 | Risposta al cittadino |
| Pubblicazione all'Albo Pretorio | 2 gg | D.Lgs. 33/2013 | Delibera |
| Protocollazione e smistamento | 1 gg | DPR 445/2000 | — (nessun atto) |
| Deliberazioni di Giunta e Consiglio | 15 gg | TUEL D.Lgs. 267/2000 | Delibera |

**Flusso tipico — Accesso agli atti (FOIA):**
1. PEC in ingresso → AI classifica *Accesso agli atti*, termine 30 gg, completezza (istanza + identità richiedente).
2. Rossi protocolla; competenza propria della Segreteria → `assegnata` a Bianchi.
3. Bianchi istruisce: individua i documenti, valuta controinteressati (eventuale `in_attesa_parere`).
4. L'Assistente atti redige la **bozza di risposta**; Bianchi verifica e porta a `pronta_firma`.
5. Risposta firmata, protocollata in uscita → `conclusa`.

> Particolarità: la Segreteria è l'**unico ufficio senza permesso `lavora`** sul versante
> protocollo (Rossi), ma con un **responsabile supervisore** (Bianchi) che istruisce gli affari
> generali e presidia il Cruscotto. La protocollazione è l'unico "procedimento" senza atto finale.

## 5. Ufficio Tecnico — `UT`

**Responsabile:** Geom. Luigi Esposito · **Istruttore:** Geom. Sara De Luca
**Funzione:** Edilizia privata, urbanistica, lavori pubblici, manutenzioni e patrimonio.
**Categorie gestite:** pratica ufficio tecnico, segnalazione.

È l'ufficio **già dimostrato end-to-end** nella demo (vedi esempi A/B/C della doc Flussi).

| Procedimento | Termine | Norma | Atto finale |
|---|---|---|---|
| Permesso di Costruire | 90 gg | DPR 380/2001 art. 20 | Determina |
| SCIA edilizia | 30 gg | DPR 380/2001 art. 23 | Comunicazione avvio procedimento |
| Autorizzazione paesaggistica | 60 gg | D.Lgs. 42/2004 art. 146 | Determina |
| Certificato destinazione urbanistica (CDU) | 30 gg | DPR 380/2001 art. 30 | Risposta al cittadino |
| Autorizzazione occupazione suolo / passo carrabile | 30 gg | D.Lgs. 285/1992 | Determina |
| Ordinanza contingibile e urgente | 2 gg | TUEL art. 54 | Ordinanza |

**Flusso tipico — Permesso di Costruire:**
1. Istanza con allegati → AI: *Pratica tecnica*, termine 90 gg, **analisi completezza** (relazione, elaborati, visura, diritti di segreteria, asseverazioni).
2. Smistamento a Esposito; presa in carico e `in_lavorazione` con De Luca come istruttore.
3. Documenti mancanti → **Richiedi integrazione** → `in_attesa_integrazione`, **termini sospesi** (banner ambra).
4. Pareri esterni (es. Genio Civile) → `in_attesa_parere`.
5. Istruttoria completa → bozza **Determina** di rilascio → `pronta_firma` → firma del responsabile → `conclusa`.

**Flusso d'urgenza — Muro pericolante (art. 54 TUEL):** segnalazione urgente → sopralluogo entro
48h → bozza **Ordinanza contingibile e urgente** → `pronta_firma` (firma del **Sindaco**) →
pubblicazione all'Albo. Continuità con l'Inventario beni (bene collegato e suo stato).

> Firmatario: il **responsabile di ufficio** per le determine; il **Sindaco** per le ordinanze
> contingibili e urgenti.

## 6. Ragioneria / Tributi — `TR`

**Responsabile:** Rag. Carla Ferrara
**Funzione:** Tributi locali (IMU, TARI, canone unico), bilancio, contabilità e liquidazioni.
**Categorie gestite:** richiesta tributi, documento contabile.

| Procedimento | Termine | Norma | Atto finale |
|---|---|---|---|
| Rimborso IMU / TARI | 180 gg | L. 296/2006 art. 1 c. 164 | Determina |
| Rateizzazione tributi | 30 gg | Reg. comunale entrate | Determina |
| Autotutela / sgravio | 90 gg | D.Lgs. 545/1992 | Determina |
| Liquidazione fattura | 30 gg | D.Lgs. 231/2002 | Determina |
| Impegno di spesa | 30 gg | TUEL art. 183 | Determina |

**Flusso tipico — Rimborso IMU:**
1. Istanza → AI: *Richiesta tributi*, termine 180 gg, completezza (versamenti, calcolo, IBAN).
2. Smistamento a Ferrara; `in_lavorazione`: verifica versamenti e posizione contributiva.
3. Documenti mancanti → integrazione; eventuale parere/visto contabile.
4. Bozza **Determina** di rimborso (con impegno/liquidazione) → `pronta_firma` → firma → `conclusa`.

> Tutti i procedimenti tributari sfociano in una **Determina** (atto monocratico del responsabile).
> Punto di attenzione conformità: i termini lunghi (180 gg) richiedono promemoria schedulati
> (Celery Beat, fase P1) per non perdere le scadenze.

## 7. Anagrafe e Stato Civile — `AN`

**Responsabile:** Dott. Marco Russo
**Funzione:** Servizi demografici: anagrafe, stato civile, elettorale, leva e carte d'identità.
**Categorie gestite:** richiesta anagrafica.

| Procedimento | Termine | Norma | Atto finale |
|---|---|---|---|
| Certificazioni anagrafiche | 1 gg | DPR 223/1989 | — (rilascio diretto) |
| Cambio di residenza / iscrizione APR | 45 gg | DPR 223/1989 art. 18-bis | Comunicazione avvio procedimento |
| Carta d'identità elettronica (CIE) | 6 gg | D.M. 23/12/2015 | — (rilascio diretto) |
| Atti di stato civile (nascita, matrimonio, morte) | 1 gg | DPR 396/2000 | — (rilascio diretto) |
| Iscrizione liste elettorali | 30 gg | DPR 223/1967 | Comunicazione avvio procedimento |

**Flusso tipico — Cambio di residenza:**
1. Istanza → AI: *Richiesta anagrafica*, termine 45 gg.
2. Russo registra in via provvisoria (2 gg) e avvia gli **accertamenti** (avvio procedimento).
3. **Accertamento alla Polizia Locale** → `in_attesa_parere` (termini sospesi) fino all'esito.
4. Esito positivo → iscrizione confermata → `conclusa`. (Esempio presente nel seed demo.)

> Molti procedimenti demografici sono a **rilascio diretto** (nessun atto formale, termini di 1
> giorno): il valore della piattaforma qui è la **tracciabilità** e l'eventuale interazione con
> altri uffici (es. accertamenti alla PL). Mostra la **collaborazione inter-ufficio** via stato
> `in_attesa_parere`.

## 8. Polizia Locale — `PL`

**Responsabile:** Comm. Anna Moretti
**Funzione:** Vigilanza, viabilità, sanzioni, esposti, accertamenti e SUAP.
**Categorie gestite:** reclamo, ordinanza.

| Procedimento | Termine | Norma | Atto finale |
|---|---|---|---|
| Sanzione amministrativa (Codice della Strada) | 90 gg | D.Lgs. 285/1992 | Ordinanza |
| Ordinanza viabilità e traffico | 10 gg | CdS art. 7 | Ordinanza |
| Gestione esposti e segnalazioni | 30 gg | L. 241/1990 | Risposta al cittadino |
| Accertamenti anagrafici per residenza | 45 gg | DPR 223/1989 | Nota ad altro ente |
| SCIA attività produttive (SUAP) | 60 gg | DPR 160/2010 | Comunicazione avvio procedimento |

**Flusso tipico — Esposto/Reclamo:**
1. Reclamo in ingresso → AI: *Reclamo*, termine 30 gg.
2. Smistamento a Moretti; `in_lavorazione` con **accertamenti sul posto** (presente nel seed demo).
3. Bozza **Risposta al cittadino** (o **Ordinanza** se viabilità) → `pronta_firma` → firma → `conclusa`.

**Flusso inter-ufficio:** gli **accertamenti anagrafici per residenza** producono una *Nota ad
altro ente* indirizzata all'Anagrafe — chiude il ciclo aperto al §7 (accertamenti richiesti da Russo).

> Le ordinanze di viabilità sono soggette a **pubblicità legale** (Albo Pretorio): il ciclo atto
> arriva fino a `pubblicato`.

## 9. Servizi Sociali — `SS`

**Responsabile:** A.S. Lucia Ricci
**Funzione:** Welfare e assistenza: contributi economici, domiciliarità, minori, anziani, disabilità.
**Categorie gestite:** istanza cittadino.

| Procedimento | Termine | Norma | Atto finale |
|---|---|---|---|
| Contributo economico straordinario (ISEE) | 60 gg | L. 328/2000 | Determina |
| Assegno di maternità / nucleo familiare | 180 gg | D.Lgs. 151/2001 | Determina |
| Assistenza domiciliare (SAD) | 30 gg | L. 328/2000 | Determina |
| Inserimento in struttura | 60 gg | L. 328/2000 | Determina |
| Bonus sociali e agevolazioni | 30 gg | Reg. comunale servizi sociali | Determina |

**Flusso tipico — Contributo economico straordinario:**
1. Istanza → AI: *Istanza cittadino*, termine 60 gg, completezza (ISEE, documentazione reddituale).
2. Smistamento a Ricci; `in_lavorazione`: valutazione del bisogno e dei requisiti.
3. ISEE/documenti mancanti → integrazione; eventuale relazione del servizio sociale professionale.
4. Bozza **Determina** di concessione → `pronta_firma` → firma → `conclusa`.

> **Dato particolarmente sensibile** (categorie ex art. 9 GDPR): qui il vincolo *on-prem* è
> dirimente — nessun dato di assistenza esce dal Comune. La marcatura AI sui documenti e la
> sorveglianza umana (fase P3) sono particolarmente stringenti per questo ufficio.

---

## 10. Quadro sinottico dei termini

Ordinati per criticità del termine — guida alla taratura dei **promemoria schedulati** (P1):

| Termine | Procedimenti (ufficio) |
|---|---|
| **1–2 gg** | Certificazioni/stato civile (AN), Protocollazione (SG), Pubblicazione Albo (SG), Ordinanza ex art. 54 (UT) |
| **6–10 gg** | CIE (AN), Ordinanza viabilità (PL) |
| **15–30 gg** | Delibere (SG), Accesso atti/FOIA (SG), SCIA/CDU/suolo (UT), Rateizzazione/liquidazione/impegno (TR), Esposti/elettorale (PL/AN), SAD/bonus (SS) |
| **45–60 gg** | Residenza/accertamenti (AN/PL), Paesaggistica (UT), SUAP (PL), Contributo ISEE/struttura (SS) |
| **90–180 gg** | Permesso di Costruire (UT), Sanzione CdS (PL), Autotutela (TR), Rimborso IMU/TARI (TR), Assegno maternità (SS) |

## 11. Roadmap di attivazione degli uffici

L'attivazione segue la logica **demo → produzione** della roadmap principale. L'Ufficio Tecnico è
già provato end-to-end; gli altri estendono lo *stesso* motore (stati, AI, RBAC, atti) sui propri
procedimenti, quindi il lavoro è prevalentemente di **configurazione, dati reali e validazione**,
non di nuovo sviluppo.

| Tappa | Uffici | Attività specifica | Fase roadmap |
|---|---|---|---|
| **T0 — Riferimento** | Ufficio Tecnico | ✅ Già dimostrato (PdC, ordinanza urgente, integrazione/parere) | Fasi 1–9 (fatte) |
| **T1 — Hub** | Segreteria / Protocollo | PEC reale, smistamento, Albo/protocollo verso endpoint reali | P4 (PEC + integrazioni) |
| **T2 — Onere alto** | Tributi, Servizi Sociali | Procedimenti a determina, golden set su istanze reali, soglie confidenza | P4 (golden set + lotto) |
| **T3 — Demografici/PL** | Anagrafe, Polizia Locale | Flussi inter-ufficio (`in_attesa_parere`), rilasci diretti, ordinanze→Albo | P4 (collaudo flussi) |
| **T4 — Conformità trasversale** | Tutti | Marcatura AI export, DPIA (focus SS/AN per dati sensibili), formazione responsabili | P3 + P5 |

**Pre-requisiti trasversali** (dalla roadmap principale):
- **P1** — promemoria scadenze schedulati (Celery Beat): indispensabili per i termini lunghi (TR/SS) e brevi (AN/SG).
- **P2** — Keycloak attivo con mappatura ruolo↔ufficio; fine del role-switch demo.
- **P3** — sorveglianza umana documentata; particolare attenzione a Servizi Sociali e Anagrafe (dati ex art. 9 GDPR).
- **P4** — calibrazione delle soglie di confidenza per categoria/ufficio sul **golden set** del Comune.

## 12. Cosa è già pronto e cosa resta

**Già nel codice (demo funzionante):**
- Catalogo dei **6 uffici** con procedimenti, termini, norme e atto finale (`reference.py`).
- **8 utenti reali** con ruoli e ufficio (`utenti.py`), responsabile per ogni ufficio.
- **Instradamento** categoria → ufficio e **filtro di visibilità** per ruolo (`api.py`).
- **Diario del procedimento** stato-per-stato con i documenti prodotti in ciascuno stato (Pratica.jsx).
- **Pratiche seed** per Tributi, Anagrafe, Polizia Locale, Servizi Sociali (oltre all'Ufficio Tecnico).

**Resta da fare (produzione):**
- Collegare la **PEC reale** e automatizzare lo smistamento (P4).
- **Validare** la classificazione per ciascun ufficio sul golden set e tarare le soglie (P4).
- **Promemoria** schedulati sui termini specifici di ogni procedimento (P1).
- **Formazione** dei responsabili dei nuovi uffici (Ferrara, Russo, Moretti, Ricci) — P5.

---

### Riferimenti
- `TrasParentIA_Roadmap_Implementazione.md` — piano demo → produzione (fasi P1–P5)
- `TrasParentIA_Funzionamento_e_Flussi.md` — flusso generale ed esempi concreti
- `platform/backend/app/reference.py` — catalogo uffici, procedimenti, stati, atti (fonte di verità)
- `platform/backend/app/utenti.py` — utenti, ruoli e assegnazione ufficio
- `Runbook_Server_AI.md` — server AI on-prem

> **Principio invariante:** in ogni ufficio l'AI produce solo proposte, sintesi e bozze. Ogni
> decisione e ogni firma restano in capo al responsabile del procedimento competente.
