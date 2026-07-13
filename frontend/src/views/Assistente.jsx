import React, { useState, useRef, useEffect } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";

// Assistente chat globale: FAB in basso a destra + pannello. Montato in App,
// resta disponibile su tutte le viste. Risponde su piattaforma, corpus
// normativo e dati operativi (RAG lato backend).

const SUGGERIMENTI = [
  "Come classifico una comunicazione in arrivo?",
  "Quali sono gli stati di una pratica?",
  "Cosa prevede il regolamento sull'occupazione di suolo pubblico?",
  "Come si genera la bozza di una determina?",
];

export default function Assistente({ me }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);   // {ruolo:"user"|"assistant", testo, fonti?}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  async function invia(testo) {
    const domanda = (testo ?? input).trim();
    if (!domanda || busy) return;
    const storia = msgs.map(m => ({ ruolo: m.ruolo, testo: m.testo }));
    setMsgs(m => [...m, { ruolo: "user", testo: domanda }]);
    setInput("");
    setBusy(true);
    try {
      const r = await api.assistente(domanda, storia, me);
      setMsgs(m => [...m, { ruolo: "assistant", testo: r.risposta, fonti: r.fonti || [] }]);
    } catch (e) {
      setMsgs(m => [...m, { ruolo: "assistant", testo: `⚠️ ${e.message || "Errore"}`, fonti: [] }]);
    } finally {
      setBusy(false);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); invia(); }
  }

  return (
    <>
      {/* FAB */}
      <button onClick={() => setOpen(o => !o)} title="Assistente TrasParentIA" aria-label="Assistente"
        style={{
          position: "fixed", right: 22, bottom: 22, zIndex: 900,
          width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "#0066cc", color: "#fff", boxShadow: "0 6px 20px rgba(0,102,204,.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform .15s",
        }}
        onMouseDown={e => e.currentTarget.style.transform = "scale(.94)"}
        onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <Icon name={open ? "x" : "sparkles"} size={26} stroke={2} />
      </button>

      {/* Pannello */}
      {open && (
        <div style={{
          position: "fixed", right: 22, bottom: 90, zIndex: 900,
          width: "min(420px, calc(100vw - 44px))", height: "min(600px, calc(100vh - 130px))",
          background: "var(--bg-card, #fff)", borderRadius: 14, overflow: "hidden",
          boxShadow: "0 12px 48px rgba(0,0,0,.22)", border: "1px solid var(--border, #e2e5ea)",
          display: "flex", flexDirection: "column", fontFamily: "Titillium Web, sans-serif",
        }}>
          {/* Header */}
          <div style={{ background: "#0066cc", color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="sparkles" size={19} stroke={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Assistente TrasParentIA</div>
              <div style={{ fontSize: 11.5, opacity: .85 }}>Piattaforma · regolamenti · pratiche</div>
            </div>
            {msgs.length > 0 && (
              <button onClick={() => setMsgs([])} title="Nuova conversazione"
                style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 7, padding: "5px 9px", cursor: "pointer", fontSize: 12 }}>
                Pulisci
              </button>
            )}
          </div>

          {/* Messaggi */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px", background: "var(--bg-page, #f5f6fa)" }}>
            {msgs.length === 0 && (
              <div>
                <div style={{ fontSize: 13.5, color: "var(--text-muted, #6b7280)", marginBottom: 12, lineHeight: 1.5 }}>
                  Ciao! Chiedimi come usare la piattaforma, cosa prevede un regolamento dell'ente, lo stato di una pratica e altro.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {SUGGERIMENTI.map((s, i) => (
                    <button key={i} onClick={() => invia(s)}
                      style={{ textAlign: "left", background: "var(--bg-card, #fff)", border: "1px solid var(--border, #e2e5ea)", borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontSize: 13, color: "var(--text, #1a1a2e)" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.ruolo === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                <div style={{ maxWidth: "85%" }}>
                  <div style={{
                    padding: "10px 13px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
                    background: m.ruolo === "user" ? "#0066cc" : "var(--bg-card, #fff)",
                    color: m.ruolo === "user" ? "#fff" : "var(--text, #1a1a2e)",
                    border: m.ruolo === "user" ? "none" : "1px solid var(--border, #e2e5ea)",
                    borderBottomRightRadius: m.ruolo === "user" ? 3 : 12,
                    borderBottomLeftRadius: m.ruolo === "user" ? 12 : 3,
                  }}>
                    {m.testo}
                  </div>
                  {m.fonti && m.fonti.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {m.fonti.map((f, j) => (
                        <span key={j} title={f.rif} style={{
                          fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                          background: f.tipo === "normativa" ? "var(--blu-bg, #e8f0fb)" : "var(--surface-2, #eef1f5)",
                          color: f.tipo === "normativa" ? "var(--blu, #0066cc)" : "var(--text-muted, #6b7280)",
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}>
                          <Icon name={f.tipo === "normativa" ? "gavel" : "fileText"} size={11} stroke={2} />
                          {f.titolo.length > 42 ? f.titolo.slice(0, 42) + "…" : f.titolo}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted, #6b7280)", fontSize: 13 }}>
                <Icon name="loader" size={16} stroke={2} style={{ animation: "spin 1s linear infinite" }} />
                Sto consultando piattaforma e regolamenti…
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: 12, borderTop: "1px solid var(--border, #e2e5ea)", background: "var(--bg-card, #fff)", display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey}
              placeholder="Scrivi una domanda…" rows={1}
              style={{ flex: 1, resize: "none", maxHeight: 100, padding: "9px 12px", borderRadius: 10,
                       border: "1.5px solid var(--border, #d1d5db)", fontSize: 13.5, fontFamily: "inherit",
                       background: "var(--bg-input, #fff)", color: "var(--text, #1a1a2e)", outline: "none" }} />
            <button onClick={() => invia()} disabled={busy || !input.trim()} aria-label="Invia"
              style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, border: "none",
                       background: busy || !input.trim() ? "#93c5fd" : "#0066cc", color: "#fff",
                       cursor: busy || !input.trim() ? "default" : "pointer",
                       display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="send" size={18} stroke={2} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
