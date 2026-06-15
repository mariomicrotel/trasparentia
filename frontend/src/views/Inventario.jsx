import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Badge, fmtDate } from "../ui.jsx";

const STATO_TONE = { ottimo: "verde", buono: "verde", discreto: "blu", scarso: "ambra", critico: "rosso" };
const STATO_COLOR = { ottimo: "#1a7a45", buono: "#1a7a45", discreto: "#0066cc", scarso: "#a66300", critico: "#d9364f" };
const TIPO_ICO = { immobile: "building", mobile: "box", infrastruttura: "route" };
function BeniMappa({ list, sel, onSelect, canAdmin, me, onGeoSaved }) {
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef({});
  const [geoTip, setGeoTip] = useState(null); // {id, nome} del bene in attesa di pin

  // Inizializzazione mappa
  useEffect(() => {
    if (mapRef.current && leafletRef.current) return; // già inizializzata

    const center = list.find((b) => b.lat && b.lon) || {};
    const map = L.map("inventario-map", { zoomControl: true }).setView(
      [center.lat || 40.4162, center.lon || 15.2014], 15
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    leafletRef.current = map;

    // Clic sulla mappa per posizionare un bene (solo admin + geoTip attivo)
    map.on("click", (e) => {
      setGeoTip((tip) => {
        if (!tip) return null;
        api.geoBene(tip.id, e.latlng.lat, e.latlng.lng, me).then((updated) => {
          onGeoSaved(updated);
          setGeoTip(null);
        }).catch(() => setGeoTip(null));
        return null;
      });
    });

    return () => { map.remove(); leafletRef.current = null; };
  }, []);

  // Aggiorna marker al cambio della lista
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;

    // Rimuovi marker orfani
    Object.keys(markersRef.current).forEach((id) => {
      if (!list.find((b) => b.id === id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    });

    list.forEach((b) => {
      if (!b.lat || !b.lon) return;
      const col = STATO_COLOR[b.stato] || "#555";
      const html = `<div style="width:16px;height:16px;border-radius:50%;background:${col};border:2.5px solid #fff;box-shadow:0 1px 4px #0003;cursor:pointer"></div>`;
      const icon = L.divIcon({ html, className: "", iconSize: [16, 16], iconAnchor: [8, 8] });

      if (markersRef.current[b.id]) {
        markersRef.current[b.id].setLatLng([b.lat, b.lon]).setIcon(icon);
      } else {
        const m = L.marker([b.lat, b.lon], { icon })
          .addTo(map)
          .bindTooltip(`<b>${b.denominazione}</b><br>${b.ubicazione}`, { direction: "top", offset: [0, -8] });
        m.on("click", () => onSelect(b));
        markersRef.current[b.id] = m;
      }
    });
  }, [list]);

  // Evidenzia il marker del bene selezionato
  useEffect(() => {
    const map = leafletRef.current;
    if (!map || !sel) return;
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const b = list.find((x) => x.id === id);
      if (!b) return;
      const col = STATO_COLOR[b.stato] || "#555";
      const active = id === sel.id;
      const html = `<div style="width:${active ? 22 : 16}px;height:${active ? 22 : 16}px;border-radius:50%;background:${col};border:${active ? "3px solid #17324d" : "2.5px solid #fff"};box-shadow:0 1px 4px #0003;cursor:pointer"></div>`;
      const size = active ? 22 : 16;
      m.setIcon(L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] }));
    });
    if (sel.lat && sel.lon) map.panTo([sel.lat, sel.lon], { animate: true });
  }, [sel]);

  return (
    <div style={{ position: "relative" }}>
      <div id="inventario-map" style={{ height: 460, borderRadius: 8, border: "1px solid var(--border)", zIndex: 0 }} />
      {canAdmin && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {geoTip ? (
            <div className="banner banner--blu" style={{ flex: 1, padding: "8px 12px", fontSize: 13 }}>
              <Icon name="mapPin" size={15} />
              <span>Clicca sulla mappa per posizionare <b>{geoTip.nome}</b></span>
              <button className="btn btn--ghost" style={{ marginLeft: "auto", padding: "2px 8px", fontSize: 12 }} onClick={() => setGeoTip(null)}>Annulla</button>
            </div>
          ) : sel ? (
            <button className="btn btn--ghost" style={{ fontSize: 12 }}
              onClick={() => setGeoTip({ id: sel.id, nome: sel.denominazione })}>
              <Icon name="mapPin" size={14} stroke={2} />
              {sel.lat ? "Sposta pin" : "Aggiungi pin"} — {sel.denominazione}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Seleziona un bene dalla lista per posizionarlo sulla mappa.</span>
          )}
          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>Mappa: OpenStreetMap</span>
        </div>
      )}
      {!canAdmin && (
        <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-faint)", textAlign: "right" }}>Mappa: OpenStreetMap</div>
      )}
    </div>
  );
}

export default function Inventario({ M, me, toast, tick, refresh }) {
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [tipo, setTipo] = useState("tutti");
  const [vista, setVista] = useState("lista"); // "lista" | "mappa"
  const [importing, setImporting] = useState(false);
  const [esitoImport, setEsitoImport] = useState(null);
  const leafletLoaded = true; // Leaflet è importato staticamente
  const fileRef = useRef(null);

  const canAdmin = !!(M.perm?.[me]?.supervisione);

  const carica = () => api.listBeni().then((b) => {
    setList(b);
    setSel((s) => (s ? b.find((x) => x.id === s.id) || b[0] || null : b[0] || null));
  }).catch(() => setList([]));

  useEffect(() => { carica(); }, [tick]);


  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true); setEsitoImport(null);
    try {
      const r = await api.importBeniCsv(file, me);
      setEsitoImport(r);
      toast(`${r.importati} beni importati${r.errori ? `, ${r.errori} righe con errori` : ""}`, r.errori ? "" : "success");
      await carica(); refresh && refresh();
    } catch (err) { toast(err.message || "Errore importazione", ""); }
    finally { setImporting(false); }
  }

  function onGeoSaved(updated) {
    setList((prev) => prev.map((b) => b.id === updated.id ? updated : b));
    setSel((s) => (s && s.id === updated.id ? updated : s));
    toast("Coordinate salvate", "success");
  }

  const shown = tipo === "tutti" ? list : list.filter((b) => b.tipo === tipo);
  const critici = list.filter((b) => ["scarso", "critico"].includes(b.stato)).length;
  const georef = list.filter((b) => b.lat && b.lon).length;

  const tabs = [["tutti", "Tutti"], ["immobile", "Immobili"], ["mobile", "Mobili"], ["infrastruttura", "Infrastrutture"]];

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Inventario beni</span></div>
          <h1>Inventario beni comunali</h1>
          <p>
            Immobili, mobili e infrastrutture con stato, responsabile, scadenze e QR code.
            {critici > 0 && <> <b style={{ color: "var(--rosso)" }}>{critici} beni in stato scarso/critico.</b></>}
            {" "}<span style={{ color: "var(--text-muted)", fontSize: 13 }}>{georef}/{list.length} georeferenziati.</span>
          </p>
        </div>
        <div className="pagehead__actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            {[["lista", "Lista", "list"], ["mappa", "Mappa", "map"]].map(([k, lbl, ico]) => (
              <button key={k} onClick={() => setVista(k)}
                style={{ padding: "5px 12px", fontSize: 13, display: "flex", gap: 5, alignItems: "center", cursor: "pointer",
                  background: vista === k ? "var(--blu-050)" : "transparent",
                  color: vista === k ? "var(--blu)" : "var(--text-muted)",
                  border: "none", borderRight: k === "lista" ? "1px solid var(--border)" : "none" }}>
                <Icon name={ico} size={14} stroke={2} />{lbl}
              </button>
            ))}
          </div>
          {canAdmin && (
            <>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
              <button className="btn btn--primary" onClick={() => fileRef.current?.click()} disabled={importing}>
                <Icon name="upload" size={15} stroke={2} />{importing ? "Importazione…" : "Importa CSV"}
              </button>
            </>
          )}
        </div>
      </div>

      {esitoImport && (
        <div className={"banner " + (esitoImport.errori ? "banner--ambra" : "banner--verde")} style={{ marginBottom: 16, fontSize: 13 }}>
          <Icon name={esitoImport.errori ? "alertCircle" : "checkCircle"} size={16} />
          <div>
            <b>{esitoImport.importati}</b> beni importati{esitoImport.errori ? <>, <b>{esitoImport.errori}</b> righe scartate.</> : "."}
            {esitoImport.dettaglio_errori?.length > 0 && (
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                Righe con errore: {esitoImport.dettaglio_errori.map((e) => `riga ${e.riga}`).join(", ")}.
              </span>
            )}
            <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
              Colonne richieste: <code>tipo, categoria, denominazione</code> · opzionali: <code>ubicazione, codice, stato, responsabile, lat, lon</code>.
            </span>
          </div>
        </div>
      )}

      <div className="filterbar">
        {tabs.map(([k, lbl]) => <button key={k} className="chiptab" data-active={tipo === k} onClick={() => setTipo(k)}>{lbl}</button>)}
      </div>

      {vista === "mappa" ? (
        <div className="split">
          <div style={{ flex: 1, minWidth: 0 }}>
            {leafletLoaded
              ? <BeniMappa list={shown} sel={sel} onSelect={setSel} canAdmin={canAdmin} me={me} onGeoSaved={onGeoSaved} />
              : <div className="card"><div className="card__body" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Caricamento mappa…</div></div>
            }
          </div>
          <div className="sidecol">
            {sel && <SchedaBene sel={sel} M={M} />}
          </div>
        </div>
      ) : (
        <div className="split">
          <div className="card"><div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {shown.map((b) => (
              <div key={b.id} role="button" tabIndex={0} onClick={() => setSel(b)} onKeyDown={(e) => e.key === "Enter" && setSel(b)}
                   data-active={sel && sel.id === b.id}
                   style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 8px", borderBottom: "1px solid var(--surface-2)", cursor: "pointer",
                     background: sel && sel.id === b.id ? "var(--blu-050)" : "transparent", borderRadius: 8 }}>
                <span className="att__ico"><Icon name={TIPO_ICO[b.tipo] || "box"} size={18} stroke={2} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--blu-900)" }}>{b.denominazione}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="mono">{b.codice}</span> · {b.ubicazione}
                    {b.lat && b.lon && <Icon name="mapPin" size={12} stroke={2} style={{ color: "var(--blu)", flexShrink: 0 }} />}
                  </div>
                </div>
                <Badge tone={STATO_TONE[b.stato] || "gray"}>{b.stato}</Badge>
              </div>
            ))}
          </div></div>
          <div className="sidecol">
            {sel && <SchedaBene sel={sel} M={M} />}
          </div>
        </div>
      )}
    </div>
  );
}

function SchedaBene({ sel, M }) {
  return (
    <div className="card">
      <div className="card__head"><Icon name={TIPO_ICO[sel.tipo] || "box"} size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Scheda bene</h3></div>
      <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--blu-900)" }}>{sel.denominazione}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}><span className="mono">{sel.codice}</span> · {sel.categoria}</div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <img src={api.qrUrl(sel.id)} alt={"QR " + sel.codice} width={104} height={104}
               style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 4, background: "#fff" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Badge tone={STATO_TONE[sel.stato] || "gray"}>Stato: {sel.stato}</Badge>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Ubicazione</div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{sel.ubicazione}</div>
            {sel.lat && sel.lon && (
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "monospace" }}>
                <Icon name="mapPin" size={11} /> {sel.lat.toFixed(5)}, {sel.lon.toFixed(5)}
              </div>
            )}
          </div>
        </div>
        <dl className="metagrid">
          {sel.dati?.valoreContabile != null && <div><dt>Valore contabile</dt><dd>€ {Number(sel.dati.valoreContabile).toLocaleString("it-IT")}</dd></div>}
          {sel.dati?.annoAcquisizione && <div><dt>Anno</dt><dd>{sel.dati.annoAcquisizione}</dd></div>}
          {sel.responsabile && <div><dt>Responsabile</dt><dd>{M.users[sel.responsabile]?.nome || sel.responsabile}</dd></div>}
          {sel.dati?.targa && <div><dt>Targa</dt><dd className="mono">{sel.dati.targa}</dd></div>}
          {(sel.dati?.foglio || sel.dati?.particella) && <div><dt>Catasto</dt><dd>fg. {sel.dati.foglio} p.lla {sel.dati.particella}</dd></div>}
          {sel.dati?.ultimaVerifica && <div><dt>Ultima verifica</dt><dd>{fmtDate(sel.dati.ultimaVerifica)}</dd></div>}
          {sel.dati?.scadenzaCollaudo && <div><dt>Scadenza collaudo</dt><dd>{fmtDate(sel.dati.scadenzaCollaudo)}</dd></div>}
        </dl>
        {sel.dati?.note && <div><div className="fld" style={{ marginBottom: 3 }}>Note</div><div style={{ fontSize: 13, color: "var(--text)" }}>{sel.dati.note}</div></div>}
      </div>
    </div>
  );
}
