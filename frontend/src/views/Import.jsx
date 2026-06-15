import React, { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";

const CATEGORIE_LABEL = {
  istanza_cittadino: "Istanza cittadino", comunicazione_pa: "Comunicazione PA",
  pratica_tecnica: "Pratica tecnica", richiesta_tributi: "Tributi",
  richiesta_anagrafica: "Anagrafe", documento_contabile: "Contabilità",
  segnalazione: "Segnalazione", reclamo: "Reclamo", accesso_atti: "Accesso atti",
  ordinanza: "Ordinanza", determina: "Determina", delibera: "Delibera",
  da_pubblicare: "Da pubblicare", richiesta_integrazione: "Richiesta integrazione",
  comunicazione_urgente: "Urgente", scadenza_amm: "Scadenza amm.",
};

const STATO_META = {
  in_coda:      { lbl: "In coda",      col: "var(--text-muted)",  bg: "var(--surface-2)" },
  classificato: { lbl: "Classificato", col: "var(--blu)",         bg: "#e8f0fe" },
  applicato:    { lbl: "Importato",    col: "var(--verde)",       bg: "var(--verde-bg)" },
  scartato:     { lbl: "Scartato",     col: "var(--text-faint)",  bg: "var(--surface-2)" },
};

function ConfBar({ v }) {
  const pct = Math.round((v || 0) * 100);
  const col = pct >= 75 ? "var(--verde)" : pct >= 45 ? "var(--arancio, #e67e22)" : "var(--rosso)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: col, fontWeight: 700, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function ItemCard({ item, onClassifica, onApplica, onScarta, busy }) {
  const [expanded, setExpanded] = useState(false);
  const sm = STATO_META[item.stato] || STATO_META.in_coda;
  const cat = item.ai?.categoria;
  const catLabel = cat ? (CATEGORIE_LABEL[cat] || cat) : null;
  const conf = item.ai?.confidenza;
  const fonte = item.ai?._fonte;

  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "10px 14px",
      background: item.stato === "scartato" ? "var(--surface-2)" : "var(--surface)",
      opacity: item.stato === "scartato" ? 0.55 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Icon name="fileText" size={16} stroke={2} style={{ color: "var(--text-muted)", marginTop: 2, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.filename}
          </div>
          {catLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "var(--blu-bg, #e8f0fe)", color: "var(--blu)" }}>
                {catLabel}
              </span>
              {conf !== undefined && fonte !== "fallback" && <ConfBar v={conf} />}
              {fonte === "fallback" && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>classificazione manuale</span>
              )}
            </div>
          )}
          {item.ai?.motivazione && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
              {item.ai.motivazione.slice(0, 120)}{item.ai.motivazione.length > 120 ? "…" : ""}
            </div>
          )}
        </div>

        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 10,
                       background: sm.bg, color: sm.col, whiteSpace: "nowrap", flexShrink: 0 }}>
          {sm.lbl}
        </span>
      </div>

      {/* anteprima testo */}
      {item.testo && (
        <div style={{ marginTop: 8 }}>
          <button className="btn btn--subtle btn--sm" onClick={() => setExpanded(e => !e)} style={{ fontSize: 11 }}>
            <Icon name={expanded ? "chevronDown" : "chevronRight"} size={12} stroke={2} />
            {expanded ? "Nascondi testo" : "Mostra anteprima"}
          </button>
          {expanded && (
            <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 6, background: "var(--surface-2)",
                          fontSize: 12, color: "var(--text-muted)", maxHeight: 140, overflowY: "auto",
                          fontFamily: "monospace", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {item.testo.slice(0, 600)}{item.testo.length > 600 ? "…" : ""}
            </div>
          )}
        </div>
      )}

      {/* azioni */}
      {item.stato !== "applicato" && item.stato !== "scartato" && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {item.stato === "in_coda" && (
            <button className="btn btn--subtle btn--sm" onClick={() => onClassifica(item.id)} disabled={busy}>
              <Icon name="sparkles" size={13} stroke={2} />Classifica
            </button>
          )}
          {item.stato === "classificato" && (
            <button className="btn btn--primary btn--sm" onClick={() => onApplica(item.id)} disabled={busy}>
              <Icon name="checkCircle" size={13} stroke={2} />Importa
            </button>
          )}
          <button className="btn btn--subtle btn--sm" onClick={() => onScarta(item.id)} disabled={busy}
                  style={{ color: "var(--rosso)" }}>
            <Icon name="x" size={13} stroke={2} />Scarta
          </button>
          {item.stato === "classificato" && (
            <button className="btn btn--subtle btn--sm" onClick={() => onClassifica(item.id)} disabled={busy}>
              <Icon name="refresh" size={12} stroke={2} />Riclassifica
            </button>
          )}
        </div>
      )}
      {item.stato === "applicato" && item.comId && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--verde)" }}>
          <Icon name="checkCircle" size={13} stroke={2} /> Comunicazione creata · ID {item.comId}
        </div>
      )}
    </div>
  );
}

function DropZone({ onFiles, disabled }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  function handle(files) {
    if (!files?.length || disabled) return;
    onFiles([...files]);
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${drag ? "var(--blu)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "28px 20px",
        textAlign: "center",
        cursor: disabled ? "default" : "pointer",
        background: drag ? "var(--blu-bg, #e8f0fe)" : "var(--surface-2)",
        transition: "all 0.15s",
        userSelect: "none",
      }}
    >
      <input ref={inputRef} type="file" multiple accept=".pdf,.txt,.doc,.docx,.eml,.jpg,.jpeg,.png"
             style={{ display: "none" }} onChange={e => handle(e.target.files)} />
      <Icon name="upload" size={28} stroke={1.5} style={{ color: "var(--blu)", marginBottom: 8 }} />
      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>
        {disabled ? "Seleziona o crea un lotto" : "Trascina i file qui"}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        {disabled ? "per poter caricare documenti" : "oppure clicca per selezionare · PDF, TXT, DOC, EML, immagini"}
      </div>
    </div>
  );
}

const TABS = ["Tutti", "In coda", "Classificati", "Importati", "Scartati"];
const TAB_STATO = { "In coda": "in_coda", "Classificati": "classificato", "Importati": "applicato", "Scartati": "scartato" };

export default function Import({ me, nav, toast, tick }) {
  const [lotti, setLotti] = useState([]);
  const [lottoId, setLottoId] = useState(null);
  const [lotto, setLotto] = useState(null);
  const [nomeLotto, setNomeLotto] = useState("");
  const [tab, setTab] = useState("Tutti");
  const [busy, setBusy] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState(null); // {done, total}
  const [uploading, setUploading] = useState(false);

  const loadLotti = useCallback(() =>
    api.listLotti(me).then(r => setLotti(r.lotti || [])).catch(() => {}),
    [me]
  );

  const loadLotto = useCallback((id) => {
    if (!id) return;
    api.getLotto(id, me).then(setLotto).catch(() => {});
  }, [me]);

  useEffect(() => { loadLotti(); }, [tick, me]); // eslint-disable-line
  useEffect(() => { if (lottoId) loadLotto(lottoId); }, [lottoId]); // eslint-disable-line

  async function creaNuovoLotto() {
    try {
      const l = await api.creaLotto(nomeLotto || `Importazione ${new Date().toLocaleDateString("it-IT")}`, me);
      setLotti(prev => [l, ...prev]);
      setLottoId(l.id);
      setNomeLotto("");
      toast("Lotto creato", "success");
    } catch (e) {
      toast(e.message || "Errore creazione lotto", "");
    }
  }

  async function onFiles(files) {
    if (!lottoId) return;
    setUploading(true);
    try {
      const res = await api.uploadItems(lottoId, files, me);
      toast(`${res.creati} file caricati`, "success");
      loadLotto(lottoId);
    } catch (e) {
      toast(e.message || "Errore upload", "");
    } finally {
      setUploading(false);
    }
  }

  async function onClassifica(itemId) {
    setBusy(true);
    try {
      await api.classificaItem(itemId, me);
      loadLotto(lottoId);
    } catch (e) {
      toast(e.message || "Errore classificazione", "");
    } finally {
      setBusy(false);
    }
  }

  async function classificaTutto() {
    if (!lotto) return;
    const inCoda = (lotto.items || []).filter(i => i.stato === "in_coda");
    if (!inCoda.length) { toast("Nessun documento in coda", ""); return; }
    setClassifyProgress({ done: 0, total: inCoda.length });
    for (let idx = 0; idx < inCoda.length; idx++) {
      try {
        await api.classificaItem(inCoda[idx].id, me);
      } catch {}
      setClassifyProgress({ done: idx + 1, total: inCoda.length });
    }
    setClassifyProgress(null);
    loadLotto(lottoId);
    toast("Classificazione completata", "success");
  }

  async function applicaTutti() {
    if (!lotto) return;
    const classificati = (lotto.items || []).filter(i => i.stato === "classificato");
    if (!classificati.length) { toast("Nessun documento classificato da importare", ""); return; }
    setBusy(true);
    let ok = 0;
    for (const item of classificati) {
      try { await api.applicaItem(item.id, {}, me); ok++; } catch {}
    }
    setBusy(false);
    loadLotto(lottoId);
    toast(`${ok} comunicazioni create`, "success");
  }

  async function onApplica(itemId) {
    setBusy(true);
    try {
      await api.applicaItem(itemId, {}, me);
      loadLotto(lottoId);
      toast("Comunicazione creata", "success");
    } catch (e) {
      toast(e.message || "Errore", "");
    } finally {
      setBusy(false);
    }
  }

  async function onScarta(itemId) {
    setBusy(true);
    try {
      await api.scartaItem(itemId, "", me);
      loadLotto(lottoId);
    } catch (e) {
      toast(e.message || "Errore", "");
    } finally {
      setBusy(false);
    }
  }

  async function chiudiLotto() {
    try {
      await api.chiudiLotto(lottoId, me);
      loadLotti();
      loadLotto(lottoId);
      toast("Lotto completato", "success");
    } catch (e) {
      toast(e.message || "Errore", "");
    }
  }

  const items = lotto?.items || [];
  const filteredItems = tab === "Tutti" ? items
    : items.filter(i => i.stato === TAB_STATO[tab]);

  const inCodaCount = items.filter(i => i.stato === "in_coda").length;
  const classificatiCount = items.filter(i => i.stato === "classificato").length;
  const applicatiCount = items.filter(i => i.stato === "applicato").length;
  const scartatiCount = items.filter(i => i.stato === "scartato").length;

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb">
            <span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Importazione massiva</span>
          </div>
          <h1>Importazione massiva documenti</h1>
          <p>Carica PEC storiche, determine, delibere e pratiche aperte. L'AI classifica automaticamente ogni documento.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>

        {/* ---- colonna sinistra: lotti ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* crea lotto */}
          <div className="card">
            <div className="card__head"><Icon name="filePlus" size={16} stroke={2} style={{ color: "var(--blu)" }} /><h3>Nuovo lotto</h3></div>
            <div className="card__body">
              <input
                placeholder="Nome lotto (opzionale)"
                value={nomeLotto}
                onChange={e => setNomeLotto(e.target.value)}
                onKeyDown={e => e.key === "Enter" && creaNuovoLotto()}
                style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, boxSizing: "border-box", marginBottom: 8 }}
              />
              <button className="btn btn--primary" style={{ width: "100%" }} onClick={creaNuovoLotto}>
                <Icon name="plus" size={15} stroke={2} />Crea lotto
              </button>
            </div>
          </div>

          {/* lista lotti */}
          {lotti.length > 0 && (
            <div className="card">
              <div className="card__head"><Icon name="archive" size={16} stroke={2} style={{ color: "var(--text-muted)" }} /><h3>Lotti esistenti</h3></div>
              <div className="card__body" style={{ padding: "4px 0", maxHeight: 280, overflowY: "auto" }}>
                {lotti.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLottoId(l.id)}
                    style={{
                      display: "flex", flexDirection: "column", width: "100%", textAlign: "left",
                      padding: "9px 14px", border: "none", borderBottom: "1px solid var(--surface-2)",
                      background: l.id === lottoId ? "var(--blu-bg, #e8f0fe)" : "transparent",
                      cursor: "pointer", gap: 2,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 13, color: l.id === lottoId ? "var(--blu)" : "var(--text)" }}>
                      {l.nome}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {l.creato} · {l.totale} file · {l.applicati} importati
                    </span>
                    {l.stato === "completato" && (
                      <span style={{ fontSize: 10, color: "var(--verde)", fontWeight: 700 }}>COMPLETATO</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---- colonna destra: upload + coda ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* upload zone */}
          <DropZone onFiles={onFiles} disabled={!lottoId || uploading} />
          {uploading && (
            <div style={{ fontSize: 13, color: "var(--blu)", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="refresh" size={14} stroke={2} />Caricamento in corso…
            </div>
          )}

          {/* progress classificazione */}
          {classifyProgress && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--blu-bg, #e8f0fe)", fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "var(--blu)", fontWeight: 600 }}>
                  Classificazione in corso… {classifyProgress.done}/{classifyProgress.total}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {Math.round((classifyProgress.done / classifyProgress.total) * 100)}%
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)", overflow: "hidden" }}>
                <div style={{
                  width: `${(classifyProgress.done / classifyProgress.total) * 100}%`,
                  height: "100%", background: "var(--blu)", borderRadius: 3, transition: "width 0.3s",
                }} />
              </div>
            </div>
          )}

          {lotto && (
            <>
              {/* intestazione lotto + azioni globali */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{lotto.nome}</span>
                  <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-muted)" }}>
                    {lotto.totale} file · {inCodaCount} in coda · {classificatiCount} classificati · {applicatiCount} importati · {scartatiCount} scartati
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {inCodaCount > 0 && !classifyProgress && (
                    <button className="btn btn--subtle btn--sm" onClick={classificaTutto} disabled={busy}>
                      <Icon name="sparkles" size={14} stroke={2} />Classifica tutto ({inCodaCount})
                    </button>
                  )}
                  {classificatiCount > 0 && (
                    <button className="btn btn--primary btn--sm" onClick={applicaTutti} disabled={busy || !!classifyProgress}>
                      <Icon name="checkCircle" size={14} stroke={2} />Importa tutti classificati ({classificatiCount})
                    </button>
                  )}
                  {lotto.stato === "in_corso" && lotto.totale > 0 && inCodaCount === 0 && classificatiCount === 0 && (
                    <button className="btn btn--subtle btn--sm" onClick={chiudiLotto}>
                      <Icon name="archive" size={14} stroke={2} />Chiudi lotto
                    </button>
                  )}
                </div>
              </div>

              {/* tabs */}
              <div style={{ display: "flex", gap: 4 }}>
                {TABS.map(t => {
                  const cnt = t === "Tutti" ? items.length
                    : t === "In coda" ? inCodaCount : t === "Classificati" ? classificatiCount
                    : t === "Importati" ? applicatiCount : scartatiCount;
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      style={{
                        padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 12.5, cursor: "pointer",
                        fontWeight: tab === t ? 700 : 400,
                        background: tab === t ? "var(--blu)" : "var(--surface-2)",
                        color: tab === t ? "#fff" : "var(--text)",
                      }}
                    >
                      {t}{cnt > 0 ? ` (${cnt})` : ""}
                    </button>
                  );
                })}
              </div>

              {/* lista items */}
              {filteredItems.length === 0 ? (
                <div className="empty card" style={{ padding: "32px 20px" }}>
                  <Icon name="inbox" size={32} />
                  <p style={{ margin: "8px 0 0" }}>
                    {items.length === 0 ? "Nessun file caricato. Trascina i documenti sulla zona di upload." : `Nessun documento in stato «${tab}».`}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredItems.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onClassifica={onClassifica}
                      onApplica={onApplica}
                      onScarta={onScarta}
                      busy={busy || !!classifyProgress}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {!lottoId && lotti.length === 0 && (
            <div className="empty card" style={{ padding: "40px 20px" }}>
              <Icon name="upload" size={36} />
              <h3>Nessun lotto di importazione</h3>
              <p>Crea un nuovo lotto e carica i documenti storici da importare nel sistema.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
