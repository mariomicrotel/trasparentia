# Piano di implementazione — Sportelli Digitali SUE e SUAP

**Documento di pianificazione** · basato su: Specifiche Tecniche SUAP (DPR 160/2010, decreto interministeriale 26/09/2023 + Change Log ago. 2025), Allegato Tecnico SUE (PNRR Sub‑investimento 2.2.3, 31/01/2025), Manuale Ticketing AgID.

---

## 1. Cosa sono SUE e SUAP (inquadramento)

- **SUAP** — Sportello Unico per le Attività Produttive (DPR 160/2010): punto unico per avviare/modificare attività d'impresa (commercio, artigianato, pubblici esercizi…).
- **SUE** — Sportello Unico per l'Edilizia (Allegato Tecnico PNRR 2.2.3, su base DPR 380/2001 «TUE»): punto unico per i procedimenti edilizi (SCIA, permesso di costruire, CILA, agibilità…), con sotto‑contesti **SUE Residenziale** e **SUE Produttivo**.

Entrambi condividono la **stessa architettura di interoperabilità (SSU — Sistema Informatico degli Sportelli Unici)**, quattro componenti:

| Componente | Ruolo |
|---|---|
| **Front‑office (FO)** | Riceve le istanze dai *Soggetti presentatori* (cittadini/imprese/professionisti): compilazione moduli, validazione formale, invio al BO, ricezione conclusioni. |
| **Back‑office (BO)** | Istruttoria dell'ente: verifica procedibilità, inoltro agli Enti Terzi, gestione integrazioni, provvedimento conclusivo. |
| **Enti Terzi (ET)** | Uffici/PA coinvolte nell'istruttoria (Genio Civile, Soprintendenza, ASL, VVF, altri uffici comunali). |
| **Catalogo SSU** | Componente infrastrutturale nazionale unica: metadati (procedimenti, moduli, fattispecie, sportelli), genera il **CUI** (codice unico istanza), registra gli audit. |

**Principi tecnici vincolanti (DEVE):**
- Comunicazione **API‑to‑API** via **PDND** (Piattaforma Digitale Nazionale Dati) — non più PEC — con e‑service descritti in **OpenAPI 3**.
- **Integrità e non ripudio**: header `AgID‑JWT‑Signature`, token di autorizzazione PDND (voucher).
- **Moduli digitali** standardizzati e validati con **XML Schema (XSD) + Schematron** (modulistica edilizia unificata 2017; modulistica SUAP).
- **CUI** generato dal Catalogo SSU; **`context`/`sub_context`** = `SUAP` | `SUE Produttivo` | `SUE Residenziale`.
- Le specifiche **non definiscono il workflow interno** (è demandato all'operatore) → spazio ideale per il valore aggiunto della piattaforma.
- Per l'**edilizia produttiva** e la **SCIA in ComUnica**: comunicazione con il **Registro Imprese** (sistema camerale).
- I regimi amministrativi tipici: **SCIA**, **SCIA in ComUnica**, **Autorizzazione/Domanda**, **Comunicazione** (+ silenzio‑assenso / conferenza di servizi).

> È ammesso implementare FO e BO **in modo integrato** (unico sistema) per le realtà che partono ora: è il nostro caso e semplifica molto la Fase iniziale.

---

## 2. Punto di partenza: quanto è GIÀ nella piattaforma

La scoperta più importante: **il Back‑office è in larga parte già modellato.** `reference.py` definisce procedimenti che *sono* SUE/SUAP:
- Ufficio Tecnico → **«SCIA edilizia»** (DPR 380/2001 art. 23, 30 gg), **CDU** (art. 30);
- Sportello attività produttive → **«SCIA attività produttive (SUAP)»** (DPR 160/2010, 60 gg).

Mappatura architettura SSU → funzionalità TrasParentIA esistenti:

| Elemento SSU | Già presente in TrasParentIA | Note |
|---|---|---|
| Istruttoria BO (stati, assegnazione, scadenze, termini di legge) | **Pratiche** (`Pratica`, `STATI`, `FLOW`, riassegnazione, scadenzario) | Riuso quasi 1:1 |
| Provvedimento conclusivo | **Atti & bozze** (`Atto`, editor TipTap, diff, firma) | Riuso |
| Ricezione documenti + testo | **Storage MinIO + parsing/OCR** (`parsing.extract_text`) | Riuso per allegati |
| Instradamento all'ufficio | **Classificazione AI** (16 categorie → ufficio) | Estendibile ai procedimenti SUE/SUAP |
| Protocollazione | **Protocollo** (interno + `PROTOCOLLO_ESTERNO_URL`) | Riuso |
| Comunicazioni/PEC | **Inbox PEC, notifiche, mailer** | Canale legacy/di cortesia |
| Pubblicazione atti | **Albo Pretorio (scraper + `ALBO_ESTERNO_URL`)** | Riuso |
| Ricerca precedenti | **Ricerca semantica (pgvector)** | Riuso |
| Fondazione normativa | **Corpus normativo + RAG redazionale** | Regolamento Edilizio, RUEC, regolamenti commercio |
| Supporto operatore/cittadino | **Assistente chat RAG** | Riuso/estensione |
| Osservabilità | **Monitor AI, diagnostica, calibrazione** | Riuso |

**Conclusione:** non partiamo da zero. Serve costruire soprattutto il **Front‑office pubblico**, il **motore dei moduli digitali (XSD/Schematron)** e lo **strato di interoperabilità SSU/PDND**. Il resto è estensione dell'esistente.

---

## 3. Nuovi componenti da costruire

1. **Modello dati SSU** — nuove entità:
   - `ProcedimentoSSU` (context, sub_context, regime amministrativo, ufficio competente, termine, norma, modulo associato) — *popolato dal Catalogo SSU*.
   - `IstanzaSSU` (CUI, presentatore, procedimento, stato secondo `instance-descriptor-schema`, moduli compilati, allegati, audit) — collegata 1:1 a una `Pratica` interna per l'istruttoria.
   - `ModuloDigitale` (XSD + Schematron + versione + fattispecie) e `EnteTerzo` (competenza, e‑service).
2. **Client Catalogo SSU** — consumo metadati (`/proceedings/{context}`, `/single-desk/{municipality}/{context}`, `request_cui`, `/context`), caching locale, audit.
3. **Strato PDND / sicurezza e‑service** — voucher PDND, firma/verifica `AgID‑JWT‑Signature`, client/service OpenAPI generati dagli artefatti AgID (repo GitHub AgID/SUE‑allegato‑tecnico e specifiche‑tecniche‑DPR‑160‑2010).
4. **Motore moduli digitali** — rendering di form dinamici dallo XSD, validazione XSD + Schematron lato FO («controlli formali automatici» = precondizione all'invio), generazione XML dell'istanza.
5. **Front‑office pubblico** — area separata autenticata **SPID/CIE** per presentatori: selezione procedimento (da Catalogo), compilazione modulo, allegati firmati (CAdES/PAdES), invio → richiesta CUI → creazione istanza → `send_instance` al BO; ricezione ricevuta e conclusioni.
6. **e‑service (endpoint OpenAPI)** — `send_instance`, `notify`, `request_integration`, `request_instance_document`, `send_conclusions`, `notify_receipt`, `cancel_instance`, `retry`, `audit` per i canali FO↔BO↔ET (+ Registro Imprese per il produttivo).
7. **Gestione Enti Terzi** — inoltro istanza, selezione documenti, richieste di integrazione uniche, ricezione pareri/conclusioni (`generic_conclusion` per il SUE).

---

## 4. Come gli sportelli **beneficiano** delle funzionalità esistenti (il cuore della richiesta)

Questo è il vantaggio competitivo: gli sportelli non sono un modulo isolato, ma **ereditano tutta l'intelligenza già costruita.**

1. **Classificazione AI → instradamento e triage dell'istanza.**
   All'arrivo di un'istanza, l'AI già addestrata sulle 16 categorie/uffici individua l'ufficio competente e il *tipo procedimento*, propone urgenza e termine di legge. Per il SUE/SUAP significa: la SCIA edilizia va all'Ufficio Tecnico, la SCIA commercio allo sportello attività produttive, **senza smistamento manuale**. La *fattispecie* del Catalogo (quali endoprocedimenti attivare) è validata dall'AI contro il contenuto del modulo.

2. **RAG normativo + corpus regolamenti → verifica procedibilità e redazione fondata.**
   L'assistente redazionale già **fonda gli atti esclusivamente sui regolamenti vigenti** dell'ente. Caricando il **Regolamento Edilizio / RUEC**, il **Piano Urbanistico**, i regolamenti su commercio e occupazione suolo, l'operatore BO ottiene: bozze di provvedimento (permesso, diniego, richiesta integrazioni) **citate articolo per articolo**, e un supporto alla *verifica di procedibilità* ancorato alla norma reale — con il rifiuto deterministico se manca base regolamentare (niente allucinazioni). I regolamenti sono già indicizzati per articolo.

3. **Assistente chat globale → guida al presentatore e all'operatore.**
   Sul **Front‑office**: aiuta cittadino/professionista a scegliere il procedimento giusto e capire quali allegati servono (fondandosi su Catalogo + regolamenti). Sul **Back‑office**: risponde all'istruttore su norme, precedenti e stato pratiche. Già multi‑turno, in italiano, con citazione delle fonti e gate di pertinenza.

4. **Pratiche (workflow interno) → l'istruttoria che le specifiche NON definiscono.**
   Le specifiche lasciano *volutamente* il workflow all'ente. La piattaforma lo fornisce già: stati, scadenzario con **termini di legge** (30/60 gg), assegnazione/riassegnazione all'istruttore, sospensione termini per integrazioni/pareri. Ogni `IstanzaSSU` si aggancia a una `Pratica` → l'operatore lavora nell'interfaccia che già conosce.

5. **Atti & bozze (editor TipTap + diff) → provvedimento conclusivo.**
   Il provvedimento finale (permesso di costruire, autorizzazione, diniego, presa d'atto SCIA) si redige nell'editor ricco con **diff bozza‑AI ↔ versione rivista**, si porta a firma e si protocolla. La conclusione viene poi trasformata nel messaggio e‑service (`send_conclusions` / `generic_conclusion`).

6. **Storage MinIO + OCR → allegati e interoperabilità documentale.**
   Gli allegati dell'istanza (elaborati, relazioni, procure) sono archiviati e resi ricercabili; l'OCR estrae testo dai PDF scansionati per ricerca e assistente. Gli stessi file alimentano `request_instance_document` verso gli Enti Terzi.

7. **Protocollo → registrazione istanze e uscite** (interno o via sistema camerale/`PROTOCOLLO_ESTERNO_URL`).

8. **Ricerca semantica → precedenti e coerenza.**
   L'istruttore trova istanze/atti analoghi già decisi, per uniformità di trattamento; l'AttoAlbo scrapato e le pratiche pregresse diventano base di conoscenza.

9. **PEC / notifiche → canale di cortesia e fallback.**
   Dove l'interoperabilità PDND non è ancora attiva lato controparte, la PEC resta come fallback previsto dalla norma; le notifiche interne avvisano l'operatore di scadenze e nuove istanze.

10. **Albo Pretorio (scraper + integrazione) → pubblicazione degli esiti** dei procedimenti che lo richiedono.

11. **Monitor AI / diagnostica / calibrazione → esercizio e conformità.**
    Osservabilità del carico AI, test dei servizi e misura della qualità di classificazione con golden set — utili anche per i **black‑box functionality test** richiesti da AgID.

12. **RBAC e auth native/Keycloak → separazione ruoli** operatore SUE, operatore SUAP, responsabile, segretario; il FO pubblico richiede un livello a parte (SPID/CIE).

---

## 5. Piano a fasi (incrementale, ogni fase porta valore usabile)

**Fase A — Fondamenta dati + Catalogo SSU (lettura).**
Modello `ProcedimentoSSU`/`ModuloDigitale`/`EnteTerzo`; client di sola consultazione del Catalogo SSU (metadati, `/context`, procedimenti per comune); import degli artefatti AgID (XSD/Schematron/OpenAPI) dal repo GitHub. *Esito:* catalogo procedimenti navigabile nel BO.

**Fase B — Back‑office esteso (riuso Pratiche).**
`IstanzaSSU` agganciata a `Pratica`; stati secondo `instance-descriptor-schema` (incl. `ended_by_generic_conclusion`); verifica procedibilità assistita da RAG; provvedimento via Atti. *Esito:* un'istanza (inserita anche manualmente) è istruibile end‑to‑end internamente.

**Fase C — Front‑office pubblico + moduli digitali.**
Portale presentatore con **SPID/CIE**; motore moduli dinamici da XSD + validazione Schematron; generazione XML istanza; richiesta **CUI** al Catalogo; invio al BO. *Esito:* un cittadino presenta una SCIA reale online.

**Fase D — Interoperabilità e‑service + PDND + sicurezza.**
Implementazione e‑service OpenAPI FO↔BO↔ET; voucher PDND; `AgID‑JWT‑Signature`; audit verso Catalogo; gestione integrazioni e pareri Enti Terzi. *Esito:* comunicazione API conforme con controparti esterne.

**Fase E — Registro Imprese/ComUnica + SUE produttivo.**
e‑service verso/da Registro Imprese per SCIA in ComUnica ed edilizia produttiva. *Esito:* copertura del produttivo.

**Fase F — Conformità e collaudo.**
Superamento dei **black‑box functionality test** AgID (FO/BO/ET), livelli di servizio, onboarding PDND, qualificazione dei sistemi nel Catalogo. *Esito:* sportello certificabile.

---

## 6. Rischi, vincoli e decisioni aperte

- **On‑prem vs connettività esterna.** Il principio «nessun dato esce dal Comune» vale per l'AI; l'interoperabilità SSU/PDND **richiede** per definizione connettività verso Catalogo SSU, PDND e controparti. Va definito un perimetro di rete/proxy dedicato (l'AI resta on‑prem, l'interop esce in modo controllato e firmato).
- **SPID/CIE sul Front‑office** — integrazione con identity provider: nuova superficie rispetto all'auth attuale (nativa/Keycloak).
- **Onboarding PDND** — pubblicazione e fruizione e‑service, gestione voucher e chiavi di firma: iter amministrativo oltre che tecnico.
- **Certificazione AgID** — i black‑box test sono vincolanti per la conformità; vanno pianificati come fase dedicata.
- **Specifiche in evoluzione** — il Change Log ago. 2025 aggiorna i sequence diagram (SCIA in ComUnica, ecc.): costruire adattabile (artefatti versionati, non hardcoded).
- **Firma digitale** allegati (CAdES/PAdES, eIDAS) — verifica formati ammessi.
- **Ruolo dell'ente**: FO, BO o entrambi integrati? Per un micro‑Comune conviene l'**integrato** (ammesso dalle specifiche), rimandando la separazione.

---

## 7. Domande per orientare l'implementazione

1. **Ambito prioritario**: partire da **SUE (edilizia)** o **SUAP (attività produttive)**? (condividono l'architettura, ma moduli e regimi differiscono).
2. **Ruolo**: implementiamo **FO + BO integrati** (consigliato per iniziare) o solo uno dei due?
3. **Identità FO**: SPID, CIE o entrambi? C'è già un IdP/aggregatore convenzionato dal Comune?
4. **PDND**: il Comune è già accreditato/aderente, o va avviato l'onboarding?
5. **Obiettivo**: prototipo dimostrativo del flusso (interno) oppure percorso verso la **conformità/certificazione** AgID?
