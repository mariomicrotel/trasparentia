import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { StatoPill, PrioTag, Avatar, fmtDate, relScadenza, daysUntil } from "../ui.jsx";

const SUSPEND = ["in_attesa_integrazione", "in_attesa_parere"];
const isRitardo = (p) => { const d = daysUntil(p.scadenza); return d !== null && d < 0 && !["conclusa", "archiviata", ...SUSPEND].includes(p.stato); };

export default function Scadenziario({ M, me, nav, tick }) {
  const [list, setList] = useState([]);
  const [filtro, setFiltro] = useState("aperte");
  useEffect(() => { api.listPratiche(me).then(setList).catch(() => setList([])); }, [tick, me]);

  const shown = list.filter((p) => {
    if (filtro === "aperte") return !["conclusa", "archiviata"].includes(p.stato);
    if (filtro === "ritardo") return isRitardo(p);
    if (filtro === "scadenza") { const d = daysUntil(p.scadenza); return d !== null && d >= 0 && d <= 7 && !["conclusa", "archiviata"].includes(p.stato); }
    if (filtro === "concluse") return ["conclusa", "archiviata"].includes(p.stato);
    return true;
  }).sort((a, b) => (daysUntil(a.scadenza) ?? 9999) - (daysUntil(b.scadenza) ?? 9999));

  const tabs = [["aperte", "Aperte"], ["scadenza", "In scadenza"], ["ritardo", "In ritardo"], ["concluse", "Concluse"], ["tutte", "Tutte"]];

  return (
    <div className="page">
      <div className="pagehead"><div className="pagehead__main">
        <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Scadenziario</span></div>
        <h1>Scadenziario pratiche</h1>
        <p>Pratiche collegate a stati, responsabili e scadenze. Le pratiche sospese non maturano ritardo.</p>
      </div></div>

      <div className="filterbar">
        {tabs.map(([k, lbl]) => <button key={k} className="chiptab" data-active={filtro === k} onClick={() => setFiltro(k)}>{lbl}</button>)}
      </div>

      <div className="card">
        <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {shown.length === 0 && <div className="muted" style={{ padding: 16 }}>Nessuna pratica per questo filtro.</div>}
          {shown.map((p) => {
            const sospesa = SUSPEND.includes(p.stato);
            const rel = relScadenza(p.scadenza);
            const col = sospesa ? "var(--text-faint)" : (isRitardo(p) ? "var(--rosso)" : rel.tone === "ambra" ? "var(--ambra)" : "var(--verde)");
            return (
              <div key={p.id} role="button" tabIndex={0} onClick={() => nav("pratica", { id: p.id })}
                   onKeyDown={(e) => e.key === "Enter" && nav("pratica", { id: p.id })}
                   style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 8px", borderBottom: "1px solid var(--surface-2)", cursor: "pointer" }}>
                <span style={{ width: 6, height: 44, borderRadius: 3, background: col, flex: "0 0 auto" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--blu-900)" }}><span className="mono">{p.id}</span> · {p.oggetto}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                    <StatoPill stato={p.stato} /><PrioTag prio={p.priorita} />
                    {p.responsabile && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)" }}><Avatar user={p.responsabile} size={20} />{M.users[p.responsabile]?.nome}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtDate(p.scadenza)}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: col }}>{sospesa ? "sospesa" : rel.txt}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
