import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Avatar, Badge, fmtDateTime } from "../ui.jsx";

const PERMESSI = [
  ["classifica", "Classifica"], ["prendiCarico", "Presa in carico"], ["assegna", "Assegna"],
  ["lavora", "Lavora"], ["bozze", "Bozze"], ["supervisione", "Supervisione"],
];

export default function Sicurezza({ M, tick }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.log().then(setData).catch(() => setData(false)); }, [tick]);
  if (!data) return <div className="page"><p>Caricamento…</p></div>;
  if (data === false) return <div className="page"><div className="empty card"><Icon name="shield" size={40} /><h3>Log non disponibile</h3></div></div>;

  const ruoli = ["rossi", "esposito", "deluca", "bianchi"];

  return (
    <div className="page">
      <div className="pagehead"><div className="pagehead__main">
        <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Sicurezza & log</span></div>
        <h1>Sicurezza & tracciabilità</h1>
        <p>Ruoli e permessi (RBAC), registro immutabile delle operazioni e report accessi. {data.totale} eventi tracciati.</p>
      </div></div>

      <div className="split">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card__head"><Icon name="shield" size={18} stroke={2} style={{ color: "var(--verde)" }} /><h3>Matrice ruoli e permessi</h3></div>
            <div className="card__body" style={{ overflowX: "auto" }}>
              <table className="rbac" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>
                  <th style={{ textAlign: "left", padding: 8 }}>Ruolo</th>
                  {PERMESSI.map(([k, l]) => <th key={k} style={{ padding: 8, fontSize: 12 }}>{l}</th>)}
                </tr></thead>
                <tbody>
                  {ruoli.map((r) => (
                    <tr key={r} style={{ borderTop: "1px solid var(--surface-2)" }}>
                      <td style={{ padding: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar user={r} size={24} /><span style={{ fontWeight: 600 }}>{M.users[r].nome}</span></div>
                      </td>
                      {PERMESSI.map(([k]) => (
                        <td key={k} style={{ padding: 8, textAlign: "center" }}>
                          {data.perm[r] && data.perm[r][k]
                            ? <Icon name="check" size={16} stroke={2.5} style={{ color: "var(--verde)" }} />
                            : <span style={{ color: "var(--text-faint)" }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card__head"><Icon name="history" size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Registro operazioni</h3><span className="sub">· ultime {data.eventi.length}</span></div>
            <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 460, overflowY: "auto" }}>
              {data.eventi.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 4px", borderBottom: "1px solid var(--surface-2)" }}>
                  {e.attoreId === "ai" ? <Badge tone="ai" icon="sparkles">AI</Badge> : <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blu-900)", minWidth: 96 }}>{M.users[e.attoreId]?.nome || e.attoreId}</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{e.azione}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}><span className="mono">{e.ref}</span> · {e.refTipo}{e.aiBadge ? ` · conf. ${e.aiBadge}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{fmtDateTime(e.ts)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sidecol">
          <div className="card">
            <div className="card__head"><Icon name="user" size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Report accessi / attività</h3></div>
            <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(data.perAttore).sort((a, b) => b[1] - a[1]).map(([uid, n]) => (
                <div key={uid} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {uid === "ai" ? <Badge tone="ai" icon="sparkles">AI</Badge> : <Avatar user={uid} size={26} />}
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{M.users[uid]?.nome || uid}</span>
                  <span style={{ fontWeight: 700, color: "var(--blu)" }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card"><div className="card__body">
            <div className="banner banner--verde" style={{ fontSize: 12.5 }}>
              <Icon name="lock" size={16} /><div>Piattaforma <b>on-prem</b>: i dati non escono dal Comune. Ogni operazione è registrata con attore, azione e data.</div>
            </div>
          </div></div>
        </div>
      </div>
    </div>
  );
}
