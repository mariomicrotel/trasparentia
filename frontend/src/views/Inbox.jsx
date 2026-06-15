import React, { useEffect, useState, useMemo, useRef } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Badge, ConfBar, bgFor, colFor, fmtDateTime, fmtTime, daysUntil } from "../ui.jsx";

function UploadModal({ M, me, onClose, onDone, toast }) {
  const fileRef = useRef(null);
  const [oggetto, setOggetto] = useState("");
  const [mitt, setMitt] = useState("");
  const [tipo, setTipo] = useState("Cittadino");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const f = fileRef.current?.files?.[0];
    if (!f) { toast("Seleziona un documento", ""); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("oggetto", oggetto);
      fd.append("mittente_nome", mitt);
      fd.append("mittente_tipo", tipo);
      const com = await api.importComunicazione(fd, me);
      const d = com._documento || {};
      toast(`Documento acquisito${d.ocr ? " (OCR)" : ""} · ${d.chars || 0} caratteri estratti · ${com.id}`, "success");
      onDone(com);
    } catch (err) { toast(err.message, ""); } finally { setBusy(false); }
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal modal--sm" onSubmit={submit}>
        <div className="modal__head">
          <span className="brand__mark" style={{ width: 34, height: 34, borderRadius: 8 }}><Icon name="plus" size={18} stroke={2} /></span>
          <h3>Inserimento manuale assistito</h3><span className="spacer" />
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Chiudi"><Icon name="arrowLeft" size={18} /></button>
        </div>
        <div className="modal__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Carica un documento (PDF, immagine, EML, XML). Il sistema ne estrae il testo (OCR se necessario) e propone una classificazione AI.</p>
          <div className="fldrow"><label className="fld">Documento</label><input ref={fileRef} className="input" type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.xml,.eml,.txt,.csv" /></div>
          <div className="fldrow"><label className="fld">Oggetto (opzionale)</label><input className="input" value={oggetto} onChange={(e) => setOggetto(e.target.value)} placeholder="Se vuoto, usa il nome file" /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fldrow"><label className="fld">Mittente</label><input className="input" value={mitt} onChange={(e) => setMitt(e.target.value)} placeholder="Nome mittente" /></div>
            <div className="fldrow"><label className="fld">Tipo mittente</label>
              <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {["Cittadino", "Professionista", "Impresa", "Altra PA"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
          </div>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn btn--subtle" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn btn--primary" disabled={busy}><Icon name="sparkles" size={16} stroke={2} />{busy ? "Acquisizione…" : "Acquisisci e classifica"}</button>
        </div>
      </form>
    </div>
  );
}

function PecCard({ c, M, onOpen }) {
  const cat = M.cat[c.ai.categoria] || { col: "gray", lbl: "—", ico: "mail" };
  const lavorata = !!c.pratica;
  const urgent = c.ai.urgenza === "urgente" || c.urgente;
  const cls = ["pec", !c.letto && !lavorata && "pec--unread", urgent && "pec--urgent"].filter(Boolean).join(" ");
  const d = daysUntil(c.arrivo.slice(0, 10));
  const quando = d === 0 ? `oggi ${fmtTime(c.arrivo)}` : d === -1 ? `ieri ${fmtTime(c.arrivo)}` : fmtDateTime(c.arrivo);
  return (
    <div className={cls} role="button" tabIndex={0} onClick={() => onOpen(c.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(c.id)}>
      <span className="pec__icon" style={{ background: bgFor(cat.col), color: colFor(cat.col) }}>
        <Icon name={c.canale === "PEC" ? "mail" : cat.ico} size={21} stroke={1.8} />
      </span>
      <div className="pec__main">
        <div className="pec__top">
          <span className="pec__from">{c.mittente.nome}</span>
          <span className="pec__fromtype">· {c.mittente.tipo}</span>
          {urgent && <Badge tone="rosso" icon="bolt">Urgente</Badge>}
        </div>
        <div className="pec__subj">{c.oggetto}</div>
        <div className="pec__meta">
          <span className="mono">{c.id}</span>
          {c.allegati.length > 0 && <span className="attchip"><Icon name="paperclip" size={13} />{c.allegati.length} allegat{c.allegati.length === 1 ? "o" : "i"}</span>}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ai)" }}>
            <Icon name="sparkles" size={13} stroke={2} />AI: <b style={{ color: "var(--ai)" }}>{cat.lbl}</b>
          </span>
        </div>
      </div>
      <div className="pec__right">
        {lavorata
          ? <Badge tone="verde" icon="check">Presa in carico</Badge>
          : <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>conf.</span>
              <ConfBar p={c.ai.confidenza} width={64} showPct={false} />
            </span>}
        <span className="pec__time">{quando}</span>
      </div>
    </div>
  );
}

export default function Inbox({ M, nav, tick, me, toast, refresh }) {
  const [list, setList] = useState([]);
  const [filtro, setFiltro] = useState("da_lavorare");
  const [modal, setModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const perm = M.perm[me] || {};

  useEffect(() => { api.listCom().then(setList).catch(() => setList([])); }, [tick]);

  async function syncPec() {
    setSyncing(true);
    try {
      const r = await api.pecSync(me);
      if (!r.configured) toast(r.message || "PEC non configurata", "");
      else if (r.errore_connessione) toast("Errore connessione PEC: " + r.errore_connessione, "");
      else toast(`PEC sincronizzata: ${r.nuove} nuove comunicazioni`, r.nuove ? "success" : "");
      refresh();
    } catch (e) { toast(e.message, ""); } finally { setSyncing(false); }
  }

  const counts = useMemo(() => ({
    tutte: list.length,
    da_lavorare: list.filter((c) => !c.pratica).length,
    urgenti: list.filter((c) => (c.ai.urgenza === "urgente" || c.urgente) && !c.pratica).length,
    tecnico: list.filter((c) => c.ai.ufficio === "Ufficio Tecnico").length,
    bassa_conf: list.filter((c) => c.ai.confidenza < 0.7 && !c.pratica).length,
    lavorate: list.filter((c) => c.pratica).length,
  }), [list]);

  const shown = list.filter((c) => {
    if (filtro === "da_lavorare") return !c.pratica;
    if (filtro === "urgenti") return (c.ai.urgenza === "urgente" || c.urgente) && !c.pratica;
    if (filtro === "tecnico") return c.ai.ufficio === "Ufficio Tecnico";
    if (filtro === "bassa_conf") return c.ai.confidenza < 0.7 && !c.pratica;
    if (filtro === "lavorate") return c.pratica;
    return true;
  }).sort((a, b) => new Date(b.arrivo) - new Date(a.arrivo));

  const tabs = [
    ["da_lavorare", "Da lavorare", "inbox"], ["urgenti", "Urgenti", "bolt"],
    ["bassa_conf", "AI da verificare", "alertCircle"], ["tecnico", "Ufficio Tecnico", "folder"],
    ["lavorate", "Prese in carico", "check"], ["tutte", "Tutte", "list"],
  ];

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Comunicazioni</span></div>
          <h1>Comunicazioni in ingresso</h1>
          <p>Casella PEC istituzionale e documenti da protocollo. Ogni comunicazione viene pre-classificata dall'AI; lo smistamento resta sempre verificabile dall'operatore.</p>
        </div>
        <div className="pagehead__actions">
          <button className="btn btn--subtle" disabled={!perm.classifica || syncing} onClick={syncPec}><Icon name="refresh" size={17} stroke={2} />{syncing ? "Sincronizzo…" : "Sincronizza PEC"}</button>
          <button className="btn btn--primary" disabled={!perm.classifica} onClick={() => setModal(true)}><Icon name="plus" size={17} stroke={2} />Inserimento manuale</button>
        </div>
      </div>
      {modal && <UploadModal M={M} me={me} toast={toast} onClose={() => setModal(false)} onDone={(com) => { setModal(false); refresh(); nav("comunicazione", { id: com.id }); }} />}
      <div className="filterbar">
        {tabs.map(([k, lbl, ico]) => (
          <button key={k} className="chiptab" data-active={filtro === k} onClick={() => setFiltro(k)}>
            <Icon name={ico} size={15} stroke={2} />{lbl}<span className="n">{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="inbox">
        {shown.length === 0
          ? <div className="empty card"><Icon name="inbox" size={40} /><h3>Nessuna comunicazione</h3><p>Non ci sono comunicazioni per questo filtro.</p></div>
          : shown.map((c) => <PecCard key={c.id} c={c} M={M} onOpen={(id) => nav("comunicazione", { id })} />)}
      </div>
    </div>
  );
}
