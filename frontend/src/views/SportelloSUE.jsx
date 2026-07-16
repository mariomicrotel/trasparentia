import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { fmtDate } from "../ui.jsx";

// Sportello Unico Edilizia (SUE) — vista di BACK-OFFICE per lo staff dell'ente.
// Il Front-office (presentazione istanze da parte di cittadini/tecnici) è una
// pagina pubblica SEPARATA, senza login: vedi PortaleSUEPubblico.jsx, raggiungibile
// su /sportello-sue. Qui l'operatore vede solo le istanze già presentate.

// ── Back-office: elenco istanze ─────────────────────────────────────────────
function Istanze({ me, nav, tick }) {
  const [ist, setIst] = useState(null);
  useEffect(() => { api.sueIstanze(me).then(r => setIst(r.istanze)).catch(() => setIst([])); }, [me, tick]);

  if (ist === null) return <div className="muted" style={{ padding: 16 }}>Caricamento…</div>;
  if (!ist.length) return <div className="card"><div className="card__body"><div className="muted">Nessuna istanza SUE presentata. Usa la scheda «Presenta istanza».</div></div></div>;

  return (
    <div className="card"><div className="card__body">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ist.map(i => {
          const allegati = (i.allegati || []).filter(a => a && a.nome);
          return (
          <div key={i.cui} style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Icon name="building" size={20} stroke={1.9} style={{ color: "var(--blu)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{i.procedimento}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  CUI <span className="mono">{i.cui}</span> · {i.regime} · {i.subContext} · presentata {fmtDate(i.creato)}
                </div>
                {(() => {
                  const presentatore = [i.presentatoreNome, i.presentatoreCognome].filter(Boolean).join(" ");
                  const titolare = [i.deleganteNome, i.deleganteCognome].filter(Boolean).join(" ");
                  if (i.ruoloPresentatore === "tecnico_delegato") {
                    return (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        <Icon name="signature" size={11} stroke={2} style={{ verticalAlign: "middle", marginRight: 3 }} />
                        Titolare <b>{titolare || "—"}</b> · presentata dal tecnico <b>{presentatore || "—"}</b>
                      </div>
                    );
                  }
                  return presentatore ? (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      <Icon name="user" size={11} stroke={2} style={{ verticalAlign: "middle", marginRight: 3 }} />
                      {presentatore} <span style={{ opacity: .7 }}>(in proprio)</span>
                    </div>
                  ) : null;
                })()}
              </div>
              {i.praticaId && (
                <button className="btn btn--subtle btn--sm" onClick={() => nav("pratica", { id: i.praticaId })}>
                  <Icon name="folder" size={13} stroke={2} />Pratica {i.praticaId}
                </button>
              )}
            </div>
            {allegati.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
                  Documenti allegati ({allegati.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {allegati.map((a, k) => a.documentoId ? (
                    <a key={k} href={api.docFileUrl(a.documentoId)} target="_blank" rel="noopener noreferrer"
                       className="btn btn--subtle btn--sm" title={`${a.label || a.tipoDoc} — ${a.nome}`}>
                      <Icon name="fileText" size={13} stroke={2} />{a.label || a.nome}
                    </a>
                  ) : (
                    <span key={k} className="btn btn--subtle btn--sm" style={{ opacity: .6, cursor: "default" }} title={a.nome}>
                      <Icon name="fileText" size={13} stroke={2} />{a.label || a.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div></div>
  );
}

export default function SportelloSUE({ me, nav, tick }) {
  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Sportello SUE</span></div>
          <h1>Sportello Unico per l'Edilizia — Back-office</h1>
          <p>Istruttoria delle istanze edilizie presentate online (SCIA, CILA, permesso di costruire…). Prototipo del flusso SUE (PNRR 2.2.3) integrato con Pratiche, atti e assistente normativo.</p>
        </div>
        <div className="pagehead__actions">
          <a href="/sportello-sue" target="_blank" rel="noopener noreferrer" className="btn btn--subtle">
            <Icon name="link" size={15} stroke={2} />Apri il portale pubblico ↗
          </a>
        </div>
      </div>

      <div className="banner banner--info" style={{ marginBottom: 16, fontSize: 13 }}>
        <Icon name="info" size={16} stroke={2} />
        <span>La presentazione delle istanze avviene sul <b>portale pubblico</b> (senza login, identità SPID/CIE nel sistema reale). Qui trovi solo le istanze già presentate, per l'istruttoria.</span>
      </div>

      <Istanze me={me} nav={nav} tick={tick} />
    </div>
  );
}
