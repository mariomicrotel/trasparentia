import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Badge, fmtDate } from "../ui.jsx";

const STATO_TONE = { ottimo: "verde", buono: "verde", discreto: "blu", scarso: "ambra", critico: "rosso" };
const STATO_COLOR = { ottimo: "#1a7a45", buono: "#1a7a45", discreto: "#0066cc", scarso: "#a66300", critico: "#d9364f" };
const TIPO_ICO = { immobile: "building", mobile: "box", infrastruttura: "route" };
const TIPI = ["immobile", "mobile", "infrastruttura"];
const STATI = ["ottimo", "buono", "discreto", "scarso", "critico"];

function BeniMappa({ list, sel, onSelect, canAdmin, me, onGeoSaved }) {
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef({});
  const [geoTip, setGeoTip] = useState(null);

  useEffect(() => {
    if (mapRef.current && leafletRef.current) return;

    const center = list.find((b) => b.lat && b.lon) || {};
    const map = L.map("inventario-map", { zoomControl: true }).setView(
      [center.lat || 40.4162, center.lon || 15.2014], 15
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    leafletRef.current = map;

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

  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;

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

function BeneForm({ bene, M, me, onSave, onClose }) {
  const isNew = !bene?.id;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: bene?.tipo || "immobile",
    categoria: bene?.categoria || "",
    denominazione: bene?.denominazione || "",
    ubicazione: bene?.ubicazione || "",
    codice: bene?.codice || "",
    stato: bene?.stato || "buono",
    responsabile: bene?.responsabile || "",
    dati: {
      valoreContabile: bene?.dati?.valoreContabile ?? "",
      annoAcquisizione: bene?.dati?.annoAcquisizione ?? "",
      targa: bene?.dati?.targa ?? "",
      foglio: bene?.dati?.foglio ?? "",
      particella: bene?.dati?.particella ?? "",
      ultimaVerifica: bene?.dati?.ultimaVerifica ?? "",
      scadenzaCollaudo: bene?.dati?.scadenzaCollaudo ?? "",
      note: bene?.dati?.note ?? "",
    },
  });

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function setDati(k, v) { setForm((f) => ({ ...f, dati: { ...f.dati, [k]: v } })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.denominazione.trim() || !form.tipo || !form.categoria.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        responsabile: form.responsabile || null,
        dati: {
          ...form.dati,
          valoreContabile: form.dati.valoreContabile !== "" ? Number(form.dati.valoreContabile) : null,
        },
      };
      Object.keys(payload.dati).forEach((k) => {
        if (payload.dati[k] === "" || payload.dati[k] === null) delete payload.dati[k];
      });
      let saved;
      if (isNew) {
        saved = await api.creaBene(payload, me);
      } else {
        saved = await api.aggiornaBene(bene.id, payload, me);
      }
      onSave(saved);
    } catch (err) {
      alert(err.message || "Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const users = Object.entries(M.users || {}).filter(([id]) => id !== "ai");

  const fld = (label, content) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {content}
    </div>
  );

  const inp = (props) => (
    <input className="inp" {...props} style={{ width: "100%", boxSizing: "border-box", ...props.style }} />
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", background: "rgba(0,0,0,.45)", overflowY: "auto" }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--surface)", borderRadius: 12, width: "100%", maxWidth: 660, boxShadow: "0 8px 32px #0004", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 24px 14px", borderBottom: "1px solid var(--border)" }}>
          <Icon name={isNew ? "plus" : "edit"} size={18} stroke={2} style={{ color: "var(--blu)" }} />
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{isNew ? "Nuovo bene" : `Modifica — ${bene.denominazione}`}</h2>
          <button className="iconbtn" style={{ marginLeft: "auto" }} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <form onSubmit={submit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {fld("Tipo *", (
              <select className="inp" value={form.tipo} onChange={(e) => set("tipo", e.target.value)} required>
                {TIPI.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            ))}
            {fld("Categoria *", inp({ value: form.categoria, onChange: (e) => set("categoria", e.target.value), required: true, placeholder: "es. Edificio scolastico" }))}
          </div>

          {fld("Denominazione *", inp({ value: form.denominazione, onChange: (e) => set("denominazione", e.target.value), required: true, placeholder: "es. Scuola elementare G. Mazzini" }))}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {fld("Ubicazione", inp({ value: form.ubicazione, onChange: (e) => set("ubicazione", e.target.value), placeholder: "Via, numero civico" }))}
            {fld("Codice inventariale", inp({ value: form.codice, onChange: (e) => set("codice", e.target.value), placeholder: "es. IMM/2024/001" }))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {fld("Stato", (
              <select className="inp" value={form.stato} onChange={(e) => set("stato", e.target.value)}>
                {STATI.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            ))}
            {fld("Responsabile", (
              <select className="inp" value={form.responsabile} onChange={(e) => set("responsabile", e.target.value)}>
                <option value="">— nessuno —</option>
                {users.map(([id, u]) => <option key={id} value={id}>{u.nome}</option>)}
              </select>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Dati aggiuntivi</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {fld("Valore contabile (€)", inp({ type: "number", min: 0, step: "0.01", value: form.dati.valoreContabile, onChange: (e) => setDati("valoreContabile", e.target.value), placeholder: "0.00" }))}
              {fld("Anno acquisizione", inp({ value: form.dati.annoAcquisizione, onChange: (e) => setDati("annoAcquisizione", e.target.value), placeholder: "es. 2010" }))}
              {form.tipo === "mobile" && fld("Targa", inp({ value: form.dati.targa, onChange: (e) => setDati("targa", e.target.value), placeholder: "es. AB123CD", style: { fontFamily: "monospace" } }))}
              {form.tipo === "immobile" && fld("Foglio catastale", inp({ value: form.dati.foglio, onChange: (e) => setDati("foglio", e.target.value), placeholder: "es. 12" }))}
              {form.tipo === "immobile" && fld("Particella", inp({ value: form.dati.particella, onChange: (e) => setDati("particella", e.target.value), placeholder: "es. 345" }))}
              {fld("Ultima verifica", inp({ type: "date", value: form.dati.ultimaVerifica, onChange: (e) => setDati("ultimaVerifica", e.target.value) }))}
              {fld("Scadenza collaudo", inp({ type: "date", value: form.dati.scadenzaCollaudo, onChange: (e) => setDati("scadenzaCollaudo", e.target.value) }))}
            </div>
          </div>

          {fld("Note", (
            <textarea className="inp" rows={3} value={form.dati.note} onChange={(e) => setDati("note", e.target.value)}
              style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }} placeholder="Informazioni aggiuntive…" />
          ))}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Annulla</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              <Icon name={saving ? "loader" : "save"} size={15} stroke={2} />
              {saving ? "Salvataggio…" : isNew ? "Crea bene" : "Salva modifiche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inventario({ M, me, toast, tick, refresh }) {
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [tipo, setTipo] = useState("tutti");
  const [vista, setVista] = useState("lista");
  const [importing, setImporting] = useState(false);
  const [esitoImport, setEsitoImport] = useState(null);
  const [formBene, setFormBene] = useState(null); // null=chiuso, {}=nuovo, bene=modifica
  const [delId, setDelId] = useState(null); // id del bene da eliminare
  const [deleting, setDeleting] = useState(false);
  const leafletLoaded = true;
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

  function onFormSave(saved) {
    const isNew = !list.find((b) => b.id === saved.id);
    if (isNew) {
      setList((prev) => [saved, ...prev]);
    } else {
      setList((prev) => prev.map((b) => b.id === saved.id ? saved : b));
    }
    setSel(saved);
    setFormBene(null);
    toast(isNew ? "Bene creato" : "Bene aggiornato", "success");
    refresh && refresh();
  }

  async function onElimina() {
    if (!delId) return;
    setDeleting(true);
    try {
      await api.eliminaBene(delId, me);
      const next = list.filter((b) => b.id !== delId);
      setList(next);
      setSel(next[0] || null);
      setDelId(null);
      toast("Bene eliminato", "success");
      refresh && refresh();
    } catch (err) {
      toast(err.message || "Errore eliminazione", "");
    } finally {
      setDeleting(false);
    }
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
              <button className="btn btn--ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
                <Icon name="upload" size={15} stroke={2} />{importing ? "Importazione…" : "Importa CSV"}
              </button>
              <button className="btn btn--primary" onClick={() => setFormBene({})}>
                <Icon name="plus" size={15} stroke={2.5} />Nuovo bene
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
            {sel && <SchedaBene sel={sel} M={M} canAdmin={canAdmin}
              onModifica={() => setFormBene(sel)} onElimina={() => setDelId(sel.id)} />}
          </div>
        </div>
      ) : (
        <div className="split">
          <div className="card"><div className="card__body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {shown.length === 0 && (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-muted)" }}>
                <Icon name="box" size={32} stroke={1.5} />
                <p style={{ marginTop: 8 }}>Nessun bene in inventario.{canAdmin && " Usa «Nuovo bene» o importa un CSV."}</p>
              </div>
            )}
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
            {sel && <SchedaBene sel={sel} M={M} canAdmin={canAdmin}
              onModifica={() => setFormBene(sel)} onElimina={() => setDelId(sel.id)} />}
          </div>
        </div>
      )}

      {formBene !== null && (
        <BeneForm bene={formBene?.id ? formBene : null} M={M} me={me}
          onSave={onFormSave} onClose={() => setFormBene(null)} />
      )}

      {delId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.45)" }}
             onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDelId(null); }}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: "28px 32px", maxWidth: 420, width: "90%", boxShadow: "0 8px 32px #0004" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <Icon name="alertCircle" size={22} stroke={2} style={{ color: "var(--rosso)", flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: 16 }}>Elimina bene</h3>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-muted)" }}>
              Sei sicuro di voler eliminare <b>{list.find((b) => b.id === delId)?.denominazione}</b>?<br />
              L'operazione è irreversibile.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn--ghost" onClick={() => setDelId(null)} disabled={deleting}>Annulla</button>
              <button className="btn btn--danger" onClick={onElimina} disabled={deleting}>
                <Icon name={deleting ? "loader" : "trash"} size={15} stroke={2} />
                {deleting ? "Eliminazione…" : "Elimina"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SchedaBene({ sel, M, canAdmin, onModifica, onElimina }) {
  return (
    <div className="card">
      <div className="card__head">
        <Icon name={TIPO_ICO[sel.tipo] || "box"} size={18} stroke={2} style={{ color: "var(--blu)" }} />
        <h3>Scheda bene</h3>
        {canAdmin && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button className="btn btn--ghost btn--sm" onClick={onModifica} title="Modifica">
              <Icon name="edit" size={14} stroke={2} />Modifica
            </button>
            <button className="btn btn--ghost btn--sm" onClick={onElimina} title="Elimina"
              style={{ color: "var(--rosso)" }}>
              <Icon name="trash" size={14} stroke={2} />
            </button>
          </div>
        )}
      </div>
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
