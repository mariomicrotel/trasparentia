import React, { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";

// Gestione del corpus normativo su cui l'assistente redazionale fonda gli atti.
// Riservata al Segretario (permesso supervisione).

const MATERIE = ["", "urbanistica", "edilizia", "commercio", "tributi", "ambiente",
                 "personale", "anagrafe", "polizia_locale", "contabilita", "generale"];

function Stat({ label, value, tone }) {
  return (
    <div style={{ flex: 1, minWidth: 120, padding: "10px 14px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone || "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

export default function Regolamenti({ M, me, toast, tick, nav }) {
  const canAdmin = !!(M.perm?.[me]?.supervisione);

  const [data, setData]     = useState(null);   // { regolamenti, ...status }
  const [mode, setMode]     = useState("file"); // file | testo | url
  const [busy, setBusy]     = useState(false);
  const [titolo, setTitolo] = useState("");
  const [materia, setMateria] = useState("");
  const [testo, setTesto]   = useState("");
  const [url, setUrl]       = useState("");
  const fileRef = useRef(null);

  const load = useCallback(() => {
    if (!canAdmin) return;
    api.normativaLista(me).then(setData).catch(() => setData({ regolamenti: [], stato: {} }));
  }, [me, canAdmin]);

  useEffect(() => { load(); }, [tick, load]);

  if (!canAdmin) {
    return (
      <div className="page">
        <div className="empty card" style={{ padding: "64px 24px" }}>
          <Icon name="lock" size={40} />
          <h3>Accesso riservato</h3>
          <p>La gestione del corpus normativo è disponibile solo per il Segretario Comunale.</p>
          <button className="btn btn--subtle" onClick={() => nav("cruscotto")}>
            <Icon name="grid" size={16} stroke={2} />Torna al cruscotto
          </button>
        </div>
      </div>
    );
  }

  function esitoIngest(res) {
    toast(`«${res.titolo}»: ${res.articoli} articoli, ${res.chunk} segmenti, ${res.embeddati} indicizzati`, "success");
    setTitolo(""); setMateria(""); setTesto(""); setUrl("");
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function importFile(files) {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    try { esitoIngest(await api.normativaImportFile(f, titolo, materia, me)); }
    catch (e) { toast(e.message || "Import fallito", ""); }
    finally { setBusy(false); }
  }

  async function importTesto() {
    if (!titolo.trim() || !testo.trim()) { toast("Titolo e testo obbligatori", ""); return; }
    setBusy(true);
    try { esitoIngest(await api.normativaImportTesto({ titolo: titolo.trim(), materia, testo: testo.trim() }, me)); }
    catch (e) { toast(e.message || "Import fallito", ""); }
    finally { setBusy(false); }
  }

  async function importUrl() {
    if (!url.trim()) { toast("URL obbligatorio", ""); return; }
    setBusy(true);
    try { esitoIngest(await api.normativaImportUrl({ url: url.trim(), titolo: titolo.trim(), materia }, me)); }
    catch (e) { toast(e.message || "Import fallito", ""); }
    finally { setBusy(false); }
  }

  async function toggleVigenza(r) {
    try { await api.normativaVigenza(r.id, !r.vigente, me); toast(r.vigente ? "Marcato non vigente" : "Marcato vigente", ""); load(); }
    catch (e) { toast(e.message || "Errore", ""); }
  }

  async function elimina(r) {
    if (!window.confirm(`Eliminare «${r.titolo}» dal corpus? L'assistente non potrà più fondarsi su questo regolamento.`)) return;
    try { await api.normativaElimina(r.id, me); toast("Regolamento eliminato", ""); load(); }
    catch (e) { toast(e.message || "Errore", ""); }
  }

  async function rigeneraEmbedding() {
    setBusy(true);
    try { const r = await api.normativaEmbedPending(me); toast(`Indicizzati ${r.embeddati} segmenti`, "success"); load(); }
    catch (e) { toast(e.message || "Errore", ""); }
    finally { setBusy(false); }
  }

  const regs = data?.regolamenti || [];
  const st = data?.stato || {};
  const mancanti = data ? ((st.chunk || 0) - (st.conEmbedding || 0)) : 0;
  const inputStyle = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6,
                       fontSize: 13, background: "var(--surface)", color: "var(--text)", width: "100%", boxSizing: "border-box" };

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Corpus normativo</span></div>
          <h1>Regolamenti e normative</h1>
          <p>Base di conoscenza su cui l'assistente redazionale fonda gli atti. Solo i regolamenti <b>vigenti</b> e <b>indicizzati</b> vengono usati; in assenza di base pertinente l'AI si rifiuta di redigere.</p>
        </div>
      </div>

      {/* Stato del corpus */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Stat label="Regolamenti" value={st.regolamenti ?? "—"} />
        <Stat label="Vigenti" value={st.vigenti ?? "—"} tone="var(--verde)" />
        <Stat label="Segmenti" value={st.chunk ?? "—"} />
        <Stat label="Indicizzati" value={st.conEmbedding ?? "—"}
              tone={st.semanticaPronta ? "var(--verde)" : "var(--rosso)"} />
      </div>

      {mancanti > 0 && (
        <div className="banner banner--info" style={{ marginBottom: 16, fontSize: 13 }}>
          <Icon name="alertCircle" size={16} stroke={2} />
          <span>{mancanti} segmenti non ancora indicizzati (server AI offline durante l'import?).</span>
          <button className="btn btn--subtle btn--sm" style={{ marginLeft: 8 }} onClick={rigeneraEmbedding} disabled={busy}>
            <Icon name="refresh" size={13} stroke={2} />Rigenera indice
          </button>
        </div>
      )}

      {/* Import */}
      <div className="card" style={{ marginBottom: 16, border: "1.5px solid var(--blu)" }}>
        <div className="card__head">
          <Icon name="plus" size={17} stroke={2} style={{ color: "var(--blu)" }} />
          <h3 style={{ flex: 1, color: "var(--blu)" }}>Aggiungi al corpus</h3>
        </div>
        <div className="card__body">
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {[["file", "File (PDF/DOCX)", "upload"], ["testo", "Incolla testo", "fileText"], ["url", "Da URL", "link"]].map(([k, lbl, ico]) => (
              <button key={k} className={"btn btn--sm " + (mode === k ? "btn--primary" : "btn--subtle")} onClick={() => setMode(k)}>
                <Icon name={ico} size={14} stroke={2} />{lbl}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
                Titolo {mode === "file" ? "(opzionale, default nome file)" : "*"}
              </label>
              <input style={inputStyle} value={titolo} onChange={e => setTitolo(e.target.value)}
                     placeholder="Es. Regolamento edilizio comunale" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>Materia</label>
              <select style={inputStyle} value={materia} onChange={e => setMateria(e.target.value)}>
                {MATERIE.map(m => <option key={m} value={m}>{m || "— non specificata —"}</option>)}
              </select>
            </div>
          </div>

          {mode === "file" && (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }}
                     onChange={e => importFile(e.target.files)} />
              <button className="btn btn--primary" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Icon name="upload" size={15} stroke={2} />{busy ? "Elaborazione…" : "Scegli file e importa"}
              </button>
              <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-muted)" }}>
                PDF (anche scansionati, con OCR) o DOCX. Il testo viene spezzato per articolo.
              </span>
            </>
          )}

          {mode === "testo" && (
            <>
              <textarea value={testo} onChange={e => setTesto(e.target.value)} rows={10}
                        placeholder={"Incolla qui il testo del regolamento.\n\nArt. 1 - Oggetto\n…\n\nArt. 2 - …"}
                        style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12.5, resize: "vertical", marginBottom: 10 }} />
              <button className="btn btn--primary" onClick={importTesto} disabled={busy}>
                <Icon name="check" size={15} stroke={2} />{busy ? "Elaborazione…" : "Importa testo"}
              </button>
            </>
          )}

          {mode === "url" && (
            <>
              <input style={{ ...inputStyle, marginBottom: 10 }} value={url} onChange={e => setUrl(e.target.value)}
                     placeholder="https://… (Albo pretorio, Normattiva, PDF pubblico)" />
              <button className="btn btn--primary" onClick={importUrl} disabled={busy}>
                <Icon name="link" size={15} stroke={2} />{busy ? "Scaricamento…" : "Scarica e importa"}
              </button>
              <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-muted)" }}>
                Solo scaricamento di testi pubblici: nessun dato dell'ente esce.
              </span>
            </>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="card">
        <div className="card__body">
          {data === null && <div className="muted" style={{ padding: 16 }}>Caricamento…</div>}
          {regs.length === 0 && data !== null && (
            <div className="muted" style={{ padding: 16 }}>Nessun regolamento nel corpus. Aggiungine uno per abilitare l'assistente redazionale.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {regs.map(r => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 8, border: "1px solid var(--border)",
                background: r.vigente ? "var(--surface-2)" : "var(--surface)",
                opacity: r.vigente ? 1 : 0.6,
              }}>
                <Icon name="gavel" size={20} stroke={1.9} style={{ color: "var(--blu)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    {r.titolo}
                    {!r.vigente && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: "var(--surface-2)", color: "var(--text-muted)" }}>NON VIGENTE</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {r.nArticoli} articoli · {r.chunk} segmenti · {r.conEmbedding} indicizzati
                    {r.materia ? ` · ${r.materia}` : ""}{r.fonte ? ` · ${r.fonte.split(":")[0]}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="btn btn--subtle btn--sm"
                          style={{ borderColor: r.vigente ? "var(--text-muted)" : "var(--verde)", color: r.vigente ? "var(--text-muted)" : "var(--verde)" }}
                          onClick={() => toggleVigenza(r)} title={r.vigente ? "Marca non vigente (escluso dal RAG)" : "Marca vigente"}>
                    <Icon name={r.vigente ? "x" : "check"} size={13} stroke={2} />{r.vigente ? "Sospendi" : "Attiva"}
                  </button>
                  <button className="btn btn--subtle btn--sm" style={{ borderColor: "var(--rosso)", color: "var(--rosso)" }}
                          onClick={() => elimina(r)} title="Elimina dal corpus">
                    <Icon name="trash" size={13} stroke={2} />Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
