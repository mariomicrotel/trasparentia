import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Avatar } from "../ui.jsx";

const AVATAR_COLORS = ["#0066cc","#0b7d99","#6a4ec2","#1a7a45","#c2610c","#a62c2c","#555f6e","#0a6b5c"];
const PERM_LBL = {
  classifica: "Classifica", prendiCarico: "Prende in carico", assegna: "Assegna",
  lavora: "Lavora pratiche", bozze: "Bozze atti", supervisione: "Supervisione",
};

export default function Utenti({ M, me, toast, tick, nav }) {
  const canAdmin = !!(M.perm?.[me]?.supervisione);

  const [utenti, setUtenti]           = useState(null);
  const [kcAdminUrl, setKcAdminUrl]   = useState(null);
  const [ruoliDisp, setRuoliDisp]     = useState({});
  const [ufficiDisp, setUfficiDisp]   = useState([]);
  const [formOpen, setFormOpen]       = useState(false);
  const [editingUid, setEditingUid]   = useState(null);
  const [formData, setFormData]       = useState({});
  const [formBusy, setFormBusy]       = useState(false);

  const load = useCallback(() => {
    if (!canAdmin) return;
    api.getUtenti(me).then((r) => {
      setUtenti(r.utenti);
      setKcAdminUrl(r.kc_admin_url);
      if (r.ruoli) setRuoliDisp(r.ruoli);
      if (r.uffici) setUfficiDisp(r.uffici);
    }).catch(() => setUtenti([]));
  }, [me, canAdmin]);

  useEffect(() => { load(); }, [tick, load]);

  if (!canAdmin) {
    return (
      <div className="page">
        <div className="empty card" style={{ padding: "64px 24px" }}>
          <Icon name="lock" size={40} />
          <h3>Accesso riservato</h3>
          <p>La gestione utenti è disponibile solo per il Segretario Comunale.</p>
          <button className="btn btn--subtle" onClick={() => nav("cruscotto")}>
            <Icon name="grid" size={16} stroke={2} />Torna al cruscotto
          </button>
        </div>
      </div>
    );
  }

  function openCreate() {
    setEditingUid(null);
    setFormData({ id: "", nome: "", email: "", ufficio: ufficiDisp[0] || "", ruolo_kc: Object.keys(ruoliDisp)[0] || "", col: "#0066cc" });
    setFormOpen(true);
  }
  function openEdit(u) {
    setEditingUid(u.id);
    setFormData({ nome: u.nome, email: u.email || "", ufficio: u.ufficio || "", ruolo_kc: u.ruolo_kc, col: u.col || "#0066cc" });
    setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); setEditingUid(null); }

  async function submitForm() {
    setFormBusy(true);
    try {
      if (editingUid) {
        await api.aggiornaUtente(editingUid, formData, me);
        toast("Utente aggiornato", "success");
      } else {
        await api.creaUtente(formData, me);
        toast(`Utente ${formData.id} creato`, "success");
      }
      closeForm();
      load();
    } catch (e) { toast(e.message || "Errore", ""); }
    finally { setFormBusy(false); }
  }

  async function toggleSospeso(u) {
    try {
      if (u.attivo) {
        if (!window.confirm(`Sospendere l'utente ${u.nome}? Non potrà più accedere alla piattaforma.`)) return;
        await api.sospendiUtente(u.id, me);
        toast(`${u.nome} sospeso`, "");
      } else {
        await api.riattivaUtente(u.id, me);
        toast(`${u.nome} riattivato`, "success");
      }
      load();
    } catch (e) { toast(e.message || "Errore", ""); }
  }

  const lista = utenti || [];

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Gestione utenti</span></div>
          <h1>Utenti e accessi</h1>
          <p>Crea, modifica e sospendi gli utenti di piattaforma. {lista.length > 0 ? `${lista.length} utenti registrati.` : ""}</p>
        </div>
        <div className="pagehead__actions">
          {kcAdminUrl && (
            <a href={kcAdminUrl} target="_blank" rel="noopener noreferrer" className="btn btn--subtle">
              <Icon name="link" size={15} stroke={2} />Console Keycloak
            </a>
          )}
          <button className="btn btn--primary" onClick={openCreate}>
            <Icon name="plus" size={16} stroke={2} />Nuovo utente
          </button>
        </div>
      </div>

      {kcAdminUrl && (
        <div className="banner banner--info" style={{ marginBottom: 16, fontSize: 13 }}>
          <Icon name="info" size={16} stroke={2} />
          <span>Con Keycloak attivo, crea anche l'utente nella <b>Console Keycloak</b> e assegnagli il ruolo corrispondente (<code>operatore_protocollo</code>, <code>responsabile_ut</code>, <code>istruttore</code>, <code>segretario</code>).</span>
        </div>
      )}

      {/* ── Form creazione / modifica ────────────────────────────────── */}
      {formOpen && (
        <div className="card" style={{ marginBottom: 16, border: "1.5px solid var(--blu)" }}>
          <div className="card__head">
            <Icon name={editingUid ? "edit" : "userPlus"} size={17} stroke={2} style={{ color: "var(--blu)" }} />
            <h3 style={{ flex: 1, color: "var(--blu)" }}>
              {editingUid ? `Modifica — ${editingUid}` : "Nuovo utente"}
            </h3>
          </div>
          <div className="card__body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
              {!editingUid && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Username *</label>
                  <input
                    type="text" placeholder="es. mario.rossi"
                    value={formData.id || ""}
                    onChange={(e) => setFormData((f) => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g, "_") }))}
                    style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}
                  />
                </div>
              )}
              {[
                { key: "nome",  label: "Nome completo *", type: "text",  ph: "es. Mario Rossi" },
                { key: "email", label: "Email",           type: "email", ph: "utente@comune.it" },
              ].map(({ key, label, type, ph }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
                  <input type={type} placeholder={ph} value={formData[key] || ""}
                    onChange={(e) => setFormData((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}
                  />
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ufficio</label>
                <select value={formData.ufficio || ""} onChange={(e) => setFormData((f) => ({ ...f, ufficio: e.target.value }))}
                  style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}>
                  <option value="">— Seleziona —</option>
                  {ufficiDisp.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ruolo *</label>
                <select value={formData.ruolo_kc || ""} onChange={(e) => setFormData((f) => ({ ...f, ruolo_kc: e.target.value }))}
                  style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}>
                  {Object.entries(ruoliDisp).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Colore avatar</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {AVATAR_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setFormData((f) => ({ ...f, col: c }))}
                      style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                               outline: formData.col === c ? "3px solid var(--text)" : "2px solid transparent", outlineOffset: 2 }} />
                  ))}
                  <span className="avatar" style={{ width: 28, height: 28, background: formData.col || "#0066cc", fontSize: 11, marginLeft: 4 }}>
                    {(formData.nome || "").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?"}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--primary" onClick={submitForm} disabled={formBusy}>
                <Icon name="save" size={15} stroke={2} />{formBusy ? "Salvataggio…" : editingUid ? "Salva modifiche" : "Crea utente"}
              </button>
              <button className="btn btn--subtle" onClick={closeForm} disabled={formBusy}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lista utenti ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="card__body">
          {utenti === null && <div className="muted" style={{ padding: 16 }}>Caricamento…</div>}
          {lista.length === 0 && utenti !== null && (
            <div className="muted" style={{ padding: 16 }}>Nessun utente ancora registrato. Usa «Nuovo utente» per aggiungere il primo.</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lista.map((u) => {
              const permList = Object.entries(M.perm?.[u.id] || {}).filter(([, v]) => v).map(([k]) => PERM_LBL[k] || k);
              return (
                <div key={u.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  borderRadius: 8, border: "1px solid var(--border)",
                  background: u.attivo === false ? "var(--surface)" : "var(--surface-2)",
                  opacity: u.attivo === false ? 0.65 : 1,
                }}>
                  <Avatar user={u} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      {u.nome}
                      <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", fontFamily: "monospace" }}>@{u.id}</span>
                      {u.attivo === false && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: "var(--rosso-bg, #fff0f1)", color: "var(--rosso)" }}>SOSPESO</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                      {u.ruolo}{u.ufficio ? ` · ${u.ufficio}` : ""}
                      {u.email ? <span style={{ marginLeft: 10, opacity: 0.7 }}>{u.email}</span> : null}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                      {permList.map((p) => (
                        <span key={p} style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 4, background: "var(--blu-bg, #e8f0fb)", color: "var(--blu)" }}>{p}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="btn btn--subtle btn--sm" onClick={() => openEdit(u)} title="Modifica utente">
                      <Icon name="edit" size={13} stroke={2} />Modifica
                    </button>
                    <button
                      className="btn btn--subtle btn--sm"
                      style={{ borderColor: u.attivo === false ? "var(--verde)" : "var(--rosso)", color: u.attivo === false ? "var(--verde)" : "var(--rosso)" }}
                      onClick={() => toggleSospeso(u)}
                      disabled={u.id === me && u.attivo !== false}
                      title={u.attivo === false ? "Riattiva accesso" : "Sospendi accesso"}
                    >
                      <Icon name={u.attivo === false ? "play" : "pause"} size={13} stroke={2} />
                      {u.attivo === false ? "Riattiva" : "Sospendi"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card__body">
          <div className="banner banner--verde" style={{ fontSize: 12.5 }}>
            <Icon name="lock" size={16} />
            <div>
              Le credenziali di accesso sono gestite da <b>Keycloak</b> (in produzione) o dal role-switch demo.
              Aggiungere un utente qui crea il profilo di piattaforma; assegnare il ruolo Keycloak è un passaggio separato nella <b>Console Keycloak</b>.
              {" "}<button className="btn btn--subtle btn--sm" style={{ marginLeft: 8 }} onClick={() => nav("config")}>
                <Icon name="settings" size={13} stroke={2} />Vai a Configurazione
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
