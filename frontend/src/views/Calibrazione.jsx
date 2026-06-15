import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";

// Soglia da cui consideriamo "bassa confidenza" l'output AI (riferimento visivo).
function confColor(c) {
  if (c >= 0.8) return "var(--verde)";
  if (c >= 0.6) return "var(--ambra, #a66300)";
  return "var(--rosso)";
}

export default function Calibrazione({ M, me, toast, tick, nav }) {
  const canAdmin = !!(M.perm?.[me]?.supervisione);

  const [campione, setCampione]   = useState(null);
  const [meta, setMeta]           = useState({ totale_disponibile: 0, soglia_corrente: null });
  const [ordine, setOrdine]       = useState("confidenza_asc");
  const [n, setN]                 = useState(20);
  const [etichette, setEtichette] = useState({}); // id → categoria_corretta
  const [busy, setBusy]           = useState(false);
  const [esito, setEsito]         = useState(null);

  const CAT = M.cat || {};

  const load = useCallback(() => {
    if (!canAdmin) return;
    setCampione(null);
    setEsito(null);
    api.goldenSetCampione(n, ordine, me).then((r) => {
      setCampione(r.campione || []);
      setMeta({ totale_disponibile: r.totale_disponibile, soglia_corrente: r.soglia_corrente });
      // pre-compila l'etichetta con la categoria proposta dall'AI
      const init = {};
      (r.campione || []).forEach((c) => { init[c.id] = c.ai_categoria || ""; });
      setEtichette(init);
    }).catch((e) => { setCampione([]); toast(e.message || "Errore", ""); });
  }, [n, ordine, me, canAdmin, toast]);

  useEffect(() => { load(); }, [tick, load]);

  if (!canAdmin) {
    return (
      <div className="page">
        <div className="empty card" style={{ padding: "64px 24px" }}>
          <Icon name="lock" size={40} />
          <h3>Accesso riservato</h3>
          <p>La calibrazione dell'AI è disponibile solo per il Segretario Comunale.</p>
          <button className="btn btn--subtle" onClick={() => nav("cruscotto")}>
            <Icon name="grid" size={16} stroke={2} />Torna al cruscotto
          </button>
        </div>
      </div>
    );
  }

  function setEtichetta(id, cat) {
    setEtichette((e) => ({ ...e, [id]: cat }));
  }

  async function valuta() {
    const payload = {
      campione: (campione || [])
        .map((c) => ({ id: c.id, categoria_corretta: etichette[c.id] || "" }))
        .filter((c) => c.categoria_corretta),
    };
    if (!payload.campione.length) { toast("Etichetta almeno una comunicazione", ""); return; }
    setBusy(true);
    try {
      const r = await api.goldenSetValuta(payload, me);
      setEsito(r);
      toast(`Accuratezza AI: ${r.accuratezza_pct}%`, r.accuratezza_pct >= r.target_minimo_pct ? "success" : "");
    } catch (e) { toast(e.message || "Errore", ""); }
    finally { setBusy(false); }
  }

  const lista = campione || [];
  const etichettate = Object.values(etichette).filter(Boolean).length;

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Calibrazione AI</span></div>
          <h1>Calibrazione classificazione AI</h1>
          <p>
            Valida manualmente un campione di classificazioni dell'AI per misurarne l'accuratezza
            e tarare la soglia di confidenza. {meta.totale_disponibile > 0
              ? `${meta.totale_disponibile} comunicazioni classificate disponibili.`
              : ""}
          </p>
        </div>
        <div className="pagehead__actions">
          <button className="btn btn--subtle" onClick={load} disabled={busy}>
            <Icon name="refresh" size={15} stroke={2} />Nuovo campione
          </button>
        </div>
      </div>

      {/* ── Controlli campionamento ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__body" style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Criterio di campionamento</label>
            <select value={ordine} onChange={(e) => setOrdine(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}>
              <option value="confidenza_asc">Priorità a bassa confidenza (consigliato)</option>
              <option value="recenti">Più recenti</option>
              <option value="random">Casuale</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Dimensione campione</label>
            <select value={n} onChange={(e) => setN(Number(e.target.value))}
              style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}>
              {[10, 20, 50, 100].map((v) => <option key={v} value={v}>{v} comunicazioni</option>)}
            </select>
          </div>
          {meta.soglia_corrente != null && (
            <div style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--text-muted)" }}>
              Soglia confidenza attuale: <b style={{ color: "var(--blu)" }}>{Math.round(meta.soglia_corrente * 100)}%</b>
            </div>
          )}
        </div>
      </div>

      {/* ── Esito valutazione ────────────────────────────────────────── */}
      {esito && (
        <div className="card" style={{ marginBottom: 16, border: "1.5px solid var(--blu)" }}>
          <div className="card__head">
            <Icon name="sparkles" size={18} stroke={2} style={{ color: "var(--blu)" }} />
            <h3 style={{ flex: 1, color: "var(--blu)" }}>Risultato calibrazione</h3>
          </div>
          <div className="card__body">
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Accuratezza</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: esito.accuratezza_pct >= esito.target_minimo_pct ? "var(--verde)" : "var(--rosso)" }}>
                  {esito.accuratezza_pct}%
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>target ≥ {esito.target_minimo_pct}%</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Valutati</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{esito.corretti}/{esito.totale_valutati}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>classificazioni corrette</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Soglia suggerita</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "var(--blu)" }}>{Math.round(esito.soglia_suggerita * 100)}%</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>attuale {Math.round(esito.soglia_confidenza_attuale * 100)}%</div>
              </div>
            </div>

            {esito.accuratezza_pct < esito.target_minimo_pct ? (
              <div className="banner banner--ambra" style={{ fontSize: 12.5 }}>
                <Icon name="alertCircle" size={16} />
                <span>Accuratezza sotto il target. Imposta la soglia di confidenza a <b>{Math.round(esito.soglia_suggerita * 100)}%</b> in Configurazione (<code>SOGLIA_CONFIDENZA_BASSA</code>) così le classificazioni meno sicure vengono inviate a revisione manuale.</span>
              </div>
            ) : (
              <div className="banner banner--verde" style={{ fontSize: 12.5 }}>
                <Icon name="checkCircle" size={16} />
                <span>Accuratezza adeguata. La soglia può restare a <b>{Math.round(esito.soglia_suggerita * 100)}%</b>.</span>
              </div>
            )}

            {Object.keys(esito.per_categoria || {}).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Accuratezza per categoria</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(esito.per_categoria).map(([cat, v]) => (
                    <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                      <span style={{ width: 200, fontWeight: 600 }}>{CAT[cat]?.lbl || cat}</span>
                      <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${v.accuratezza_pct}%`, height: "100%", background: v.accuratezza_pct >= 80 ? "var(--verde)" : "var(--rosso)" }} />
                      </div>
                      <span style={{ width: 90, textAlign: "right", color: "var(--text-muted)" }}>{v.accuratezza_pct}% ({v.corretti}/{v.totale})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {esito.non_trovati > 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>{esito.non_trovati} comunicazioni non trovate o senza classificazione AI (escluse dal calcolo).</p>
            )}
          </div>
        </div>
      )}

      {/* ── Campione da etichettare ──────────────────────────────────── */}
      <div className="card">
        <div className="card__head">
          <Icon name="eye" size={18} stroke={2} style={{ color: "var(--blu)" }} />
          <h3 style={{ flex: 1 }}>Campione da validare</h3>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{etichettate}/{lista.length} etichettate</span>
        </div>
        <div className="card__body">
          {campione === null && <div className="muted" style={{ padding: 16 }}>Caricamento campione…</div>}
          {campione !== null && lista.length === 0 && (
            <div className="muted" style={{ padding: 16 }}>Nessuna comunicazione classificata dall'AI disponibile. Importa e classifica comunicazioni per poter calibrare.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lista.map((c) => {
              const concorda = (etichette[c.id] || "") === c.ai_categoria;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.oggetto || "(senza oggetto)"}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {c.canale} · {c.mittente}{c.arrivo ? ` · ${c.arrivo}` : ""}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12 }}>
                        <Icon name="sparkles" size={12} stroke={2} style={{ color: "var(--blu)", verticalAlign: "-1px" }} /> AI: <b>{CAT[c.ai_categoria]?.lbl || c.ai_categoria}</b>
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: confColor(c.ai_confidenza) }}>
                        conf. {Math.round(c.ai_confidenza * 100)}%
                      </span>
                    </div>
                    {c.ai_motivazione && (
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>«{c.ai_motivazione}»</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, width: 230 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Categoria corretta</label>
                    <select value={etichette[c.id] || ""} onChange={(e) => setEtichetta(c.id, e.target.value)}
                      style={{ padding: "7px 9px", border: `1px solid ${concorda ? "var(--border)" : "var(--ambra, #a66300)"}`, borderRadius: 6, fontSize: 12.5, background: "var(--surface)", color: "var(--text)" }}>
                      <option value="">— da etichettare —</option>
                      {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v.lbl}</option>)}
                    </select>
                    <span style={{ fontSize: 11, color: concorda ? "var(--verde)" : "var(--ambra, #a66300)", fontWeight: 600 }}>
                      {etichette[c.id] ? (concorda ? "✓ concorda con l'AI" : "✗ AI da correggere") : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {lista.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
              <button className="btn btn--primary" onClick={valuta} disabled={busy || etichettate === 0}>
                <Icon name="checkCircle" size={15} stroke={2} />{busy ? "Calcolo…" : `Valuta accuratezza (${etichettate})`}
              </button>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                La categoria è pre-compilata con la proposta dell'AI: correggi solo dove l'AI ha sbagliato, poi valuta.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
