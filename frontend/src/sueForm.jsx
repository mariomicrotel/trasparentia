import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { Icon } from "./icons.jsx";

// Form di presentazione istanza SUE, condiviso tra:
// - il portale pubblico standalone (PortaleSUEPubblico.jsx, nessun login)
// - eventuali riusi interni futuri.
// Chiama gli endpoint FO, che sono PUBBLICI lato backend (nessun token richiesto).

export function CampoModulo({ campo, valore, onChange }) {
  const base = {
    width: "100%", boxSizing: "border-box", padding: "8px 10px",
    border: "1px solid var(--border)", borderRadius: 6, fontSize: 13,
    background: "var(--surface)", color: "var(--text)", fontFamily: "inherit",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
        {campo.label}{campo.required && <span style={{ color: "var(--rosso)" }}> *</span>}
      </label>
      {campo.tipo === "textarea" ? (
        <textarea rows={3} style={{ ...base, resize: "vertical" }} value={valore || ""} onChange={e => onChange(e.target.value)} />
      ) : (
        <input type={campo.tipo === "date" ? "date" : "text"} style={base} value={valore || ""} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}

export function Presenta({ toast, onFatto }) {
  const [cat, setCat] = useState(null);
  const [procId, setProcId] = useState("");
  const [pres, setPres] = useState({ nome: "", cf: "", email: "" });
  const [dati, setDati] = useState({});
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState(null);

  useEffect(() => { api.sueProcedimenti().then(r => setCat(r.procedimenti)).catch(() => setCat([])); }, []);

  const proc = (cat || []).find(p => p.id === procId);

  function scegli(id) { setProcId(id); setDati({}); setEsito(null); }

  async function invia() {
    setBusy(true);
    try {
      const r = await api.sueCreaIstanza({ procedimento: procId, presentatore: pres, dati });
      setEsito(r);
      toast(`Istanza presentata — CUI ${r.cui}`, "success");
      onFatto && onFatto();
    } catch (e) { toast(e.message || "Errore", ""); }
    finally { setBusy(false); }
  }

  if (esito) {
    return (
      <div className="card"><div className="card__body" style={{ textAlign: "center", padding: "32px 24px" }}>
        <Icon name="checkCircle" size={44} stroke={2} style={{ color: "var(--verde)" }} />
        <h3 style={{ margin: "12px 0 6px" }}>Istanza presentata con successo</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>
          Codice Unico Istanza (CUI): <b className="mono">{esito.cui}</b><br />
          Protocollo: <b className="mono">{esito.protocollo}</b> · Pratica: <b className="mono">{esito.praticaId}</b>
        </p>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", maxWidth: 460, margin: "10px auto 0" }}>
          L'istanza è stata protocollata e assegnata all'Ufficio Tecnico per l'istruttoria di back-office.
        </p>
        <button className="btn btn--subtle" style={{ marginTop: 16 }} onClick={() => { setEsito(null); setProcId(""); setPres({ nome: "", cf: "", email: "" }); setDati({}); }}>
          <Icon name="plus" size={15} stroke={2} />Presenta un'altra istanza
        </button>
      </div></div>
    );
  }

  return (
    <div className="card">
      <div className="card__body">
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Procedimento edilizio</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {(cat || []).map(p => (
              <button key={p.id} onClick={() => scegli(p.id)}
                className={"btn btn--sm " + (procId === p.id ? "btn--primary" : "btn--subtle")}
                title={`${p.regime} · ${p.norma}`}>
                {p.nome}
              </button>
            ))}
          </div>
          {proc && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
              Regime: <b>{proc.regime}</b> · {proc.sub_context} · norma: {proc.norma}
              {proc.termineGiorni > 0 ? ` · termine ${proc.termineGiorni} gg` : " · efficacia immediata"}
            </div>
          )}
        </div>

        {proc && (
          <>
            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", margin: "6px 0 8px" }}>Presentatore</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <CampoModulo campo={{ label: "Nome e cognome", tipo: "text", required: true }} valore={pres.nome} onChange={v => setPres(s => ({ ...s, nome: v }))} />
              <CampoModulo campo={{ label: "Codice fiscale", tipo: "text" }} valore={pres.cf} onChange={v => setPres(s => ({ ...s, cf: v }))} />
              <CampoModulo campo={{ label: "Email", tipo: "text" }} valore={pres.email} onChange={v => setPres(s => ({ ...s, email: v }))} />
            </div>

            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", margin: "6px 0 8px" }}>Modulo digitale</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {proc.campi.map(c => (
                <div key={c.key} style={{ gridColumn: c.tipo === "textarea" ? "1 / -1" : "auto" }}>
                  <CampoModulo campo={c} valore={dati[c.key]} onChange={v => setDati(d => ({ ...d, [c.key]: v }))} />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn btn--primary" disabled={busy || !pres.nome.trim()} onClick={invia}>
                <Icon name="send" size={15} stroke={2} />{busy ? "Invio…" : "Invia istanza"}
              </button>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <Icon name="info" size={13} stroke={2} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Prototipo: identità SPID/CIE, firma e Catalogo SSU nazionale sono simulati.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
