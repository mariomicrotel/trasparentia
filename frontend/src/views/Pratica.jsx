import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Badge, CatBadge, StatoPill, PrioTag, Avatar, TimelineItem, DRAFT_TIPI, bgFor, colFor, fmtDate, relScadenza, daysUntil } from "../ui.jsx";

// ── Diario del procedimento ──────────────────────────────────────────────────

function buildPeriods(cronologia) {
  const sorted = [...cronologia].sort((a, b) => a.ts.localeCompare(b.ts));
  const periods = [];
  let stato = "assegnata";
  let from = sorted[0]?.ts ?? new Date().toISOString();
  for (const ev of sorted) {
    if (ev.tipo === "cambio_stato" && ev.statoNew) {
      periods.push({ stato, from, to: ev.ts });
      stato = ev.statoNew;
      from = ev.ts;
    }
  }
  periods.push({ stato, from, to: null });
  return periods;
}

function attoInPeriod(atto, period) {
  // atto.creato è "YYYY-MM-DD"; confronta con date part dei timestamp
  const d = atto.creato?.slice(0, 10) ?? "";
  const f = period.from?.slice(0, 10) ?? "";
  const t = period.to?.slice(0, 10) ?? null;
  return d >= f && (t === null || d <= t);
}

const STATO_ATTO_TONE = { bozza: "ambra", in_revisione: "ambra", pronta_firma: "blu", protocollato: "blu", firmato: "verde", pubblicato: "verde" };
const ATTO_ICO = { ordinanza: "fileText", determina: "fileText", risposta_cittadino: "mail", richiesta_integrazione: "forward", avvio_procedimento: "fileText", richiesta_parere: "forward", sollecito: "mail", nota_ente: "mail", comunicazione_ente: "mail" };

function DiarioStati({ p, M, nav }) {
  const periods = buildPeriods(p.cronologia);
  const [open, setOpen] = useState(() => new Set([periods.length - 1]));
  const toggle = (i) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const atti = p.atti ?? [];

  return (
    <div className="card">
      <div className="card__head">
        <Icon name="route" size={18} stroke={2} style={{ color: "var(--blu)" }} />
        <h3>Diario del procedimento</h3>
        <span className="sub">· {atti.length} document{atti.length !== 1 ? "i" : "o"} prodott{atti.length !== 1 ? "i" : "o"}</span>
      </div>
      <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {periods.map((period, i) => {
          const periodAtti = atti.filter((a) => attoInPeriod(a, period));
          const isOpen = open.has(i);
          const isCurrent = i === periods.length - 1;
          const statoInfo = M.stati?.[period.stato] ?? { lbl: period.stato };
          return (
            <div key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              <button
                onClick={() => toggle(i)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: isCurrent ? "var(--blu)" : "var(--surface-2)", color: isCurrent ? "#fff" : "var(--text-muted)", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {isCurrent ? <Icon name="chevronRight" size={14} stroke={2.5} /> : i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <StatoPill stato={period.stato} />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {fmtDate(period.from)}{period.to ? ` → ${fmtDate(period.to)}` : " · in corso"}
                    </span>
                  </div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {periodAtti.length > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blu)", background: "var(--blu-50, #e8f0fe)", borderRadius: 12, padding: "1px 8px" }}>
                      {periodAtti.length} doc{periodAtti.length !== 1 ? "." : "."}
                    </span>
                  )}
                  <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={15} style={{ color: "var(--text-muted)" }} />
                </span>
              </button>

              {isOpen && (
                <div style={{ paddingBottom: 14, paddingLeft: 38 }}>
                  {periodAtti.length === 0 ? (
                    <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic", padding: "4px 0 8px" }}>
                      Nessun documento prodotto in questa fase.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {periodAtti.map((a) => {
                        const tipoInfo = M.atti_tipi?.[a.tipo] ?? { lbl: a.tipo, ico: "fileText" };
                        return (
                          <button
                            key={a.id}
                            className="att"
                            style={{ textAlign: "left", background: "none", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer", width: "100%" }}
                            onClick={() => nav("atto", { id: a.id })}
                          >
                            <span className="att__ico" style={{ background: a.generatoAI ? "var(--ai-bg)" : "var(--surface-2)", color: a.generatoAI ? "var(--ai)" : "var(--text-muted)" }}>
                              <Icon name={ATTO_ICO[a.tipo] ?? "fileText"} size={16} stroke={2} />
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="att__name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {tipoInfo.lbl}
                                {a.generatoAI && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ai)", background: "var(--ai-bg)", borderRadius: 4, padding: "1px 5px" }}>AI</span>}
                              </div>
                              <div className="att__meta">{a.numero ? `${a.numero} · ` : ""}{a.oggetto?.slice(0, 70)}{a.oggetto?.length > 70 ? "…" : ""}</div>
                            </div>
                            <span style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                              <Badge tone={STATO_ATTO_TONE[a.stato] ?? ""}>{a.stato}</Badge>
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(a.creato)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SUSPEND = ["in_attesa_integrazione", "in_attesa_parere"];

function isRitardo(p) {
  const d = daysUntil(p.scadenza);
  return d !== null && d < 0 && !["conclusa", "archiviata", ...SUSPEND].includes(p.stato);
}

function transitions(stato) {
  switch (stato) {
    case "assegnata": return [{ to: "in_lavorazione", lbl: "Avvia istruttoria", variant: "primary", ico: "play" }];
    case "in_lavorazione": return [
      { to: "pronta_firma", lbl: "Pronta per la firma", variant: "primary", ico: "signature" },
      { action: "parere", lbl: "Richiedi parere", variant: "subtle", ico: "pause" },
    ];
    case "in_attesa_integrazione": return [{ to: "in_lavorazione", lbl: "Integrazione ricevuta — riprendi", variant: "primary", ico: "play", detail: "Integrazioni acquisite. Termini riavviati." }];
    case "in_attesa_parere": return [{ to: "in_lavorazione", lbl: "Parere acquisito — riprendi", variant: "primary", ico: "play", detail: "Parere acquisito. Istruttoria ripresa." }];
    case "pronta_firma": return [{ to: "conclusa", lbl: "Firma e concludi", variant: "success", ico: "check", detail: "Provvedimento firmato e trasmesso al destinatario." }];
    case "conclusa": return [{ to: "archiviata", lbl: "Archivia", variant: "subtle", ico: "archive" }];
    default: return [];
  }
}

function Stepper({ p, M }) {
  const FLOW = M.flow;
  let cur = FLOW.indexOf(p.stato);
  if (SUSPEND.includes(p.stato)) cur = FLOW.indexOf("in_lavorazione");
  if (p.stato === "archiviata") cur = FLOW.length;
  return (
    <div className="steps">
      {FLOW.map((st, i) => {
        const done = i < cur, current = i === cur;
        const cls = ["step", done && "step--done", current && "step--current", !done && !current && "step--todo"].filter(Boolean).join(" ");
        return (
          <div className={cls} key={st}>
            <div className="step__rail">
              <div className="step__dot">{done ? <Icon name="check" size={15} stroke={2.5} /> : i + 1}</div>
              {i < FLOW.length - 1 && <div className="step__line" />}
            </div>
            <div className="step__body">
              <div className="step__title">{M.stati[st].lbl}</div>
              {current && SUSPEND.includes(p.stato) && <div className="step__when" style={{ color: "var(--ambra)", fontWeight: 700 }}>{M.stati[p.stato]?.lbl ?? p.stato} — termini sospesi</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function detRow(label, val) {
  return <div><div className="fld" style={{ marginBottom: 3 }}>{label}</div><div style={{ fontWeight: 600, color: "var(--blu-900)", fontSize: 14 }}>{val}</div></div>;
}

export default function Pratica({ id, M, me, nav, toast, refresh }) {
  const perm = M.perm[me] || {};
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() { return api.getPratica(id).then(setP).catch(() => setP(false)); }
  useEffect(() => { load(); }, [id]);

  if (p === false) return <div className="page"><div className="empty card"><Icon name="folder" size={40} /><h3>Pratica non trovata</h3></div></div>;
  if (!p) return <div className="page"><p>Caricamento…</p></div>;

  const com = p.com;
  const ritardo = isRitardo(p);
  const rel = relScadenza(p.scadenza);
  const sospesa = SUSPEND.includes(p.stato);
  const missing = ((com && com.ai.documentiAttesi) || []).filter((d) => !d.ok);
  const trans = transitions(p.stato);

  async function act(fn, okMsg, tone = "success") {
    setBusy(true);
    try { await fn(); await load(); refresh(); if (okMsg) toast(okMsg, tone); }
    catch (e) { toast(e.message, ""); } finally { setBusy(false); }
  }
  const doTransition = (t) => t.action === "parere"
    ? act(() => api.bozza(p.id, { tipo: "richiesta_parere", me, usaAI: true }, me), "Richiesta parere generata (AI)", "ai")
    : act(() => api.cambioStato(p.id, { nuovo: t.to, detail: t.detail, me }, me), "Stato aggiornato: " + M.stati[t.to].lbl);
  const genBozza = (tipo) => act(() => api.bozza(p.id, { tipo, me, usaAI: true }, me),
    tipo === "riepilogo" ? "Riepilogo generato dall'AI" : "Bozza generata e registrata", tipo === "riepilogo" ? "ai" : "success");

  return (
    <div className="page page--wide">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><a onClick={() => nav("scadenziario")}>Pratiche</a><Icon name="chevronRight" size={14} /><span className="mono">{p.fascicolo}</span></div>
          <h1>{p.oggetto}</h1>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <StatoPill stato={p.stato} /><CatBadge cat={p.categoria} /><PrioTag prio={p.priorita} />
            <span className="mono" style={{ fontSize: 13, color: "var(--text-muted)" }}>Prot. {p.protocollo}</span>
          </div>
        </div>
        <div className="pagehead__actions">
          <button className="btn btn--subtle" onClick={() => nav("scadenziario")}><Icon name="arrowLeft" size={17} stroke={2} />Pratiche</button>
          <button className="btn btn--ghost" disabled={busy || !perm.bozze} onClick={() => genBozza("riepilogo")}><Icon name="sparkles" size={17} stroke={2} />Riepilogo AI</button>
        </div>
      </div>

      {ritardo && <div className="banner banner--rosso" style={{ marginBottom: 16 }}><Icon name="alertTriangle" size={20} /><div><b>Pratica in ritardo.</b> Il termine ({fmtDate(p.scadenza)}) è scaduto da {Math.abs(rel.d)} giorni. Sollecitare la lavorazione o motivare il ritardo.</div></div>}
      {sospesa && <div className="banner banner--ambra" style={{ marginBottom: 16 }}><Icon name="hourglass" size={20} /><div><b>{p.stato === "in_attesa_integrazione" ? "Termini sospesi — in attesa di integrazione." : "Termini sospesi — in attesa di parere."}</b> I giorni non decorrono finché non si riprende l'istruttoria.</div></div>}

      <div className="split">
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card__head"><Icon name="route" size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Avanzamento del procedimento</h3><span className="spacer" /><span className="sub">{M.stati[p.stato]?.lbl ?? p.stato}</span></div>
            <div className="card__body">
              {!perm.lavora && <div className="banner banner--ambra" style={{ marginBottom: 14, fontSize: 13 }}><Icon name="lock" size={16} /><div>La lavorazione è riservata ai tecnici dell'Ufficio. Il ruolo <b>{M.users[me]?.ruolo ?? me}</b>{perm.supervisione ? " può supervisionare e riassegnare." : " può solo consultare."}</div></div>}
              {trans.length > 0
                ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{trans.map((t) => <button key={t.to || t.action} className={`btn btn--${t.variant}`} disabled={!perm.lavora || busy} onClick={() => doTransition(t)}><Icon name={t.ico} size={17} stroke={2} />{t.lbl}</button>)}</div>
                : <div className="muted" style={{ fontSize: 14 }}>Nessuna transizione disponibile per questo stato.</div>}
              {p.stato === "in_lavorazione" && missing.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn--ai" disabled={!perm.bozze || busy} onClick={() => genBozza("richiesta_integrazione")}><Icon name="forward" size={17} stroke={2} />Richiedi integrazione ({missing.length} documenti mancanti)</button>
                </div>
              )}
            </div>
          </div>

          {com && com.ai.documentiAttesi && (
            <div className="aibox">
              <div className="aibox__head"><span className="spark"><Icon name="sparkles" size={16} stroke={2} /></span><div><h4>Analisi di completezza</h4><div className="lbl">{missing.length ? `${missing.length} documenti mancanti rilevati` : "Documentazione completa"}</div></div></div>
              <div className="aibox__body">
                <div className="checklist">
                  {com.ai.documentiAttesi.map((d, i) => (
                    <div key={i} className={"chkitem " + (d.ok ? "chkitem--ok" : "chkitem--missing")}>
                      <span className="chkitem__box">{d.ok && <Icon name="check" size={13} stroke={3} />}</span>
                      <span className="chkitem__txt">{d.doc}</span>
                      <span className="chkitem__tag">{d.ok ? <Badge tone="verde">allegato</Badge> : <Badge tone="ambra">mancante</Badge>}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="aibox__disclaimer"><Icon name="info" size={15} stroke={2} />Elenco proposto in base al tipo di procedimento. Verifica sempre la documentazione richiesta dal regolamento comunale.</div>
            </div>
          )}

          <div className="card">
            <div className="card__head"><Icon name="sparkles" size={18} stroke={2} style={{ color: "var(--ai)" }} /><h3>Assistente atti</h3><span className="sub">· bozze con revisione umana</span></div>
            <div className="card__body">
              <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-muted)" }}>Genera una bozza di comunicazione o atto ricorrente. L'AI non firma e non adotta provvedimenti: produce un testo che resta sempre da verificare.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["avvio_procedimento", "risposta_cittadino", "richiesta_parere", "sollecito"].map((k) => (
                  <button key={k} className="btn btn--subtle" style={{ justifyContent: "flex-start" }} disabled={!perm.bozze || busy} onClick={() => genBozza(k)}>
                    <Icon name={DRAFT_TIPI[k].ico} size={17} stroke={2} style={{ color: "var(--ai)" }} />{DRAFT_TIPI[k].lbl}
                  </button>
                ))}
              </div>
              {!perm.bozze && <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "12px 0 0" }}><Icon name="lock" size={13} stroke={2} /> Generazione atti riservata ai tecnici dell'Ufficio.</p>}
            </div>
          </div>

          <DiarioStati p={p} M={M} nav={nav} />
        </div>

        {/* RIGHT */}
        <div className="sidecol">
          <div className="card">
            <div className="card__body" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span className="kpi__ico" style={{ width: 46, height: 46, background: bgFor(rel.tone), color: colFor(rel.tone) }}><Icon name={ritardo ? "alertTriangle" : "calendar"} size={22} stroke={2} /></span>
              <div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 700 }}>{sospesa ? "Termine (sospeso)" : "Termine di conclusione"}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--blu-900)" }}>{fmtDate(p.scadenza)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: colFor(sospesa ? "gray" : rel.tone) }}>{sospesa ? "conteggio sospeso" : rel.txt}</div>
              </div>
            </div>
          </div>

          <div className="card"><div className="card__head"><h3>Stato della pratica</h3></div><div className="card__body"><Stepper p={p} M={M} /></div></div>

          <div className="card">
            <div className="card__head"><h3>Dettagli</h3></div>
            <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {detRow("Richiedente", p.richiedente)}
              {detRow("Procedimento", p.tipoProcedimento)}
              {detRow("Ufficio", p.ufficio)}
              <div>
                <div className="fld" style={{ marginBottom: 4 }}>Responsabile</div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>{p.responsabile ? <><Avatar user={p.responsabile} size={26} /><span style={{ fontWeight: 600 }}>{M.users[p.responsabile]?.nome}</span></> : <span className="muted">non assegnato</span>}</div>
                {perm.supervisione && (
                  <select className="input" style={{ marginTop: 8 }} value={p.responsabile || ""} onChange={(e) => act(() => api.riassegna(p.id, { responsabile: e.target.value, me }, me), "Pratica riassegnata")}>
                    {[["esposito", "Geom. Luigi Esposito"], ["deluca", "Geom. Sara De Luca"]].map(([rid, nm]) => <option key={rid} value={rid}>{nm}</option>)}
                  </select>
                )}
              </div>
              {detRow("Protocollo", <span className="mono">{p.protocollo}</span>)}
              {detRow("Apertura", fmtDate(p.apertura))}
              {com && detRow("Comunicazione", <a className="mono" style={{ color: "var(--blu)", cursor: "pointer" }} onClick={() => nav("comunicazione", { id: com.id })}>{com.id}</a>)}
            </div>
          </div>

          <div className="card">
            <div className="card__head"><Icon name="history" size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Tracciabilità</h3><span className="sub">· {p.cronologia.length} eventi</span></div>
            <div className="card__body"><div className="timeline">{[...p.cronologia].reverse().map((e) => <TimelineItem key={e.id} entry={e} />)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
