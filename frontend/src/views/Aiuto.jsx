import React, { useState, useMemo } from "react";
import { Icon } from "../icons.jsx";

/* ------------------------------------------------------------------ */
/*  Contenuto del manuale — array di sezioni                           */
/* ------------------------------------------------------------------ */
const RUOLI = {
  protocollo: { label: "Operatore protocollo", col: "#5b7fca" },
  tecnico:    { label: "Ufficio Tecnico",       col: "#2e7d32" },
  segretario: { label: "Segretario Comunale",   col: "#7b1fa2" },
  tutti:      { label: "Tutti gli operatori",   col: "#546e7a" },
};

function RoleBadge({ r }) {
  const m = RUOLI[r] || RUOLI.tutti;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                   background: m.col + "18", color: m.col, marginRight: 4 }}>
      {m.label}
    </span>
  );
}

const SECTIONS = [
  {
    key: "panoramica", icon: "sparkles", title: "Panoramica",
    ruoli: ["tutti"],
    subsections: [
      {
        title: "Cos'è TrasParentIA Micro PA",
        body: `TrasParentIA è una piattaforma di supporto operativo per i Comuni fino a 5.000 abitanti. Riunisce in un'unica interfaccia la gestione delle comunicazioni (PEC e posta), il flusso delle pratiche, la redazione degli atti, il monitoraggio degli inventari e l'archivio documentale.

L'intelligenza artificiale è integrata come **assistente**, non come decisore: classifica i documenti, propone bozze e sintetizza i testi, ma ogni scelta operativa resta in capo al personale. Nessun dato del Comune esce dalla rete interna.`,
      },
      {
        title: "Chi fa cosa — ruoli principali",
        body: `**Operatore protocollo (Segreteria):** gestisce l'inbox PEC, assegna le comunicazioni agli uffici e supervisiona la protocollazione in entrata.

**Istruttore / Responsabile Ufficio Tecnico:** lavora le pratiche assegnate, genera bozze di atti, aggiorna gli stati e gestisce le scadenze.

**Segretario Comunale:** supervisione completa, firma degli atti, accesso alla configurazione e ai report.

**Assistente AI (sistema):** classifica, sintetizza, propone — non decide, non firma.`,
      },
      {
        title: "Principio AI assistiva",
        body: `L'AI produce sempre **proposte verificabili**: la categoria assegnata è accompagnata da un punteggio di confidenza e da una motivazione testuale. Un'operatore può accettare, modificare o ignorare completamente la proposta.

**Regola fondamentale:** ogni override dell'operatore viene registrato nel log (chi, quando, cosa). Le bozze generate dall'AI sono marcate come tali e richiedono revisione umana prima della firma.`,
      },
    ],
  },
  {
    key: "comunicazioni", icon: "mail", title: "Comunicazioni & PEC",
    ruoli: ["protocollo", "tecnico"],
    subsections: [
      {
        title: "Come arriva una PEC",
        body: `Il sistema interroga la casella PEC del Comune ogni pochi minuti (polling IMAP). Quando arriva un messaggio:
1. Il testo e gli allegati vengono estratti automaticamente (anche da PDF scansionati tramite OCR).
2. L'AI classifica la comunicazione tra le 16 categorie documentali.
3. La comunicazione appare nell'**Inbox** con categoria, ufficio suggerito e livello di urgenza.`,
      },
      {
        title: "Capire il risultato della classificazione AI",
        body: `Ogni comunicazione mostra:
- **Categoria** — es. "Pratica tecnica", "Istanza cittadino"
- **Confidenza** — barra colorata dal rosso (bassa) al verde (alta). Sopra 75% il sistema è molto sicuro; sotto 45% è preferibile un controllo manuale.
- **Motivazione** — testo esplicativo del perché l'AI ha scelto quella categoria.
- **Alternative** — altre categorie considerate con le relative probabilità.
- **Documenti attesi** — lista dei documenti che potrebbero mancare nell'istanza.

Puoi sempre cambiare la categoria: il sistema registra l'override e lo usa per migliorare le classificazioni future.`,
      },
      {
        title: "Prendere in carico e aprire una pratica",
        body: `Dall'Inbox, clicca sulla comunicazione per aprire il dettaglio. Poi:
1. **Prendi in carico** — assegna la comunicazione a te stesso o a un collega.
2. **Apri pratica** — crea una nuova pratica collegata alla comunicazione (fascicolo, scadenza, ufficio).
3. La pratica comparirà nello **Scadenziario** con lo stato "assegnata".`,
      },
    ],
  },
  {
    key: "pratiche", icon: "calendar", title: "Pratiche & scadenziario",
    ruoli: ["tecnico", "protocollo"],
    subsections: [
      {
        title: "Il ciclo di vita di una pratica",
        body: `Una pratica segue questo flusso:

\`ricevuta → da_classificare → assegnata → in_lavorazione → pronta_firma → conclusa\`

Con rami aggiuntivi per le sospensioni:
- **in_attesa_integrazione** — si è richiesto un supplemento documentale al mittente (i termini si sospendono).
- **in_attesa_parere** — si attende un parere esterno.
- **archiviata** — pratica chiusa senza conclusione formale.

Il passaggio a ogni stato è tracciato nel log con utente, data e nota.`,
      },
      {
        title: "Priorità e scadenze",
        body: `Ogni pratica ha una priorità (**bassa / media / alta / urgente**) e una scadenza calcolata dal tipo di procedimento (o inserita manualmente).

Lo **Scadenziario** mostra le pratiche ordinate per urgenza. Il colore del badge tempo indica:
- **Verde** — oltre 7 giorni
- **Ambra** — entro 7 giorni
- **Rosso** — scaduto o oggi

Riceverai una **notifica** automatica quando una pratica si avvicina alla scadenza.`,
      },
      {
        title: "Lavorare una pratica: note, documenti, bozze",
        body: `Dentro il dettaglio pratica puoi:
- Aggiungere **note interne** (tracciate nel log, non visibili all'esterno).
- Cambiare lo stato e la priorità.
- **Riassegnare** la pratica a un altro responsabile.
- Generare una **bozza AI** (determina, risposta al cittadino, richiesta integrazione) che apparirà nella sezione Atti.`,
      },
    ],
  },
  {
    key: "atti", icon: "fileText", title: "Atti & bozze",
    ruoli: ["tecnico", "segretario"],
    subsections: [
      {
        title: "Tipi di atto supportati",
        body: `La piattaforma gestisce: **determina, ordinanza, delibera, avvio procedimento, richiesta integrazione, risposta al cittadino, nota ad altro ente, sollecito, riepilogo**.

Ogni atto ha un ciclo di vita: \`bozza → in_revisione → pronta_firma → firmato → protocollato\`.`,
      },
      {
        title: "Generare una bozza con l'AI",
        body: `Dall'elenco Atti, clicca **Nuova bozza AI**. Scegli il tipo di atto e la pratica collegata. L'AI produce un testo strutturato usando il contenuto della pratica e della comunicazione originale.

**Importante:** le bozze AI sono indicate da un'etichetta specifica. Prima della firma, il responsabile deve sempre leggere, correggere e approvare il contenuto — il sistema blocca la firma finché non si conferma la revisione.`,
      },
      {
        title: "Workflow firma e protocollazione",
        body: `Una volta che il testo è approvato:
1. Cambia lo stato in **pronta_firma** e assegna il firmatario.
2. Il firmatario (di solito il Segretario) riceve una notifica.
3. Dopo la firma, lo stato diventa **firmato** e si può procedere alla protocollazione.
4. Gli atti **da pubblicare** (ordinanze, delibere) vengono inseriti nell'Albo Pretorio.`,
      },
    ],
  },
  {
    key: "import", icon: "upload", title: "Importazione massiva",
    ruoli: ["segretario", "protocollo"],
    subsections: [
      {
        title: "A cosa serve l'importazione massiva",
        body: `Permette di caricare in blocco i documenti storici del Comune: PEC degli ultimi anni, determine, delibere, ordinanze già emesse, pratiche aperte migrazione da altri sistemi. Ogni documento viene classificato dall'AI e poi può essere importato come Comunicazione nel sistema.`,
      },
      {
        title: "Come funziona: lotto → upload → classifica → importa",
        body: `1. **Crea un lotto** — dagli un nome descrittivo (es. "PEC 2023", "Determine UT Q1 2024").
2. **Carica i file** — trascina PDF, TXT, DOC, EML o immagini nella zona di upload. Puoi caricare centinaia di file contemporaneamente.
3. **Classifica** — usa "Classifica tutto" per far classificare l'AI ogni documento in sequenza (vedi barra di avanzamento). In alternativa classifica documento per documento.
4. **Revisione** — controlla i risultati nella tab "Classificati". Puoi riclassificare o scartare.
5. **Importa** — "Importa tutti classificati" crea una Comunicazione per ogni documento approvato.`,
      },
      {
        title: "Cosa succede ai file scartati",
        body: `I documenti scartati rimangono nel lotto con stato "Scartato" e non creano comunicazioni. Restano visibili per controllo ma non compaiono nelle viste operative. I file originali rimangono su MinIO per 90 giorni.`,
      },
    ],
  },
  {
    key: "inventario", icon: "box", title: "Inventario beni",
    ruoli: ["tecnico", "segretario"],
    subsections: [
      {
        title: "Tipologie di beni",
        body: `La piattaforma gestisce tre categorie:
- **Immobili** — edifici comunali, terreni, aree pubbliche.
- **Mobili** — veicoli, attrezzature, arredi, strumenti.
- **Infrastrutture** — strade, reti, impianti.

Per ogni bene si registra: codice, ubicazione, stato (ottimo / buono / discreto / critico), responsabile, valore contabile, scadenza collaudo.`,
      },
      {
        title: "QR code per beni fisici",
        body: `Ogni bene ha un QR code unico generato automaticamente. Stampalo e applicalo al bene fisico. Scansionandolo con uno smartphone si accede direttamente alla scheda del bene (senza login, solo lettura).

Dall'elenco Inventario clicca **QR** sulla riga del bene per scaricare l'immagine in PNG.`,
      },
      {
        title: "Aggiornamento stato e manutenzione",
        body: `Quando un bene cambia stato (es. dopo una riparazione o un'ispezione), aggiorna il campo **Stato** nella scheda. Ogni cambio di stato è tracciato nel log del bene.

I beni in stato **critico** appaiono in evidenza nel Cruscotto.`,
      },
    ],
  },
  {
    key: "ricerca", icon: "search", title: "Ricerca",
    ruoli: ["tutti"],
    subsections: [
      {
        title: "Come funziona la ricerca",
        body: `La barra di ricerca nella topbar cerca in tutto il contenuto indicizzato: comunicazioni, pratiche, atti, documenti.

La modalità **auto** combina due tecniche:
- **Full-text** — cerca parole esatte o parziali (veloce).
- **Semantica** — cerca per significato, non solo per parole chiave. Richiede che il server AI sia raggiungibile e che gli embeddings siano stati generati (vedi Configurazione).

Esempio: cercare "permesso di costruire" trova anche risultati che parlano di "SCIA", "concessione edilizia", "titolo abilitativo" anche se non contengono la parola esatta.`,
      },
      {
        title: "Rigenera l'indice",
        body: `Se la ricerca semantica non trova risultati recenti, potrebbe essere necessario rigenerare l'indice. Vai in **Configurazione → Ricerca semantica** e clicca "Reindicizza". L'operazione può richiedere qualche minuto se ci sono molti documenti.`,
      },
    ],
  },
  {
    key: "configurazione", icon: "settings", title: "Configurazione",
    ruoli: ["segretario"],
    subsections: [
      {
        title: "Connettere il server AI (Ollama)",
        body: `Vai in **Configurazione**, apri la card **Intelligenza Artificiale** e clicca "Modifica".

- **URL server AI** — indirizzo del server Ollama interno (es. \`https://192.168.1.10\`). Il server deve essere raggiungibile dalla rete del Comune.
- **Chiave API** — la chiave X-API-Key impostata nel reverse proxy (Caddy). Vedi il Runbook_Server_AI per come configurarla.
- **Modello generazione** — es. \`qwen2.5:7b-instruct\`. Deve essere già scaricato con \`ollama pull\` sul server AI.
- **Modello embedding** — es. \`nomic-embed-text\`. Usato per la ricerca semantica.

Dopo il salvataggio, usa "Prova connessione" per verificare. Il cambiamento è immediato, senza riavvio.`,
      },
      {
        title: "Configurare la casella PEC",
        body: `Nella card **PEC / IMAP**, inserisci:
- Host e porta del server IMAP del provider PEC (es. Aruba, Poste, Legalmail).
- Username e password della casella PEC istituzionale.
- Cartella da monitorare (di solito \`INBOX\`).

Dopo il salvataggio usa "Prova connessione". Se tutto è corretto, il polling PEC si attiva automaticamente.`,
      },
      {
        title: "Backup",
        body: `Il backup crea un dump completo del database PostgreSQL. Clicca **Esegui backup** nella card Backup (in basso in Configurazione). I backup sono salvati su MinIO e visibili nella lista.

**Consiglio:** esegui un backup manuale prima di ogni aggiornamento del sistema e automatizza un backup notturno tramite cron (vedi documentazione server).`,
      },
      {
        title: "Checklist avvio operativo",
        body: `Prima del go-live controlla che:
- ✅ Database operativo (status verde in Configurazione)
- ✅ MinIO operativo (status verde)
- ✅ Server AI raggiungibile e risponde correttamente
- ✅ Casella PEC collegata e testata
- ✅ SMTP configurato (invia email di prova)
- ✅ Almeno un backup eseguito
- ✅ Utenti e ruoli configurati

La card "Avvio operativo" in Configurazione mostra questa checklist in tempo reale.`,
      },
    ],
  },
  {
    key: "faq", icon: "info", title: "Domande frequenti (FAQ)",
    ruoli: ["tutti"],
    subsections: [
      {
        title: "L'AI ha accesso a dati personali dei cittadini?",
        body: `L'AI è installata sul server interno del Comune: il testo delle PEC e dei documenti non esce mai dalla rete comunale. Il server AI (Ollama) è su una macchina separata della stessa LAN, protetta da firewall.`,
      },
      {
        title: "Cosa succede se il server AI non è raggiungibile?",
        body: `La piattaforma funziona in modalità degradata: le comunicazioni arrivano normalmente ma la classificazione automatica non è disponibile. L'operatore può classificare manualmente. Appena il server AI torna operativo, i documenti in coda vengono riclassificati.`,
      },
      {
        title: "Posso fidarmi delle bozze generate dall'AI?",
        body: `Le bozze AI sono un punto di partenza, non un prodotto finito. Il responsabile deve sempre leggere, correggere e approvare il testo prima della firma. La piattaforma non permette la firma di una bozza senza conferma esplicita di revisione.`,
      },
      {
        title: "Come faccio a correggere una classificazione sbagliata?",
        body: `Apri la comunicazione, scorri alla sezione AI e clicca "Modifica categoria". La correzione viene registrata nel log. Se noti che una certa categoria viene sistematicamente sbagliata, segnalalo all'amministratore per migliorare il prompt AI.`,
      },
      {
        title: "Come si aggiunge un nuovo utente?",
        body: `Nella modalità demo gli utenti sono precaricati. In produzione con Keycloak attivo, vai nel pannello di amministrazione Keycloak (raggiungibile dall'URL configurato) e crea l'utente assegnandogli il ruolo corrispondente (operatore_protocollo, responsabile_tecnico, segretario_comunale).`,
      },
      {
        title: "Dove si trovano i log delle operazioni?",
        body: `In **Sicurezza & log** (voce in basso nella sidebar). Mostra tutte le azioni tracciate: accessi, classificazioni, override AI, cambi di stato pratiche, firma atti, esportazioni, backup.`,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */

export default function Aiuto({ nav }) {
  const [activeKey, setActiveKey] = useState("panoramica");
  const [query, setQuery] = useState("");
  const [openSubs, setOpenSubs] = useState({});

  const activeSection = SECTIONS.find(s => s.key === activeKey);

  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    const results = [];
    for (const sec of SECTIONS) {
      for (const sub of sec.subsections) {
        if (sub.title.toLowerCase().includes(q) || sub.body.toLowerCase().includes(q)) {
          results.push({ sec, sub });
        }
      }
    }
    return results;
  }, [query]);

  function toggleSub(key) {
    setOpenSubs(s => ({ ...s, [key]: !s[key] }));
  }

  function inlineRender(line) {
    return line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, j) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={j}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("`") && p.endsWith("`")) return <code key={j} style={{ background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4, fontSize: "0.9em", fontFamily: "monospace" }}>{p.slice(1, -1)}</code>;
      return p;
    });
  }

  function renderBody(text) {
    const lines = text.split("\n");
    const out = [];
    let listBuf = [];

    function flushList(ordered) {
      if (!listBuf.length) return;
      const Tag = ordered ? "ol" : "ul";
      out.push(<Tag key={out.length} style={{ paddingLeft: 20, margin: "0 0 8px" }}>{listBuf}</Tag>);
      listBuf = [];
    }

    lines.forEach((line, i) => {
      if (!line.trim()) { flushList(false); out.push(<br key={i} />); return; }
      if (line.startsWith("- ")) {
        listBuf.push(<li key={i} style={{ marginBottom: 3 }}>{inlineRender(line.slice(2))}</li>);
        return;
      }
      if (/^\d+\. /.test(line)) {
        listBuf.push(<li key={i} style={{ marginBottom: 3 }}>{inlineRender(line.replace(/^\d+\. /, ""))}</li>);
        return;
      }
      if (line.startsWith("✅")) {
        flushList(false);
        out.push(<div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}><span style={{ flexShrink: 0 }}>✅</span><span>{inlineRender(line.replace(/^✅\s*/, ""))}</span></div>);
        return;
      }
      flushList(false);
      out.push(<p key={i} style={{ margin: "0 0 8px" }}>{inlineRender(line)}</p>);
    });
    flushList(false);
    return out;
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Guida & aiuto</span></div>
          <h1>Guida operativa</h1>
          <p>Manuale in-app per gli operatori del Comune. Cerca un argomento o sfoglia le sezioni.</p>
        </div>
      </div>

      {/* search bar */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Icon name="search" size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        <input
          placeholder="Cerca nella guida…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: "100%", padding: "9px 12px 9px 38px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "var(--surface)" }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <Icon name="x" size={14} stroke={2} />
          </button>
        )}
      </div>

      {/* risultati ricerca */}
      {filtered !== null ? (
        <div>
          {filtered.length === 0 ? (
            <div className="empty card" style={{ padding: "32px 20px" }}>
              <Icon name="search" size={32} />
              <p>Nessun risultato per «{query}».</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{filtered.length} risultat{filtered.length === 1 ? "o" : "i"}</div>
              {filtered.map(({ sec, sub }, i) => (
                <div key={i} className="card" style={{ cursor: "pointer" }} onClick={() => { setQuery(""); setActiveKey(sec.key); setOpenSubs(s => ({ ...s, [sec.key + "_" + sub.title]: true })); }}>
                  <div className="card__body">
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{sec.title}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{sub.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {sub.body.slice(0, 160)}{sub.body.length > 160 ? "…" : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>
          {/* sidebar */}
          <div className="card" style={{ position: "sticky", top: 12 }}>
            <div className="card__body" style={{ padding: "6px 0" }}>
              {SECTIONS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setActiveKey(s.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 9, width: "100%",
                    padding: "9px 14px", border: "none", cursor: "pointer",
                    background: activeKey === s.key ? "var(--blu-bg, #e8f0fe)" : "transparent",
                    color: activeKey === s.key ? "var(--blu)" : "var(--text)",
                    fontWeight: activeKey === s.key ? 700 : 400, fontSize: 13,
                    borderLeft: `3px solid ${activeKey === s.key ? "var(--blu)" : "transparent"}`,
                    textAlign: "left",
                  }}
                >
                  <Icon name={s.icon} size={15} stroke={1.8} style={{ flexShrink: 0 }} />
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {/* content */}
          {activeSection && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>{activeSection.title}</h2>
                <div>
                  {activeSection.ruoli.map(r => <RoleBadge key={r} r={r} />)}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeSection.subsections.map((sub, idx) => {
                  const subKey = activeSection.key + "_" + sub.title;
                  const open = openSubs[subKey] !== false; // default open
                  return (
                    <div key={idx} className="card">
                      <button
                        onClick={() => toggleSub(subKey)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "14px 16px", background: "none", border: "none", cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <Icon name={open ? "chevronDown" : "chevronRight"} size={15} stroke={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 15, flex: 1, color: "var(--text)" }}>{sub.title}</span>
                      </button>
                      {open && (
                        <div style={{ padding: "0 16px 16px 42px", fontSize: 13.5, lineHeight: 1.7, color: "var(--text)" }}>
                          {renderBody(sub.body)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
