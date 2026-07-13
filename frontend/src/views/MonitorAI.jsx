import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";

// Monitor in tempo reale dello sforzo inferenziale del server AI (Ollama):
// VRAM occupata (live da /api/ps) + throughput/latenza delle ultime inferenze.
// Poll ogni 2s; la serie VRAM è costruita lato client dai poll successivi.

const POLL_MS = 2000;
const MAX_PUNTI = 60;   // ~2 minuti di storia VRAM

function Stat({ label, value, unit, tone }) {
  return (
    <div style={{ flex: 1, minWidth: 130, padding: "12px 14px", borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--surface)" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: tone || "var(--text)", lineHeight: 1.1 }}>
        {value}<span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// Area chart SVG per una serie di valori 0..max.
function AreaChart({ punti, max, unit, color = "var(--blu, #0066cc)", altezza = 150 }) {
  const W = 600, H = altezza, pad = 6;
  const n = punti.length;
  if (n === 0) return <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>In attesa di dati…</div>;
  const x = (i) => pad + (i / Math.max(1, MAX_PUNTI - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - (Math.min(v, max) / max) * (H - 2 * pad);
  const linea = punti.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${linea} L${x(n - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  const ultimo = punti[n - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H }}>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad} x2={W - pad} y1={H - pad - f * (H - 2 * pad)} y2={H - pad - f * (H - 2 * pad)}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      <path d={area} fill={color} opacity="0.14" />
      <path d={linea} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {n > 0 && <circle cx={x(n - 1)} cy={y(ultimo)} r="3.5" fill={color} />}
    </svg>
  );
}

// Barre del throughput (token/s) per ciascuna inferenza recente.
function BarsChart({ campioni, altezza = 150 }) {
  const W = 600, H = altezza, pad = 6;
  if (!campioni.length) return <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>Nessuna inferenza registrata ancora. Usa l'AI (classificazione, bozze, assistente) per popolare il grafico.</div>;
  const vals = campioni.map((c) => c.tokens_s || 0);
  const max = Math.max(20, ...vals);
  const bw = (W - 2 * pad) / Math.max(1, campioni.length) * 0.8;
  const gap = (W - 2 * pad) / Math.max(1, campioni.length) * 0.2;
  const colore = { classifica: "#6a4ec2", generazione: "#0066cc", assistente: "#0b7d99" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H }}>
      {campioni.map((c, i) => {
        const h = (Math.min(c.tokens_s || 0, max) / max) * (H - 2 * pad);
        const xx = pad + i * (bw + gap);
        return <rect key={i} x={xx} y={H - pad - h} width={bw} height={Math.max(1, h)} rx="2"
                     fill={colore[c.kind] || "#0066cc"}>
          <title>{`${c.kind} · ${c.tokens_s} tok/s · ${c.total_ms ?? "?"} ms`}</title>
        </rect>;
      })}
    </svg>
  );
}

export default function MonitorAI({ M, me }) {
  const [d, setD] = useState(null);
  const [errore, setErrore] = useState("");
  const vramSerie = useRef([]);       // % VRAM per ogni poll
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let vivo = true;
    async function poll() {
      try {
        const r = await api.aiMetriche(me);
        if (!vivo) return;
        const pct = r.vram_totale_gb ? Math.round((r.vram_gb / r.vram_totale_gb) * 100) : 0;
        vramSerie.current = [...vramSerie.current, pct].slice(-MAX_PUNTI);
        setD(r); setErrore("");
      } catch (e) {
        if (vivo) setErrore(e.message || "Errore");
      }
      if (vivo) setTick((t) => t + 1);
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { vivo = false; clearInterval(id); };
  }, [me]);

  const campioni = d?.campioni || [];
  const ultima = campioni[campioni.length - 1];
  const oraS = Date.now() / 1000;
  const ultimoMinuto = campioni.filter((c) => oraS - c.ts < 60).length;
  const online = d?.online;

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Monitor AI</span></div>
          <h1>Monitor sforzo inferenziale</h1>
          <p>Carico del server AI on-prem in tempo reale: VRAM occupata, throughput (token/s) e latenza delle inferenze. Aggiornamento ogni {POLL_MS / 1000}s.</p>
        </div>
        <div className="pagehead__actions">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
                         color: online ? "var(--verde)" : "var(--rosso)" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: online ? "var(--verde)" : "var(--rosso)",
                           boxShadow: online ? "0 0 0 3px rgba(26,122,69,.18)" : "none" }} />
            {online ? "Server attivo" : "Server non raggiungibile"}
          </span>
        </div>
      </div>

      {errore && !d && (
        <div className="banner banner--ambra" style={{ marginBottom: 16, fontSize: 13 }}>
          <Icon name="alertCircle" size={16} stroke={2} /><span>{errore}</span>
        </div>
      )}

      {/* Stat tiles */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Stat label="VRAM occupata" value={d ? d.vram_gb : "—"} unit={`/ ${d?.vram_totale_gb ?? "?"} GB`}
              tone={d && d.vram_gb / (d.vram_totale_gb || 8) > 0.9 ? "var(--rosso)" : "var(--blu)"} />
        <Stat label="Modelli in VRAM" value={d ? (d.modelli?.length ?? 0) : "—"} unit="" />
        <Stat label="Token/s ultima" value={ultima ? ultima.tokens_s : "—"} unit={ultima ? "tok/s" : ""} tone="var(--verde)" />
        <Stat label="Latenza ultima" value={ultima?.total_ms ? (ultima.total_ms / 1000).toFixed(1) : "—"} unit={ultima?.total_ms ? "s" : ""} />
        <Stat label="Inferenze (60s)" value={ultimoMinuto} unit="" />
      </div>

      {/* VRAM nel tempo */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <Icon name="cpu" size={18} stroke={2} style={{ color: "var(--blu)" }} />
          <h3 style={{ flex: 1 }}>VRAM occupata nel tempo</h3>
          <span className="sub">{d ? `${vramSerie.current[vramSerie.current.length - 1] ?? 0}%` : ""}</span>
        </div>
        <div className="card__body">
          <AreaChart punti={vramSerie.current} max={100} unit="%" />
        </div>
      </div>

      {/* Throughput inferenze */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <Icon name="activity" size={18} stroke={2} style={{ color: "var(--blu)" }} />
          <h3 style={{ flex: 1 }}>Throughput inferenze (token/s)</h3>
          <span className="sub">ultime {campioni.length}</span>
        </div>
        <div className="card__body">
          <BarsChart campioni={campioni} />
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#6a4ec2", marginRight: 5 }} />classificazione</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#0066cc", marginRight: 5 }} />generazione atti</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#0b7d99", marginRight: 5 }} />assistente</span>
          </div>
        </div>
      </div>

      {/* Modelli caricati */}
      <div className="card">
        <div className="card__head"><Icon name="sparkles" size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Modelli residenti in VRAM</h3></div>
        <div className="card__body">
          {(d?.modelli || []).length === 0 && <div className="muted" style={{ fontSize: 13 }}>Nessun modello attualmente caricato in VRAM (verrà caricato alla prossima richiesta).</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(d?.modelli || []).map((m) => (
              <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <Icon name="cpu" size={18} stroke={2} style={{ color: "var(--blu)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, fontFamily: "monospace" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {(m.vram_bytes / 1e9).toFixed(2)} GB{m.context_length ? ` · contesto ${m.context_length}` : ""}
                  </div>
                </div>
                <div style={{ width: 120, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden", flexShrink: 0 }}>
                  <div style={{ width: `${Math.min(100, (m.vram_bytes / 1e9 / (d.vram_totale_gb || 8)) * 100)}%`, height: "100%", background: "var(--blu)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
