import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { Icon } from "./icons.jsx";
import { scaricaRicevuta } from "./sueRicevuta.js";

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

// Passi del wizard di inserimento (cfr. Guida operativa SUE — «Inserimento nuove pratiche»).
const STEPS = [
  { key: "procedimento", label: "Procedimento" },
  { key: "presentata_da", label: "Presentata da" },
  { key: "dati", label: "Dati dell'istanza" },
  { key: "allegati", label: "Allegati" },
  { key: "riepilogo", label: "Riepilogo" },
];

// Intestazione a step (stepper). Cliccando uno step già raggiunto si torna indietro.
function Stepper({ step, maxRaggiunto, onVai }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
      {STEPS.map((s, i) => {
        const attivo = i === step, fatto = i < step, cliccabile = i <= maxRaggiunto;
        return (
          <button key={s.key} onClick={() => cliccabile && onVai(i)} disabled={!cliccabile}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20,
              border: "1px solid " + (attivo ? "var(--blu, #0066cc)" : "var(--border)"),
              background: attivo ? "var(--blu, #0066cc)" : fatto ? "var(--verde-bg, #f0faf4)" : "var(--surface)",
              color: attivo ? "#fff" : "var(--text)", fontSize: 12, fontWeight: 600,
              cursor: cliccabile ? "pointer" : "default", opacity: cliccabile ? 1 : .55,
            }}>
            <span style={{
              width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 10.5, fontWeight: 700,
              background: attivo ? "rgba(255,255,255,.25)" : fatto ? "var(--verde, #1a7a45)" : "var(--surface-2, #eef1f5)",
              color: attivo ? "#fff" : fatto ? "#fff" : "var(--text-muted)",
            }}>{fatto ? "✓" : i + 1}</span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function Presenta({ toast, onFatto, identita, onCambiaIdentita }) {
  const [cat, setCat] = useState(null);
  const [docDelega, setDocDelega] = useState(null);
  const [step, setStep] = useState(0);
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

  // Controlli per step (abilitano «Prosegui»).
  const docObblMancanti = documenti.filter(d => d.obbligatorio && !allegati[d.key]);
  const deleganteIncompleto = delega && !(delegante.nome.trim() && delegante.cognome.trim() && delegante.cf.trim());
  const emailMancante = !email.trim();
  const campiMancanti = proc ? proc.campi.filter(c => c.required && !String(dati[c.key] || "").trim()) : [];

  function stepValido(i) {
    if (i === 0) return !!procId;
    if (i === 1) return !emailMancante && !deleganteIncompleto;
    if (i === 2) return campiMancanti.length === 0;
    if (i === 3) return docObblMancanti.length === 0;
    return true;
  }
  const puoAvanzare = stepValido(step);

  function scegli(id) { setProcId(id); setDati({}); setAllegati({}); }
  function reset() {
    setStep(0); setProcId(""); setRuolo("in_proprio"); setDelegante({ nome: "", cognome: "", cf: "" });
    setDati({}); setAllegati({}); setEsito(null); setEmail(identita?.email || "");
  }

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

  // ── Esito: istanza inviata, con ricevuta scaricabile (art. 18-bis) ──────────
  if (esito) {
    return (
      <div className="card"><div className="card__body" style={{ textAlign: "center", padding: "32px 24px" }}>
        <Icon name="checkCircle" size={44} stroke={2} style={{ color: "var(--verde)" }} />
        <h3 style={{ margin: "12px 0 6px" }}>Istanza trasmessa con successo</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13.5 }}>
          Codice Unico Istanza (CUI): <b className="mono">{esito.cui}</b><br />
          Protocollo: <b className="mono">{esito.protocollo}</b> · Pratica: <b className="mono">{esito.praticaId}</b>
        </p>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", maxWidth: 480, margin: "10px auto 0" }}>
          L'istanza è stata protocollata e assegnata all'Ufficio Tecnico. Scarica la ricevuta di
          avvenuta trasmissione (vale come avvio del procedimento, art. 18-bis L. 241/1990). La trovi
          anche in «Le mie istanze».
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 18 }}>
          <button className="btn btn--primary" onClick={() => scaricaRicevuta(esito.istanza || {}, { protocollo: esito.protocollo, praticaId: esito.praticaId })}>
            <Icon name="download" size={15} stroke={2} />Scarica ricevuta
          </button>
          <button className="btn btn--subtle" onClick={reset}>
            <Icon name="plus" size={15} stroke={2} />Presenta un'altra istanza
          </button>
        </div>
      </div></div>
    );
  }

  const stepKey = STEPS[step].key;

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

        <Stepper step={step} maxRaggiunto={step} onVai={setStep} />

        {/* ── Step 0: scelta del procedimento ─────────────────────────────── */}
        {stepKey === "procedimento" && (
          <div>
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
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 12.5, color: "var(--text-muted)" }}>
                <div><b style={{ color: "var(--text)" }}>{proc.nome}</b></div>
                Regime: <b>{proc.regime}</b> · {proc.sub_context} · norma: {proc.norma}
                {proc.termineGiorni > 0 ? ` · termine ${proc.termineGiorni} giorni` : " · efficacia immediata"}
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: presentata da (ruolo + delegante + contatto) ─────────── */}
        {stepKey === "presentata_da" && (
          <div>
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

            {delega && (
              <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
                  Titolare / richiedente delegante
                </div>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
                  Chi conferisce l'incarico. L'atto di delega va allegato nello step «Allegati».
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <CampoModulo campo={{ label: "Nome", tipo: "text", required: true }} valore={delegante.nome} onChange={v => setDelegante(d => ({ ...d, nome: v }))} />
                  <CampoModulo campo={{ label: "Cognome", tipo: "text", required: true }} valore={delegante.cognome} onChange={v => setDelegante(d => ({ ...d, cognome: v }))} />
                  <CampoModulo campo={{ label: "Codice fiscale", tipo: "text", required: true }} valore={delegante.cf} onChange={v => setDelegante(d => ({ ...d, cf: v.toUpperCase() }))} />
                </div>
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", margin: "16px 0 8px" }}>Contatto</div>
            <div style={{ maxWidth: 340 }}>
              <CampoModulo campo={{ label: "Email per le comunicazioni", tipo: "text", required: true }} valore={email} onChange={setEmail} />
            </div>
          </div>
        )}

        {/* ── Step 2: dati dell'istanza (per sezione) ──────────────────────── */}
        {stepKey === "dati" && proc && (
          <div>
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
          </div>
        )}

        {/* ── Step 3: allegati ─────────────────────────────────────────────── */}
        {stepKey === "allegati" && (
          <div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px" }}>
              I documenti contrassegnati come <b>OBBLIGATORIO</b> sono necessari per proseguire.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {documenti.map(doc => (
                <RigaDocumento key={doc.key} doc={doc} allegato={allegati[doc.key]}
                  onFile={(a) => setAllegati(prev => ({ ...prev, [doc.key]: a }))}
                  onErrore={(m) => toast(m, "")} />
              ))}
            </div>
          </div>
        )}

        {/* ── Step 4: riepilogo ────────────────────────────────────────────── */}
        {stepKey === "riepilogo" && proc && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{proc.nome}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
              {proc.regime} · {proc.sub_context} · {proc.norma}
              {proc.termineGiorni > 0 ? ` · termine ${proc.termineGiorni} gg` : " · efficacia immediata"}
            </div>

            <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, margin: "10px 0 6px" }}>Presentata da</div>
            <div style={{ fontSize: 13 }}>
              {delega
                ? <>Titolare <b>{delegante.nome} {delegante.cognome}</b> (CF {delegante.cf}) · presentata dal tecnico <b>{identita.nome} {identita.cognome}</b></>
                : <><b>{identita.nome} {identita.cognome}</b> (in proprio) · CF {identita.cf}</>}
              <div style={{ color: "var(--text-muted)" }}>Email: {email || "—"}</div>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, margin: "14px 0 6px" }}>Dati dell'istanza</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
              {proc.campi.filter(c => String(dati[c.key] || "").trim()).map(c => (
                <div key={c.key} style={{ fontSize: 12.5 }}>
                  <span style={{ color: "var(--text-muted)" }}>{c.label}:</span> <b>{dati[c.key]}</b>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, margin: "14px 0 6px" }}>Documentazione ({Object.keys(allegati).length})</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
              {Object.values(allegati).map(a => (
                <li key={a.tipoDoc}>{a.label} — <span className="mono" style={{ color: "var(--text-muted)" }}>{a.nome}</span></li>
              ))}
              {!Object.keys(allegati).length && <li style={{ color: "var(--text-muted)" }}>Nessun allegato</li>}
            </ul>

            <div className="banner banner--info" style={{ marginTop: 16, fontSize: 12.5 }}>
              <Icon name="info" size={15} stroke={2} />
              <span>Alla conclusione l'istanza viene protocollata e ricevi la ricevuta di trasmissione. Prototipo: firma digitale e Catalogo SSU nazionale sono simulati.</span>
            </div>
          </div>
        )}

        {/* ── Navigazione wizard ───────────────────────────────────────────── */}
        <div style={{ marginTop: 20, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn--subtle" disabled={step === 0 || busy} onClick={() => setStep(s => Math.max(0, s - 1))}>
            <Icon name="arrowLeft" size={15} stroke={2} />Indietro
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn--primary" disabled={!puoAvanzare} onClick={() => setStep(s => s + 1)}>
              Prosegui<Icon name="arrowRight" size={15} stroke={2} />
            </button>
          ) : (
            <button className="btn btn--primary" disabled={busy || !identita} onClick={invia}>
              <Icon name="send" size={15} stroke={2} />{busy ? "Invio…" : "Concludi e invia"}
            </button>
          )}

          {/* Motivo del blocco «Prosegui» per lo step corrente. */}
          {!puoAvanzare && step === 0 && <span style={hintStyle}>Seleziona un procedimento</span>}
          {!puoAvanzare && step === 1 && (
            <span style={hintStyle}>
              {emailMancante ? "Inserisci l'email di contatto" : "Completa i dati del titolare delegante"}
            </span>
          )}
          {!puoAvanzare && step === 2 && (
            <span style={hintStyle}>{campiMancanti.length} campo{campiMancanti.length === 1 ? "" : "i"} obbligatori da compilare</span>
          )}
          {!puoAvanzare && step === 3 && (
            <span style={hintStyle}>{docObblMancanti.length} documento{docObblMancanti.length === 1 ? "" : "i"} obbligatori da allegare</span>
          )}
        </div>
      </div>
    </div>
  );
}

const hintStyle = { fontSize: 12, color: "var(--rosso, #a62c2c)", fontWeight: 600 };

// ── «Le mie istanze» ─────────────────────────────────────────────────────────
// Consultazione FO delle pratiche del titolare del codice fiscale (presentate in
// proprio o come tecnico delegato), con stato e ricevuta scaricabile.
const STATO_LABEL = {
  presentata: { txt: "Presentata / protocollata", bg: "var(--verde-bg, #f0faf4)", fg: "var(--verde, #1a7a45)" },
};

export function MieIstanze({ identita, toast }) {
  const [ist, setIst] = useState(null);

  useEffect(() => {
    if (!identita?.cf) { setIst([]); return; }
    api.sueMieIstanze(identita.cf).then(r => setIst(r.istanze)).catch(() => setIst([]));
  }, [identita]);

  if (ist === null) return <div className="card"><div className="card__body"><div className="muted">Caricamento…</div></div></div>;
  if (!ist.length) return (
    <div className="card"><div className="card__body">
      <div className="muted" style={{ fontSize: 13.5 }}>
        Nessuna istanza collegata al codice fiscale <b className="mono">{identita?.cf}</b>.
        Usa «Presenta istanza» per inviarne una.
      </div>
    </div></div>
  );

  return (
    <div className="card"><div className="card__body">
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
        {ist.length} istanz{ist.length === 1 ? "a" : "e"} collegat{ist.length === 1 ? "a" : "e"} a <b className="mono">{identita?.cf}</b>.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ist.map(i => {
          const st = STATO_LABEL[i.stato] || { txt: i.stato, bg: "var(--surface-2)", fg: "var(--text-muted)" };
          const delega = i.ruoloPresentatore === "tecnico_delegato";
          return (
            <div key={i.cui} style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Icon name="building" size={20} stroke={1.9} style={{ color: "var(--blu, #0066cc)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{i.procedimento}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    CUI <span className="mono">{i.cui}</span> · protocollo <span className="mono">{i.protocollo || "—"}</span> · {i.creato}
                  </div>
                  {delega && (
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                      Titolare {[i.deleganteNome, i.deleganteCognome].filter(Boolean).join(" ") || "—"} · come tecnico
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 12, background: st.bg, color: st.fg, whiteSpace: "nowrap" }}>
                  {st.txt}
                </span>
                <button className="btn btn--subtle btn--sm" onClick={() => scaricaRicevuta(i)}>
                  <Icon name="download" size={13} stroke={2} />Ricevuta
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div></div>
  );
}
