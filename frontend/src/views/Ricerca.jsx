import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Badge } from "../ui.jsx";

const TIPO = {
  comunicazione: { ico: "mail", lbl: "Comunicazione", view: "comunicazione" },
  pratica: { ico: "folder", lbl: "Pratica", view: "pratica" },
  atto: { ico: "fileText", lbl: "Atto", view: "atto" },
  documento: { ico: "fileText", lbl: "Documento", view: null },
};
const MODE_LBL = {
  semantic: ["Ricerca semantica", "ai"],
  lexical: ["Ricerca testuale", "blu"],
  semantic_unavailable: ["Semantica non disponibile", "ambra"],
  none: ["—", "gray"],
};

export default function Ricerca({ q, M, me, nav, toast }) {
  const perm = M.perm[me] || {};
  const [res, setRes] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  function run() {
    if (!q) { setRes({ mode: "none", risultati: [] }); return; }
    api.cerca(q).then(setRes).catch(() => setRes({ mode: "none", risultati: [] }));
    api.cercaStatus().then(setStatus).catch(() => {});
  }
  useEffect(() => { run(); }, [q]);

  async function attivaSemantica() {
    setBusy(true);
    try {
      const r = await api.reindex(me);
      toast(`Indice aggiornato: ${r.embedding_generati} embedding generati`, r.embedding_generati ? "ai" : "");
      run();
    } catch (e) { toast(e.message, ""); } finally { setBusy(false); }
  }

  function apri(r) {
    const t = TIPO[r.refTipo];
    if (!t) return;
    if (t.view) nav(t.view, { id: r.refId });
    else window.open(api.docFileUrl(r.refId), "_blank");
  }

  const [mlbl, mtone] = MODE_LBL[res?.mode] || MODE_LBL.none;

  return (
    <div className="page">
      <div className="pagehead"><div className="pagehead__main">
        <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Ricerca</span></div>
        <h1>Risultati per «{q}»</h1>
        <p style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {res && <Badge tone={mtone} icon={res.mode === "semantic" ? "sparkles" : "search"}>{mlbl}</Badge>}
          {res && <span>{res.risultati.length} risultati</span>}
        </p>
      </div></div>

      {res && (res.mode === "lexical" || res.mode === "semantic_unavailable") && status && !status.semanticaPronta && (
        <div className="banner banner--ambra" style={{ marginBottom: 16 }}>
          <Icon name="sparkles" size={20} />
          <div>La <b>ricerca semantica</b> non è ancora attiva (nessun embedding). Richiede il server AI ({status.embedModel}) raggiungibile.{status.aiOnline ? "" : " Server AI non raggiungibile."}</div>
          {perm.classifica && status.aiOnline && (
            <div className="banner__actions"><button className="btn btn--ai btn--sm" disabled={busy} onClick={attivaSemantica}><Icon name="sparkles" size={15} stroke={2} />{busy ? "Indicizzo…" : "Genera indice semantico"}</button></div>
          )}
        </div>
      )}

      <div className="card"><div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {res && res.risultati.length === 0 && <div className="muted" style={{ padding: 16 }}>Nessun risultato.</div>}
        {res && res.risultati.map((r, i) => {
          const t = TIPO[r.refTipo] || { ico: "fileText", lbl: r.refTipo };
          return (
            <div key={i} role="button" tabIndex={0} onClick={() => apri(r)} onKeyDown={(e) => e.key === "Enter" && apri(r)}
                 style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 8px", borderBottom: "1px solid var(--surface-2)", cursor: "pointer" }}>
              <span className="att__ico" style={{ marginTop: 2 }}><Icon name={t.ico} size={18} stroke={2} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "var(--blu-900)" }}>{r.titolo}</div>
                {r.snippet && <div style={{ fontSize: 12.8, color: "var(--text-muted)", marginTop: 2 }}>{r.snippet}</div>}
                <div style={{ marginTop: 4 }}><Badge tone="gray">{t.lbl}</Badge> <span className="mono" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{r.refId}</span></div>
              </div>
              <Icon name="chevronRight" size={16} style={{ color: "var(--text-faint)", marginTop: 4 }} />
            </div>
          );
        })}
      </div></div>
    </div>
  );
}
