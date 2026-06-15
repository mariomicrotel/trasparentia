import React from "react";
import { Icon } from "../icons.jsx";
import { Badge, CatBadge, Avatar, bgFor, colFor } from "../ui.jsx";

function termineLbl(g) {
  if (g <= 1) return "immediato";
  return `${g} giorni`;
}

export default function Uffici({ M, nav }) {
  const uffici = M.uffici || {};
  const atti = M.atti_tipi || {};
  const lista = Object.entries(uffici);

  return (
    <div className="page page--wide">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Uffici e flussi documentali</span></div>
          <h1>Uffici e flussi documentali</h1>
          <p>
            Mappa degli uffici comunali con le categorie documentali gestite, i procedimenti tipici
            (con termine di legge e atto finale) e il responsabile. È la base su cui l'AI instrada
            le comunicazioni in ingresso. {lista.length} uffici configurati.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {lista.map(([key, u]) => {
          const resp = u.responsabileDefault && M.users[u.responsabileDefault];
          return (
            <div className="card" key={key}>
              <div className="card__head">
                <span className="kpi__ico" style={{ width: 38, height: 38, background: bgFor(u.col), color: colFor(u.col) }}>
                  <Icon name={u.ico || "building"} size={20} stroke={2} />
                </span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>{u.lbl}</h3>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{u.descrizione}</div>
                </div>
                <Badge tone={u.col} style={{ fontFamily: "monospace" }}>{u.prefix}</Badge>
              </div>

              <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Responsabile */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Responsabile</span>
                    {resp ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <Avatar user={u.responsabileDefault} size={26} />
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{resp.nome}</span>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {resp.ruolo}</span>
                      </span>
                    ) : <span className="muted" style={{ fontSize: 13 }}>da assegnare</span>}
                  </div>
                </div>

                {/* Categorie gestite */}
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
                    Categorie documentali instradate qui
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(u.categorie || []).map((c) => <CatBadge key={c} cat={c} small />)}
                  </div>
                </div>

                {/* Procedimenti */}
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
                    Procedimenti e flussi documentali
                  </div>
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "var(--surface-2)", textAlign: "left" }}>
                          <th style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text-muted)" }}>Procedimento</th>
                          <th style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text-muted)", width: 120 }}>Termine</th>
                          <th style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text-muted)", width: 180 }}>Atto finale</th>
                          <th style={{ padding: "8px 12px", fontWeight: 700, color: "var(--text-muted)", width: 200 }}>Riferimento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(u.procedimenti || []).map((p, i) => {
                          const atto = p.attoFinale && atti[p.attoFinale];
                          return (
                            <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 600 }}>{p.nome}</td>
                              <td style={{ padding: "8px 12px" }}>
                                <Badge tone={p.termineGiorni <= 2 ? "rosso" : p.termineGiorni <= 30 ? "blu" : "ambra"}>{termineLbl(p.termineGiorni)}</Badge>
                              </td>
                              <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>
                                {atto ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name={atto.ico} size={13} stroke={2} />{atto.lbl}</span> : "—"}
                              </td>
                              <td style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 12 }}>{p.norma || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="aibox__disclaimer" style={{ marginTop: 16 }}>
        <Icon name="info" size={15} stroke={2} />
        I termini indicati sono quelli ordinari di legge: il termine effettivo della singola pratica può variare (sospensioni per integrazioni o pareri). L'AI propone l'ufficio competente, ma lo smistamento definitivo resta sempre dell'operatore di protocollo.
      </div>
    </div>
  );
}
