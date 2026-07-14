import React, { useState } from "react";
import { Icon } from "./icons.jsx";

// Simulazione dell'accesso SPID/CIE/CNS per il portale pubblico SUE (prototipo).
// Nel sistema reale l'utente verrebbe reindirizzato all'Identity Provider (SPID)
// o autenticato tramite l'app/carta CIE o il certificato della CNS (Carta
// Nazionale dei Servizi / TS-CNS), che restituiscono un'identità VERIFICATA
// (nome, cognome, codice fiscale) — il cittadino non la digita, la conferma
// soltanto. Qui simuliamo lo stesso flusso in due passi: scelta del metodo →
// conferma dei dati (mock, editabili solo per poter testare nominativi diversi).

const PROVIDER_SPID = [
  { id: "poste", nome: "Poste ID" },
  { id: "aruba", nome: "Aruba ID" },
  { id: "tim", nome: "TIM id" },
  { id: "infocert", nome: "InfoCert ID" },
];

// Colore istituzionale per metodo di accesso.
const METODO_COLORE = { SPID: "#00825A", CIE: "#1256A3", CNS: "#6C4F9C" };

function AssertionForm({ metodo, provider, onConferma, onAnnulla }) {
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [cf, setCf] = useState("");
  const [email, setEmail] = useState("");
  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "9px 11px",
    border: "1px solid var(--border, #d1d5db)", borderRadius: 6, fontSize: 13.5,
    background: "#fff", fontFamily: "inherit",
  };
  const pronto = nome.trim() && cognome.trim() && cf.trim();

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", background: "#fff", borderRadius: 12, padding: "28px 26px", boxShadow: "0 2px 16px rgba(0,0,0,.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Icon name={metodo === "CNS" ? "card" : "shield"} size={20} stroke={2} style={{ color: METODO_COLORE[metodo] || "#1256A3" }} />
        <div style={{ fontWeight: 700, fontSize: 15 }}>{provider} — {metodo}</div>
      </div>
      <p style={{ fontSize: 12.5, color: "#6b7280", margin: "0 0 18px" }}>
        {metodo === "CNS"
          ? "Simulazione: nel sistema reale questi dati sarebbero letti dal certificato della tua CNS (smart card + PIN), senza doverli digitare. Qui li imposti tu per poter testare nominativi diversi."
          : `Simulazione: nel sistema reale questi dati arriverebbero già verificati dal provider ${metodo}, senza doverli digitare. Qui li imposti tu per poter testare nominativi diversi.`}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>Nome *</label>
          <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} placeholder="Mario" />
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>Cognome *</label>
          <input style={inputStyle} value={cognome} onChange={e => setCognome(e.target.value)} placeholder="Rossi" />
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>Codice fiscale *</label>
          <input style={{ ...inputStyle, textTransform: "uppercase" }} value={cf} onChange={e => setCf(e.target.value.toUpperCase())} placeholder="RSSMRA80A01H501U" />
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "#4b5563", display: "block", marginBottom: 4 }}>Email</label>
          <input style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} placeholder="mario.rossi@example.it" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
        <button className="btn btn--subtle btn--sm" onClick={onAnnulla}>Annulla</button>
        <button className="btn btn--primary" style={{ flex: 1 }} disabled={!pronto}
                onClick={() => onConferma({ nome: nome.trim(), cognome: cognome.trim(), cf: cf.trim(), email: email.trim() })}>
          <Icon name="checkCircle" size={15} stroke={2} />Conferma identità e prosegui
        </button>
      </div>
    </div>
  );
}

function ProviderPicker({ metodo, onScegli, onIndietro }) {
  const lista = metodo === "SPID" ? PROVIDER_SPID
    : metodo === "CNS" ? [{ id: "cns", nome: "Carta Nazionale dei Servizi (TS-CNS)" }]
    : [{ id: "cie", nome: "Carta d'Identità Elettronica" }];
  const titolo = metodo === "SPID" ? "Scegli il tuo gestore SPID"
    : metodo === "CNS" ? "Accesso con CNS" : "Accesso con CIE";
  const iconaVoce = metodo === "SPID" ? "user" : metodo === "CNS" ? "card" : "shield";
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", background: "#fff", borderRadius: 12, padding: "28px 26px", boxShadow: "0 2px 16px rgba(0,0,0,.08)" }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{titolo}</div>
      <p style={{ fontSize: 12.5, color: "#6b7280", margin: "0 0 18px" }}>
        {metodo === "CNS"
          ? "Simulazione — nel sistema reale serve la smart card inserita nel lettore e il PIN."
          : "Simulazione — nessun dato reale viene inviato a un provider esterno."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lista.map(p => (
          <button key={p.id} className="btn btn--subtle" style={{ justifyContent: "flex-start" }} onClick={() => onScegli(p.nome)}>
            <Icon name={iconaVoce} size={16} stroke={2} />{p.nome}
          </button>
        ))}
      </div>
      <button className="btn btn--subtle btn--sm" style={{ marginTop: 16 }} onClick={onIndietro}>
        <Icon name="arrowLeft" size={14} stroke={2} />Torna alla scelta del metodo
      </button>
    </div>
  );
}

export default function MockSpidLogin({ onIdentita }) {
  const [step, setStep] = useState("scelta"); // scelta | provider | assertion
  const [metodo, setMetodo] = useState(null);
  const [provider, setProvider] = useState(null);

  if (step === "provider") {
    return <ProviderPicker metodo={metodo}
      onScegli={(p) => { setProvider(p); setStep("assertion"); }}
      onIndietro={() => setStep("scelta")} />;
  }
  if (step === "assertion") {
    return <AssertionForm metodo={metodo} provider={provider}
      onAnnulla={() => setStep("scelta")}
      onConferma={onIdentita} />;
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", background: "#fff", borderRadius: 12, padding: "32px 26px", boxShadow: "0 2px 16px rgba(0,0,0,.08)", textAlign: "center" }}>
      <Icon name="lock" size={32} stroke={1.8} style={{ color: "#0066cc" }} />
      <h2 style={{ fontSize: 17, margin: "12px 0 6px" }}>Accedi per presentare un'istanza</h2>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 22px" }}>
        L'accesso allo Sportello Unico per l'Edilizia richiede identità digitale SPID, CIE o CNS.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => { setMetodo("SPID"); setStep("provider"); }}
          style={{ background: "#00825A", color: "#fff", border: "none", borderRadius: 24, padding: "12px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="user" size={17} stroke={2.2} />Entra con SPID
        </button>
        <button onClick={() => { setMetodo("CIE"); setStep("provider"); }}
          style={{ background: "#1256A3", color: "#fff", border: "none", borderRadius: 24, padding: "12px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="shield" size={17} stroke={2.2} />Entra con CIE
        </button>
        <button onClick={() => { setMetodo("CNS"); setStep("provider"); }}
          style={{ background: "#6C4F9C", color: "#fff", border: "none", borderRadius: 24, padding: "12px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="card" size={17} stroke={2.2} />Entra con CNS
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 18 }}>
        Prototipo dimostrativo: qui l'identità è simulata, non è una vera autenticazione SPID/CIE/CNS.
      </p>
    </div>
  );
}
