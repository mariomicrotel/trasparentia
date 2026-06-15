import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Badge, CatBadge, ConfBar, Avatar, fmtDate, fmtDateTime, colFor } from "../ui.jsx";

const UFFICI = ["Ufficio Tecnico", "Ragioneria / Tributi", "Anagrafe e Stato Civile", "Segreteria / Protocollo", "Polizia Locale", "Servizi Sociali"];
const RESP_BY_UFF = { "Ufficio Tecnico": [["esposito", "Geom. Luigi Esposito"], ["deluca", "Geom. Sara De Luca"]] };

function AiRow({ label, children }) {
  return <div className="airow"><div className="airow__lbl">{label}</div><div className="airow__val">{children}</div></div>;
}

export default function Comunicazione({ id, M, me, nav, toast, refresh }) {
  const perm = M.perm[me] || {};
  const [com, setCom] = useState(null);
  const [ai, setAi] = useState(null);
  const [cat, setCat] = useState("");
  const [uff, setUff] = useState("");
  const [resp, setResp] = useState("");
  const [scad, setScad] = useState("");
  const [prio, setPrio] = useState("media");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getCom(id).then((c) => {
      setCom(c); setAi(c.ai);
      setCat(c.ai.categoria); setUff(c.ai.ufficio); setResp(c.ai.responsabile || "");
      setScad(c.ai.scadenzaSuggerita || ""); setPrio(c.ai.urgenza === "urgente" ? "urgente" : c.ai.urgenza === "alta" ? "alta" : "media");
    }).catch(() => setCom(false));
  }, [id]);

  if (com === false) return <div className="page"><div className="empty card"><Icon name="alertCircle" size={40} /><h3>Comunicazione non trovata</h3></div></div>;
  if (!com) return <div className="page"><p>Caricamento…</p></div>;

  const lavorata = !!com.pratica;
  const respOptions = RESP_BY_UFF[uff] || [];
  const override = cat !== ai.categoria || uff !== ai.ufficio;

  async function prendiCarico() {
    setBusy(true);
    try {
      const prat = await api.prendiCarico(com.id, { categoria: cat, ufficio: uff, responsabile: resp || null, scadenza: scad, priorita: prio, override, me }, me);
      toast("Pratica " + prat.id + " aperta · prot. " + prat.protocollo, "success");
      refresh(); nav("pratica", { id: prat.id });
    } catch (e) { toast(e.message, ""); } finally { setBusy(false); }
  }
  async function riclassifica() {
    setBusy(true);
    try {
      const r = await api.aiClassifica({ oggetto: com.oggetto, corpo: com.corpo, allegati: com.allegati });
      setAi({ ...ai, ...r });
      setCat(r.categoria); if (r.ufficio) setUff(r.ufficio);
      toast("Riclassificazione AI completata", "ai");
    } catch (e) { toast("Server AI non disponibile — uso la proposta esistente", ""); } finally { setBusy(false); }
  }

  return (
    <div className="page page--wide">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><a onClick={() => nav("inbox")}>Comunicazioni</a><Icon name="chevronRight" size={14} /><span className="mono">{com.id}</span></div>
          <h1>Dettaglio comunicazione</h1>
        </div>
        <div className="pagehead__actions">
          <button className="btn btn--subtle" onClick={() => nav("inbox")}><Icon name="arrowLeft" size={17} stroke={2} />Torna</button>
          <button className="btn btn--ghost" disabled={busy} onClick={riclassifica}><Icon name="sparkles" size={17} stroke={2} />Riclassifica con AI</button>
        </div>
      </div>

      {lavorata && (
        <div className="banner banner--verde" style={{ marginBottom: 18 }}>
          <Icon name="checkCircle" size={20} />
          <div><b>Comunicazione presa in carico.</b> È stato avviato il procedimento <span className="mono">{com.pratica}</span>.</div>
          <div className="banner__actions"><button className="btn btn--success btn--sm" onClick={() => nav("pratica", { id: com.pratica })}>Apri pratica<Icon name="arrowRight" size={15} stroke={2} /></button></div>
        </div>
      )}

      <div className="split">
        {/* LEFT: documento */}
        <div className="docview">
          <div className="docview__head">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="blu" icon="mail">{com.canale}</Badge>
              {com.urgente && <Badge tone="rosso" icon="bolt">Urgente</Badge>}
              <span className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)", alignSelf: "center" }}>{com.id}</span>
            </div>
            <div className="docview__subj">{com.oggetto}</div>
            <div className="docview__from">
              <span className="avatar" style={{ width: 40, height: 40, background: "var(--blu-900)", fontSize: 14 }}><Icon name="building" size={18} /></span>
              <div>
                <div style={{ fontWeight: 700, color: "var(--blu-900)" }}>{com.mittente.nome}<span style={{ fontWeight: 400, color: "var(--text-muted)" }}>{"  ·  " + com.mittente.tipo}</span></div>
                <div className="mono" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{com.mittente.pec}</div>
                {com.mittente.perConto && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>per conto di {com.mittente.perConto}</div>}
              </div>
            </div>
          </div>
          <dl className="metagrid">
            <div><dt>Ricevuta il</dt><dd>{fmtDateTime(com.arrivo)}</dd></div>
            <div><dt>Canale</dt><dd>{com.canale} istituzionale</dd></div>
            <div><dt>Protocollo</dt><dd>{com.pratica ? <span className="mono">assegnato</span> : <span className="muted">da protocollare</span>}</dd></div>
            <div><dt>Allegati</dt><dd>{com.allegati.length}</dd></div>
          </dl>
          <div className="docview__body">{com.corpo.map((p, i) => <p key={i}>{p}</p>)}</div>
          <div style={{ borderTop: "1px solid var(--border)", padding: "14px 22px 4px", fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>Allegati ({com.allegati.length})</div>
          <div className="attlist">
            {com.allegati.map((a, i) => (
              <div className="att" key={i}>
                <span className="att__ico"><Icon name={a.tipo === "IMG" ? "eye" : "fileText"} size={18} stroke={2} /></span>
                <div><div className="att__name">{a.nome}</div><div className="att__meta">{a.tipo} · {a.size}{a.pagine ? " · " + a.pagine + " pagine" : ""}</div></div>
                <span className="att__flag"><Badge tone="verde" icon="check">riconosciuto</Badge></span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: AI + presa in carico */}
        <div className="sidecol">
          <div className="aibox">
            <div className="aibox__head">
              <span className="spark"><Icon name="sparkles" size={16} stroke={2} /></span>
              <div><h4>Classificazione assistita</h4><div className="lbl">TrasParentIA · proposta automatica</div></div>
            </div>
            <div className="aibox__body">
              <AiRow label="Categoria">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <CatBadge cat={ai.categoria} /><ConfBar p={ai.confidenza} width={120} />
                </div>
              </AiRow>
              {ai.confidenza < 0.7 && (
                <div style={{ margin: "4px 0 8px" }}>
                  <div className="banner banner--ambra" style={{ fontSize: 12.5, padding: "9px 11px" }}>
                    <Icon name="alertCircle" size={16} /><div>Confidenza bassa — l'AI consiglia <b>verifica manuale</b> dello smistamento.</div>
                  </div>
                </div>
              )}
              <AiRow label="Perché"><div className="aiquote">{ai.motivazione}</div></AiRow>
              {ai.alternative && ai.alternative.length > 0 && (
                <AiRow label="Alternative">
                  <div className="alts">
                    {ai.alternative.map((alt, i) => {
                      const cc = M.cat[alt.categoria]; if (!cc) return null;
                      return (
                        <button key={i} className="alt" onClick={() => { setCat(alt.categoria); if (alt.categoria === "pratica_tecnica") setUff("Ufficio Tecnico"); }}>
                          <Icon name={cc.ico} size={15} stroke={2} style={{ color: colFor(cc.col) }} />{cc.lbl}
                          <span className="altpct">{Math.round(alt.p * 100)}%</span>
                        </button>
                      );
                    })}
                  </div>
                </AiRow>
              )}
              <AiRow label="Procedimento"><span className="big">{ai.tipoProcedimento}</span></AiRow>
              <AiRow label="Smistamento">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="building" size={15} stroke={2} style={{ color: "var(--text-muted)" }} /><b>{ai.ufficio}</b></div>
                  {ai.responsabile && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}><Avatar user={ai.responsabile} size={22} />{M.users[ai.responsabile]?.nome}</div>}
                </div>
              </AiRow>
              <AiRow label="Urgenza"><Badge tone={ai.urgenza === "urgente" ? "rosso" : ai.urgenza === "alta" ? "ambra" : "blu"}>{M.prio[ai.urgenza] ? M.prio[ai.urgenza].lbl : ai.urgenza}</Badge></AiRow>
              <AiRow label="Termine"><div><b>{fmtDate(ai.scadenzaSuggerita)}</b><span className="muted">{"  ·  " + ai.termineGiorni + " gg"}</span></div></AiRow>
            </div>
            <div className="aibox__disclaimer"><Icon name="info" size={15} stroke={2} />L'AI propone una classificazione. La decisione e l'assegnazione restano sempre dell'operatore.</div>
          </div>

          {!lavorata && (
            <div className="card">
              <div className="card__head"><Icon name="forward" size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Presa in carico</h3>{override && <span style={{ marginLeft: "auto" }}><Badge tone="ambra" icon="swap">Modificato</Badge></span>}</div>
              <div className="card__body">
                {!perm.prendiCarico && (
                  <div className="banner banner--ambra" style={{ marginBottom: 14, fontSize: 13 }}>
                    <Icon name="lock" size={16} /><div>Azione riservata a Operatore protocollo / Responsabile. Il ruolo <b>{M.users[me]?.ruolo ?? me}</b> può solo consultare.</div>
                  </div>
                )}
                <div className="fldrow"><label className="fld">Categoria documentale</label>
                  <select className="input" value={cat} disabled={!perm.prendiCarico} onChange={(e) => setCat(e.target.value)}>
                    {Object.keys(M.cat).map((k) => <option key={k} value={k}>{M.cat[k].lbl}</option>)}
                  </select></div>
                <div className="fldrow"><label className="fld">Ufficio / funzione competente</label>
                  <select className="input" value={uff} disabled={!perm.prendiCarico} onChange={(e) => setUff(e.target.value)}>
                    {UFFICI.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select></div>
                {respOptions.length > 0 && (
                  <div className="fldrow"><label className="fld">Responsabile</label>
                    <select className="input" value={resp} disabled={!perm.prendiCarico} onChange={(e) => setResp(e.target.value)}>
                      <option value="">— non assegnato —</option>
                      {respOptions.map(([rid, nm]) => <option key={rid} value={rid}>{nm}</option>)}
                    </select></div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="fldrow"><label className="fld">Scadenza istruttoria</label><input className="input" type="date" value={scad} disabled={!perm.prendiCarico} onChange={(e) => setScad(e.target.value)} /></div>
                  <div className="fldrow"><label className="fld">Priorità</label>
                    <select className="input" value={prio} disabled={!perm.prendiCarico} onChange={(e) => setPrio(e.target.value)}>
                      {Object.keys(M.prio).map((k) => <option key={k} value={k}>{M.prio[k].lbl}</option>)}
                    </select></div>
                </div>
                <button className="btn btn--primary btn--lg" style={{ width: "100%" }} disabled={!perm.prendiCarico || busy} onClick={prendiCarico}>
                  <Icon name="tag" size={18} stroke={2} />Protocolla e prendi in carico
                </button>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0", textAlign: "center" }}>Verrà assegnato un numero di protocollo e aperta la pratica nello scadenziario.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
