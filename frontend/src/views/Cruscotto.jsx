import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { colFor } from "../ui.jsx";

const SUSPEND = ["in_attesa_integrazione", "in_attesa_parere"];

function kpi(label, val, color) {
  return (
    <div className="card" style={{ flex: "1 1 0", minWidth: 150 }}>
      <div className="card__body">
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{label}</div>
        <div style={{ fontSize: 34, fontWeight: 700, color }}>{val}</div>
      </div>
    </div>
  );
}

function tono(p) {
  if (SUSPEND.includes(p.stato)) return { txt: "termini sospesi", col: "var(--text-faint)" };
  if (p.ritardo) return { txt: `in ritardo di ${Math.abs(p.giorni)} gg`, col: colFor("rosso") };
  if (p.giorni === null) return { txt: "—", col: "var(--text-faint)" };
  if (p.giorni <= 7) return { txt: p.giorni === 0 ? "scade oggi" : `tra ${p.giorni} giorni`, col: colFor("ambra") };
  return { txt: `tra ${p.giorni} giorni`, col: colFor("verde") };
}

function StatNum({ label, val, sub, color }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 16px" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || "var(--blu-900)" }}>{val ?? "—"}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

const BANNER_KEY = "trasparentia_ai_banner_dismissed";

export default function Cruscotto({ M, me, nav, tick }) {
  const [c, setC] = useState(null);
  const [report, setReport] = useState(null);
  const [reportTipo, setReportTipo] = useState("settimanale");
  const [reportBusy, setReportBusy] = useState(false);
  const [aiOk, setAiOk] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(() => !!localStorage.getItem(BANNER_KEY));

  useEffect(() => {
    api.cruscotto().then(setC).catch(() => setC(false));
  }, [tick]);

  useEffect(() => {
    api.aiStatus().then(r => setAiOk(r?.ok === true)).catch(() => setAiOk(false));
  }, [tick]);

  function dismissBanner() {
    localStorage.setItem(BANNER_KEY, "1");
    setBannerDismissed(true);
  }

  useEffect(() => {
    if (!me) return;
    setReportBusy(true);
    api.getReport(reportTipo, me)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setReportBusy(false));
  }, [reportTipo, me, tick]);

  if (!c) return <div className="page"><p>Caricamento…</p></div>;

  const haAlert = c.inRitardo > 0 || c.critici > 0;

  return (
    <div className="page">
      <div className="pagehead"><div className="pagehead__main">
        <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Cruscotto</span></div>
        <h1>Cruscotto operativo</h1>
        <p>Stato dell'ente in tempo reale, calcolato dagli stessi dati operativi.</p>
      </div></div>

      {/* banner configurazione AI */}
      {!bannerDismissed && aiOk === false && (
        <div style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: "12px 16px", borderRadius: 8, marginBottom: 14,
          background: "#fffbea", border: "1.5px solid var(--arancio, #e67e22)", color: "var(--text)",
        }}>
          <Icon name="sparkles" size={18} stroke={2} style={{ color: "var(--arancio, #e67e22)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 13.5 }}>Server AI non raggiungibile</strong>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              La classificazione automatica, la ricerca semantica e la generazione di bozze non sono disponibili. Configura il server AI per abilitare tutte le funzionalità.
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button className="btn btn--subtle btn--sm" onClick={() => nav("config")}
                    style={{ borderColor: "var(--arancio, #e67e22)", color: "var(--arancio, #e67e22)" }}>
              <Icon name="settings" size={13} stroke={2} />Configura
            </button>
            <button className="btn btn--subtle btn--sm" onClick={dismissBanner} title="Chiudi">
              <Icon name="x" size={13} stroke={2} />
            </button>
          </div>
        </div>
      )}

      {/* banner alert scadenze */}
      {haAlert && (
        <div style={{
          display: "flex", gap: 10, alignItems: "center",
          padding: "12px 16px", borderRadius: 8, marginBottom: 14,
          background: "var(--rosso-bg, #fff0f1)",
          border: "1.5px solid var(--rosso, #d9364f)",
          color: "var(--rosso, #d9364f)",
        }}>
          <Icon name="alertTriangle" size={18} stroke={2} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13.5 }}>
            {c.inRitardo > 0 && (
              <strong>{c.inRitardo} pratica/e in ritardo. </strong>
            )}
            {c.critici > 0 && (
              <span>{c.critici} pratica/e scade/scadono entro 3 giorni.</span>
            )}
            {" "}Verifica lo scadenziario e le notifiche.
          </span>
          <button className="btn btn--subtle btn--sm" onClick={() => nav("scadenziario")}
                  style={{ flexShrink: 0, borderColor: "var(--rosso)", color: "var(--rosso)" }}>
            Scadenziario
          </button>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        {kpi("Comunicazioni da lavorare", c.daLavorare, "var(--blu)")}
        {kpi("Pratiche aperte", c.praticheAperte, "var(--blu-900)")}
        {kpi("In scadenza (≤7 gg)", c.inScadenza, colFor("ambra"))}
        {kpi("Pratiche in ritardo", c.inRitardo, colFor("rosso"))}
        {kpi("Atti da firmare", c.daFirmare, colFor("viola"))}
      </div>

      <div className="split">
        <div className="card">
          <div className="card__head"><Icon name="calendar" size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Pratiche da presidiare</h3></div>
          <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {c.pratiche.length === 0 && <div className="muted">Nessuna pratica aperta.</div>}
            {c.pratiche.map((p) => {
              const t = tono(p);
              return (
                <div key={p.id} className="rowlink" role="button" tabIndex={0} onClick={() => nav("pratica", { id: p.id })}
                     onKeyDown={(e) => e.key === "Enter" && nav("pratica", { id: p.id })}
                     style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 8px", borderBottom: "1px solid var(--surface-2)", cursor: "pointer" }}>
                  <span style={{ width: 6, height: 40, borderRadius: 3, background: t.col, flex: "0 0 auto" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "var(--blu-900)", fontSize: 13.5 }}><span className="mono">{p.id}</span> · {p.oggetto}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{M.users[p.responsabile]?.nome || "—"} · {M.stati[p.stato]?.lbl ?? p.stato}</div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: t.col, whiteSpace: "nowrap" }}>{t.txt}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sidecol">
          <div className="card">
            <div className="card__head"><h3>Pratiche per ufficio</h3></div>
            <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.keys(c.perUfficio).length === 0 && <div className="muted">—</div>}
              {Object.entries(c.perUfficio).map(([uff, n]) => (
                <div key={uff}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{uff}</span><b>{n}</b></div>
                  <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)", marginTop: 4 }}>
                    <div style={{ height: 8, borderRadius: 4, background: "var(--blu)", width: `${Math.min(100, n * 14)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card__head"><Icon name="signature" size={18} stroke={2} style={{ color: "var(--viola)" }} /><h3>Atti pronti per la firma</h3></div>
            <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {c.attiDaFirmare.length === 0 && <div className="muted">Nessun atto in attesa di firma.</div>}
              {c.attiDaFirmare.map((a) => (
                <div key={a.id} className="att">
                  <span className="att__ico" style={{ background: "var(--viola-bg)", color: "var(--viola)" }}><Icon name="fileText" size={17} stroke={2} /></span>
                  <div><div className="att__name">{a.oggetto}</div><div className="att__meta">{a.generatoAI ? "✦ bozza AI · " : ""}{M.atti_tipi[a.tipo]?.lbl || a.tipo}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* sezione report periodico */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head" style={{ display: "flex", alignItems: "center" }}>
          <Icon name="list" size={18} stroke={2} style={{ color: "var(--blu)" }} />
          <h3 style={{ flex: 1 }}>Report periodico</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {["settimanale", "mensile"].map((t) => (
              <button key={t} className="chiptab" data-active={reportTipo === t}
                      onClick={() => setReportTipo(t)}
                      style={{ fontSize: 12.5, padding: "3px 12px" }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="card__body">
          {reportBusy && <div className="muted" style={{ padding: "12px 0" }}>Calcolo in corso…</div>}
          {!reportBusy && !report && <div className="muted" style={{ padding: "12px 0" }}>Nessun dato disponibile.</div>}
          {!reportBusy && report && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 14 }}>
                Periodo: {report.periodo.da} → {report.periodo.a} · Generato il {report.generato}
              </div>
              <div style={{ display: "flex", gap: 0, flexWrap: "wrap", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                <StatNum label="Pratiche aperte" val={report.praticheAperte} />
                <StatNum label="Aperte nel periodo" val={report.apertePeriodo} color="var(--blu)" />
                <StatNum label="Concluse nel periodo" val={report.conclusePeriodo} color={colFor("verde")} />
                <StatNum label="In ritardo" val={report.inRitardo} color={report.inRitardo > 0 ? colFor("rosso") : "var(--text-muted)"} />
                <StatNum
                  label="Tempo medio conclusione"
                  val={report.tempoMedioGiorni !== null ? `${report.tempoMedioGiorni} gg` : "—"}
                  color="var(--blu-900)"
                />
              </div>
              {Object.keys(report.perUfficio).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>PRATICHE APERTE PER UFFICIO</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(report.perUfficio).map(([uff, d]) => (
                      <div key={uff}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span>{uff}</span>
                          <span>
                            <b>{d.aperte}</b> aperte
                            {d.inRitardo > 0 && <span style={{ marginLeft: 8, color: colFor("rosso"), fontWeight: 700 }}>{d.inRitardo} in ritardo</span>}
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)", marginTop: 4 }}>
                          <div style={{ height: 6, borderRadius: 3, background: "var(--blu)", width: `${Math.min(100, d.aperte * 14)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
