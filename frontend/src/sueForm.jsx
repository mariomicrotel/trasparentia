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
      ) : campo.tipo === "select" ? (
        <select style={base} value={valore || ""} onChange={e => onChange(e.target.value)}>
          <option value="">— seleziona —</option>
          {(campo.opzioni || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={campo.tipo === "date" ? "date" : "text"} style={base} value={valore || ""} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}

// Riga di un documento richiesto: badge obbligatorio/facoltativo + selezione file.
// Il file viene CARICATO subito su MinIO (endpoint pubblico): si ottiene il
// documentoId con cui l'allegato sarà agganciato all'istanza all'invio.
function RigaDocumento({ doc, allegato, onFile, onErrore }) {
  const [busy, setBusy] = useState(false);

  async function scegliFile(f) {
    if (!f) return;
    setBusy(true);
    try {
      const r = await api.sueUploadAllegato(doc.key, f);
      onFile({ tipoDoc: doc.key, label: doc.label, nome: r.nome, size: r.size,
               contentType: r.contentType, documentoId: r.documentoId });
    } catch (e) {
      onErrore && onErrore(e.message || "Caricamento non riuscito");
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8,
                  border: "1px solid var(--border)", background: allegato ? "var(--verde-bg, #f0faf4)" : "var(--surface)" }}>
      <Icon name={busy ? "loader" : allegato ? "checkCircle" : "fileText"} size={16} stroke={2}
            style={{ color: allegato ? "var(--verde)" : "var(--text-muted)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {doc.label}
          <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 8, padding: "1px 6px", borderRadius: 4,
                         background: doc.obbligatorio ? "var(--rosso-bg, #fdecec)" : "var(--surface-2, #eef1f5)",
                         color: doc.obbligatorio ? "var(--rosso, #a62c2c)" : "var(--text-muted)" }}>
            {doc.obbligatorio ? "OBBLIGATORIO" : "facoltativo"}
          </span>
        </div>
        {busy && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Caricamento…</div>}
        {!busy && allegato && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{allegato.nome} · {Math.round((allegato.size || 0) / 1024)} KB · caricato</div>}
      </div>
      <label className="btn btn--subtle btn--sm" style={{ cursor: busy ? "default" : "pointer", flexShrink: 0, opacity: busy ? .6 : 1 }}>
        <Icon name="upload" size={13} stroke={2} />{allegato ? "Sostituisci" : "Allega"}
        <input type="file" disabled={busy} style={{ display: "none" }}
               onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; scegliFile(f); }} />
      </label>
    </div>
  );
}

export function Presenta({ toast, onFatto, identita, onCambiaIdentita }) {
  const [cat, setCat] = useState(null);
  const [docDelega, setDocDelega] = useState(null);
  const [procId, setProcId] = useState("");
  const [email, setEmail] = useState(identita?.email || "");
  const [ruolo, setRuolo] = useState("in_proprio");        // in_proprio | tecnico_delegato
  const [delegante, setDelegante] = useState({ nome: "", cognome: "", cf: "" });
  const [dati, setDati] = useState({});
  const [allegati, setAllegati] = useState({});   // tipoDoc → {tipoDoc,label,nome,size}
  const [busy, setBusy] = useState(false);
  const [esito, setEsito] = useState(null);

  useEffect(() => {
    api.sueProcedimenti()
      .then(r => { setCat(r.procedimenti); setDocDelega(r.docDelega || null); })
      .catch(() => setCat([]));
  }, []);

  const proc = (cat || []).find(p => p.id === procId);
  const delega = ruolo === "tecnico_delegato";

  // Documenti richiesti: quelli del procedimento + l'atto di delega se tecnico delegato.
  const documenti = [
    ...(proc?.documenti || []),
    ...(delega && docDelega ? [docDelega] : []),
  ];

  function scegli(id) { setProcId(id); setDati({}); setAllegati({}); setEsito(null); }

  async function invia() {
    const presentatore = { nome: identita.nome, cognome: identita.cognome, cf: identita.cf, email };
    setBusy(true);
    try {
      const payload = { procedimento: procId, presentatore, dati, allegati: Object.values(allegati), ruolo };
      if (delega) payload.delegante = delegante;
      const r = await api.sueCreaIstanza(payload);
      setEsito(r);
      toast(`Istanza presentata — CUI ${r.cui}`, "success");
      onFatto && onFatto();
    } catch (e) { toast(e.message || "Errore", ""); }
    finally { setBusy(false); }
  }

  // Documenti obbligatori mancanti (per spiegare il pulsante Invia).
  const docObblMancanti = documenti.filter(d => d.obbligatorio && !allegati[d.key]);
  // Dati del delegante mancanti (blocca l'invio se tecnico delegato).
  const deleganteIncompleto = delega && !(delegante.nome.trim() && delegante.cognome.trim() && delegante.cf.trim());

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
        <button className="btn btn--subtle" style={{ marginTop: 16 }} onClick={() => { setEsito(null); setProcId(""); setDati({}); setAllegati({}); }}>
          <Icon name="plus" size={15} stroke={2} />Presenta un'altra istanza
        </button>
      </div></div>
    );
  }

  return (
    <div className="card">
      <div className="card__body">
        {identita && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 16,
                       borderRadius: 8, background: "var(--verde-bg, #f0faf4)", border: "1px solid var(--verde, #1a7a45)" }}>
            <Icon name="checkCircle" size={16} stroke={2} style={{ color: "var(--verde)", flexShrink: 0 }} />
            <div style={{ fontSize: 13, flex: 1 }}>
              Identità verificata: <b>{identita.nome} {identita.cognome}</b>
              <span style={{ color: "var(--text-muted)" }}> · CF {identita.cf}</span>
              {delega && <span style={{ color: "var(--text-muted)" }}> · presenta come tecnico incaricato</span>}
            </div>
            {onCambiaIdentita && (
              <button className="btn btn--subtle btn--sm" onClick={onCambiaIdentita}>Esci</button>
            )}
          </div>
        )}

        {/* Ruolo di chi presenta: diretto interessato oppure tecnico delegato. */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Presento la domanda</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            <button onClick={() => setRuolo("in_proprio")}
              className={"btn btn--sm " + (!delega ? "btn--primary" : "btn--subtle")}>
              <Icon name="user" size={13} stroke={2} />In proprio (diretto interessato)
            </button>
            <button onClick={() => setRuolo("tecnico_delegato")}
              className={"btn btn--sm " + (delega ? "btn--primary" : "btn--subtle")}>
              <Icon name="signature" size={13} stroke={2} />Come tecnico incaricato / delegato
            </button>
          </div>
        </div>

        {/* Dati del titolare (delegante): solo quando presenta un tecnico delegato. */}
        {delega && (
          <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
              Titolare / richiedente delegante
            </div>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
              Chi conferisce l'incarico. L'atto di delega va allegato tra i documenti.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <CampoModulo campo={{ label: "Nome", tipo: "text", required: true }} valore={delegante.nome} onChange={v => setDelegante(d => ({ ...d, nome: v }))} />
              <CampoModulo campo={{ label: "Cognome", tipo: "text", required: true }} valore={delegante.cognome} onChange={v => setDelegante(d => ({ ...d, cognome: v }))} />
              <CampoModulo campo={{ label: "Codice fiscale", tipo: "text", required: true }} valore={delegante.cf} onChange={v => setDelegante(d => ({ ...d, cf: v.toUpperCase() }))} />
            </div>
          </div>
        )}

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
            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", margin: "6px 0 8px" }}>Contatto</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 16, maxWidth: 320 }}>
              <CampoModulo campo={{ label: "Email per le comunicazioni", tipo: "text" }} valore={email} onChange={setEmail} />
            </div>

            {/* Modulo digitale, raggruppato per sezione (modulistica unificata). */}
            {[...new Set(proc.campi.map(c => c.sezione || "Dati"))].map(sez => (
              <div key={sez} style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", margin: "10px 0 8px" }}>{sez}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {proc.campi.filter(c => (c.sezione || "Dati") === sez).map(c => (
                    <div key={c.key} style={{ gridColumn: c.tipo === "textarea" ? "1 / -1" : "auto" }}>
                      <CampoModulo campo={c} valore={dati[c.key]} onChange={v => setDati(d => ({ ...d, [c.key]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Documenti da allegare (+ atto di delega se tecnico delegato). */}
            {documenti.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", margin: "10px 0 8px" }}>
                  Documenti da allegare
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {documenti.map(doc => (
                    <RigaDocumento key={doc.key} doc={doc} allegato={allegati[doc.key]}
                      onFile={(a) => setAllegati(prev => ({ ...prev, [doc.key]: a }))}
                      onErrore={(m) => toast(m, "")} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 18, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn--primary" disabled={busy || !identita || deleganteIncompleto} onClick={invia}>
                <Icon name="send" size={15} stroke={2} />{busy ? "Invio…" : "Invia istanza"}
              </button>
              {deleganteIncompleto && (
                <span style={{ fontSize: 12, color: "var(--rosso, #a62c2c)", fontWeight: 600 }}>
                  <Icon name="alertCircle" size={13} stroke={2} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Completa i dati del titolare delegante
                </span>
              )}
              {docObblMancanti.length > 0 && (
                <span style={{ fontSize: 12, color: "var(--rosso, #a62c2c)", fontWeight: 600 }}>
                  <Icon name="alertCircle" size={13} stroke={2} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  {docObblMancanti.length} document{docObblMancanti.length === 1 ? "o" : "i"} obbligatori{docObblMancanti.length === 1 ? "o" : ""} da allegare
                </span>
              )}
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <Icon name="info" size={13} stroke={2} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Prototipo: firma e Catalogo SSU nazionale sono simulati.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
