import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Badge, fmtDate } from "../ui.jsx";

function AttoStato({ stato, M }) {
  const s = M.atti_stati[stato]; if (!s) return null;
  return <Badge tone={s.col} icon={s.ico}>{s.lbl}</Badge>;
}

export default function Atti({ M, me, nav, tick }) {
  const [list, setList] = useState([]);
  const [filtro, setFiltro] = useState("tutti");
  useEffect(() => { api.listAtti(me).then(setList).catch(() => setList([])); }, [tick, me]);

  const shown = list.filter((a) => {
    if (filtro === "tutti") return true;
    if (filtro === "da_firmare") return a.stato === "pronta_firma";
    if (filtro === "lavorazione") return ["bozza", "in_revisione"].includes(a.stato);
    if (filtro === "chiusi") return ["firmato", "protocollato", "pubblicato", "archiviato"].includes(a.stato);
    return true;
  }).sort((a, b) => (b.aggiornato || "").localeCompare(a.aggiornato || ""));

  const tabs = [["tutti", "Tutti"], ["da_firmare", "Da firmare"], ["lavorazione", "In lavorazione"], ["chiusi", "Conclusi"]];

  return (
    <div className="page">
      <div className="pagehead"><div className="pagehead__main">
        <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Atti & bozze</span></div>
        <h1>Atti & bozze</h1>
        <p>Registro di determine, ordinanze, comunicazioni e note. Le bozze generate dall'AI sono marcate e restano sempre da verificare e firmare.</p>
      </div></div>

      <div className="filterbar">
        {tabs.map(([k, lbl]) => <button key={k} className="chiptab" data-active={filtro === k} onClick={() => setFiltro(k)}>{lbl}</button>)}
      </div>

      <div className="card"><div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {shown.length === 0 && <div className="muted" style={{ padding: 16 }}>Nessun atto per questo filtro.</div>}
        {shown.map((a) => {
          const t = M.atti_tipi[a.tipo] || { lbl: a.tipo, ico: "fileText", col: "blu" };
          return (
            <div key={a.id} role="button" tabIndex={0} onClick={() => nav("atto", { id: a.id })}
                 onKeyDown={(e) => e.key === "Enter" && nav("atto", { id: a.id })}
                 style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 8px", borderBottom: "1px solid var(--surface-2)", cursor: "pointer" }}>
              <span className="att__ico" style={{ background: a.generatoAI ? "var(--ai-bg)" : "var(--blu-050)", color: a.generatoAI ? "var(--ai)" : "var(--blu)" }}>
                <Icon name={a.generatoAI ? "sparkles" : t.ico} size={18} stroke={2} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "var(--blu-900)" }}>{a.oggetto}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-muted)" }}>
                  <span>{t.lbl}</span>
                  {a.numero && <span className="mono">{a.numero}</span>}
                  {a.generatoAI && <Badge tone="ai" icon="sparkles">AI</Badge>}
                </div>
              </div>
              <AttoStato stato={a.stato} M={M} />
            </div>
          );
        })}
      </div></div>
    </div>
  );
}
