import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Badge, fmtDate } from "../ui.jsx";

const STATO_TONE = { ottimo: "verde", buono: "verde", discreto: "blu", scarso: "ambra", critico: "rosso" };
const TIPO_ICO = { immobile: "building", mobile: "box", infrastruttura: "route" };

export default function Inventario({ M, me, toast, tick, refresh }) {
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [tipo, setTipo] = useState("tutti");
  const [importing, setImporting] = useState(false);
  const [esitoImport, setEsitoImport] = useState(null);
  const fileRef = useRef(null);

  const canAdmin = !!(M.perm?.[me]?.supervisione);

  const carica = () => api.listBeni().then((b) => { setList(b); setSel((s) => s || b[0] || null); }).catch(() => setList([]));
  useEffect(() => { carica(); }, [tick]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // consenti re-upload dello stesso file
    if (!file) return;
    setImporting(true);
    setEsitoImport(null);
    try {
      const r = await api.importBeniCsv(file, me);
      setEsitoImport(r);
      toast(`${r.importati} beni importati${r.errori ? `, ${r.errori} righe con errori` : ""}`, r.errori ? "" : "success");
      await carica();
      refresh && refresh();
    } catch (err) { toast(err.message || "Errore importazione", ""); }
    finally { setImporting(false); }
  }

  const shown = tipo === "tutti" ? list : list.filter((b) => b.tipo === tipo);
  const critici = list.filter((b) => ["scarso", "critico"].includes(b.stato)).length;

  const tabs = [["tutti", "Tutti"], ["immobile", "Immobili"], ["mobile", "Mobili"], ["infrastruttura", "Infrastrutture"]];

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Inventario beni</span></div>
          <h1>Inventario beni comunali</h1>
          <p>Immobili, mobili e infrastrutture con stato, responsabile, scadenze e QR code. {critici > 0 && <b style={{ color: "var(--rosso)" }}>{critici} beni in stato scarso/critico.</b>}</p>
        </div>
        {canAdmin && (
          <div className="pagehead__actions">
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
            <button className="btn btn--primary" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Icon name="upload" size={15} stroke={2} />{importing ? "Importazione…" : "Importa CSV"}
            </button>
          </div>
        )}
      </div>

      {esitoImport && (
        <div className={"banner " + (esitoImport.errori ? "banner--ambra" : "banner--verde")} style={{ marginBottom: 16, fontSize: 13 }}>
          <Icon name={esitoImport.errori ? "alertCircle" : "checkCircle"} size={16} />
          <div>
            <b>{esitoImport.importati}</b> beni importati{esitoImport.errori ? <>, <b>{esitoImport.errori}</b> righe scartate (mancano tipo/categoria/denominazione).</> : "."}
            {esitoImport.dettaglio_errori?.length > 0 && (
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                Prime righe con errore: {esitoImport.dettaglio_errori.map((e) => `riga ${e.riga}`).join(", ")}.
              </span>
            )}
            <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
              Colonne richieste: <code>tipo, categoria, denominazione</code> · opzionali: <code>ubicazione, codice, stato, responsabile</code>.
            </span>
          </div>
        </div>
      )}

      <div className="filterbar">
        {tabs.map(([k, lbl]) => <button key={k} className="chiptab" data-active={tipo === k} onClick={() => setTipo(k)}>{lbl}</button>)}
      </div>

      <div className="split">
        <div className="card"><div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {shown.map((b) => (
            <div key={b.id} role="button" tabIndex={0} onClick={() => setSel(b)} onKeyDown={(e) => e.key === "Enter" && setSel(b)} data-active={sel && sel.id === b.id}
                 style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 8px", borderBottom: "1px solid var(--surface-2)", cursor: "pointer", background: sel && sel.id === b.id ? "var(--blu-050)" : "transparent", borderRadius: 8 }}>
              <span className="att__ico"><Icon name={TIPO_ICO[b.tipo] || "box"} size={18} stroke={2} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "var(--blu-900)" }}>{b.denominazione}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}><span className="mono">{b.codice}</span> · {b.ubicazione}</div>
              </div>
              <Badge tone={STATO_TONE[b.stato] || "gray"}>{b.stato}</Badge>
            </div>
          ))}
        </div></div>

        <div className="sidecol">
          {sel && (
            <div className="card">
              <div className="card__head"><Icon name={TIPO_ICO[sel.tipo] || "box"} size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Scheda bene</h3></div>
              <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--blu-900)" }}>{sel.denominazione}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}><span className="mono">{sel.codice}</span> · {sel.categoria}</div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <img src={api.qrUrl(sel.id)} alt={"QR " + sel.codice} width={104} height={104} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 4, background: "#fff" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Badge tone={STATO_TONE[sel.stato] || "gray"}>Stato: {sel.stato}</Badge>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Ubicazione</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{sel.ubicazione}</div>
                  </div>
                </div>
                <dl className="metagrid">
                  {sel.dati.valoreContabile != null && <div><dt>Valore contabile</dt><dd>€ {Number(sel.dati.valoreContabile).toLocaleString("it-IT")}</dd></div>}
                  {sel.dati.annoAcquisizione && <div><dt>Anno</dt><dd>{sel.dati.annoAcquisizione}</dd></div>}
                  {sel.responsabile && <div><dt>Responsabile</dt><dd>{M.users[sel.responsabile]?.nome || sel.responsabile}</dd></div>}
                  {sel.dati.targa && <div><dt>Targa</dt><dd className="mono">{sel.dati.targa}</dd></div>}
                  {(sel.dati.foglio || sel.dati.particella) && <div><dt>Catasto</dt><dd>fg. {sel.dati.foglio} p.lla {sel.dati.particella}</dd></div>}
                  {sel.dati.ultimaVerifica && <div><dt>Ultima verifica</dt><dd>{fmtDate(sel.dati.ultimaVerifica)}</dd></div>}
                  {sel.dati.scadenzaCollaudo && <div><dt>Scadenza collaudo</dt><dd>{fmtDate(sel.dati.scadenzaCollaudo)}</dd></div>}
                </dl>
                {sel.dati.note && <div><div className="fld" style={{ marginBottom: 3 }}>Note</div><div style={{ fontSize: 13, color: "var(--text)" }}>{sel.dati.note}</div></div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
