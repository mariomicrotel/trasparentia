import React, { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Avatar } from "../ui.jsx";

function StatoDot({ stato }) {
  const col = stato.ok === true ? "var(--verde)" : stato.ok === false ? "var(--rosso)" : "var(--text-faint)";
  const lbl = stato.ok === true ? "Operativo" : stato.ok === false ? "Non raggiungibile" : "Disabilitato";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: col, whiteSpace: "nowrap" }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: col, flexShrink: 0 }} />
      {lbl}
    </span>
  );
}

function CampoInput({ campo, value, onChange, showPass, onTogglePass }) {
  const { label, tipo } = campo;

  if (tipo === "bool") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, userSelect: "none" }}>
        <input
          type="checkbox"
          checked={String(value).toLowerCase() === "true" || value === true}
          onChange={e => onChange(e.target.checked ? "true" : "false")}
          style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--blu)" }}
        />
        {label}
      </label>
    );
  }

  const isPass = tipo === "password";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type={isPass && !showPass ? "password" : tipo === "number" ? "number" : "text"}
          placeholder={isPass ? "••••••• (invariato)" : ""}
          value={value ?? ""}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}
        />
        {isPass && (
          <button type="button" className="btn btn--subtle btn--sm" onClick={onTogglePass} title={showPass ? "Nascondi" : "Mostra"}>
            <Icon name={showPass ? "eyeOff" : "eye"} size={14} stroke={2} />
          </button>
        )}
      </div>
    </div>
  );
}

function ServizioCard({ s, campi, canAdmin, onTest, onSalva, testing, saving }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [showPass, setShowPass] = useState({});

  const boolCampi = campi.filter(c => c.tipo === "bool");
  const otherCampi = campi.filter(c => c.tipo !== "bool");
  const needsRestart = editing && campi.some(c => c.riavvio);

  function startEdit() {
    const init = {};
    campi.forEach(c => { init[c.key] = c.tipo === "password" ? "" : (c.valore ?? ""); });
    setForm(init);
    setShowPass({});
    setEditing(true);
  }

  function handleSalva() {
    onSalva(form, () => setEditing(false));
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function togglePass(key) {
    setShowPass(p => ({ ...p, [key]: !p[key] }));
  }

  return (
    <div className="card">
      <div className="card__head" style={{ alignItems: "center" }}>
        <Icon name={s.ico} size={18} stroke={2} style={{ color: "var(--blu)" }} />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>
            {s.nome}
            {s.critico && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--rosso)", fontWeight: 700 }}>CRITICO</span>}
          </h3>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.ruolo}</div>
        </div>
        <StatoDot stato={s.stato} />
      </div>

      <div className="card__body">
        {/* stato dettaglio */}
        <div style={{
          fontSize: 12.5, padding: "8px 10px", borderRadius: 6, marginBottom: 12,
          background: s.stato.ok === false ? "var(--rosso-bg)" : "var(--surface-2)",
          color: s.stato.ok === false ? "var(--rosso)" : "var(--text)",
        }}>
          {s.stato.detail}
        </div>

        {!editing ? (
          /* vista sola lettura — valori mascherati da backend */
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 14px", fontSize: 12.5, marginBottom: 14 }}>
            {Object.entries(s.config).map(([k, v]) => (
              <React.Fragment key={k}>
                <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>{k}</span>
                <span style={{ fontWeight: 600, wordBreak: "break-all" }}>{String(v)}</span>
              </React.Fragment>
            ))}
          </div>
        ) : (
          /* form di modifica */
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {otherCampi.map(campo => (
              <CampoInput
                key={campo.key}
                campo={campo}
                value={form[campo.key]}
                onChange={v => setField(campo.key, v)}
                showPass={!!showPass[campo.key]}
                onTogglePass={() => togglePass(campo.key)}
              />
            ))}
            {boolCampi.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, borderTop: "1px solid var(--surface-2)" }}>
                {boolCampi.map(campo => (
                  <CampoInput
                    key={campo.key}
                    campo={campo}
                    value={form[campo.key]}
                    onChange={v => setField(campo.key, v)}
                  />
                ))}
              </div>
            )}
            {needsRestart && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", borderRadius: 6, background: "var(--arancio-bg, #fff3cd)", color: "var(--arancio, #856404)", fontSize: 12.5 }}>
                <Icon name="alertTriangle" size={14} stroke={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Alcune impostazioni richiedono il riavvio del backend per avere effetto.</span>
              </div>
            )}
          </div>
        )}

        {/* log test — appare solo dopo "Prova connessione" se il backend restituisce log[] */}
        {s.stato?.log?.length > 0 && (
          <div style={{ marginTop: 4, marginBottom: 12, borderRadius: 6, overflow: "hidden",
                        border: "1px solid #2a2a3e", fontFamily: "monospace" }}>
            <div style={{ padding: "5px 10px", background: "#12122a",
                          color: "#7070a0", fontSize: 11, fontWeight: 700,
                          letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Log verifica
            </div>
            {s.stato.log.map((entry, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "6px 10px", background: i % 2 === 0 ? "#0e0e24" : "#0b0b1e",
                borderTop: i > 0 ? "1px solid #1e1e38" : "none",
              }}>
                <span style={{ flexShrink: 0, fontWeight: 700, fontSize: 13,
                               color: entry.ok ? "#4ade80" : "#f87171", marginTop: 1 }}>
                  {entry.ok ? "✓" : "✗"}
                </span>
                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.5,
                               color: entry.ok ? "#d0d0f0" : "#f87171",
                               wordBreak: "break-word" }}>
                  <span style={{ color: "#8080c0", marginRight: 6, textTransform: "uppercase",
                                 fontSize: 10, fontWeight: 700 }}>[{entry.step}]</span>
                  {entry.msg}
                  {entry.ms != null && (
                    <span style={{ marginLeft: 8, color: "#505080", fontSize: 11 }}>
                      {entry.ms} ms
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* pulsanti */}
        <div style={{ display: "flex", gap: 8 }}>
          {!editing ? (
            <>
              <button className="btn btn--subtle btn--sm" onClick={() => onTest(s.key)} disabled={testing || saving}>
                <Icon name="refresh" size={14} stroke={2} />
                {testing ? "Verifica in corso…" : "Prova connessione"}
              </button>
              {canAdmin && campi.length > 0 && (
                <button className="btn btn--subtle btn--sm" onClick={startEdit} disabled={testing}>
                  <Icon name="edit" size={14} stroke={2} />Modifica
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn btn--primary btn--sm" onClick={handleSalva} disabled={saving}>
                <Icon name="save" size={14} stroke={2} />
                {saving ? "Salvataggio…" : "Salva"}
              </button>
              <button className="btn btn--subtle btn--sm" onClick={() => setEditing(false)} disabled={saving}>
                Annulla
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const CHECKLIST_ITEMS = [
  { key: "db",       label: "Database PostgreSQL",     required: true,  desc: "Archiviazione pratiche, atti e comunicazioni" },
  { key: "minio",    label: "Storage documenti (MinIO)",required: true,  desc: "Archivio file PEC e allegati" },
  { key: "ai",       label: "Server AI (Ollama)",       required: true,  desc: "Classificazione, sintesi, bozze" },
  { key: "imap",     label: "Casella PEC (IMAP)",       required: false, desc: "Ricezione PEC automatica" },
  { key: "smtp",     label: "Posta in uscita (SMTP)",   required: false, desc: "Notifiche email e invio risposte" },
  { key: "keycloak", label: "Keycloak (autenticazione)",required: false, desc: "Accesso sicuro con SSO / SPID" },
];

function ChecklistAvvio({ servizi, nav }) {
  const lookup = Object.fromEntries((servizi || []).map(s => [s.key, s.stato]));
  const items = CHECKLIST_ITEMS.map(c => ({
    ...c, stato: lookup[c.key],
    ok: lookup[c.key]?.ok === true,
    disabled: lookup[c.key]?.ok === null || lookup[c.key]?.ok === undefined,
  }));
  const obbligatori = items.filter(c => c.required);
  const pronti = obbligatori.filter(c => c.ok).length;
  const pct = Math.round((pronti / obbligatori.length) * 100);
  const goLiveReady = pronti === obbligatori.length;

  return (
    <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${goLiveReady ? "var(--verde)" : "var(--blu)"}` }}>
      <div className="card__head">
        <Icon name={goLiveReady ? "checkCircle" : "sparkles"} size={18} stroke={2} style={{ color: goLiveReady ? "var(--verde)" : "var(--blu)" }} />
        <h3 style={{ flex: 1 }}>Checklist avvio operativo</h3>
        <span style={{ fontSize: 13, fontWeight: 700, color: goLiveReady ? "var(--verde)" : "var(--blu)" }}>
          {pct}% pronto
        </span>
      </div>
      <div className="card__body">
        {/* barra progresso */}
        <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)", marginBottom: 14, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: goLiveReady ? "var(--verde)" : "var(--blu)", borderRadius: 3, transition: "width 0.4s" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
          {items.map(c => {
            const col = c.ok ? "var(--verde)" : c.required ? "var(--rosso)" : "var(--text-muted)";
            const ico = c.ok ? "checkCircle" : c.disabled ? "minus" : "alertTriangle";
            return (
              <div key={c.key} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "9px 12px", borderRadius: 8,
                background: c.ok ? "var(--verde-bg, #f0faf4)" : c.required && !c.ok && !c.disabled ? "var(--rosso-bg, #fff0f1)" : "var(--surface-2)",
                border: `1px solid ${c.ok ? "var(--verde)" : c.required && !c.ok && !c.disabled ? "var(--rosso)" : "var(--border)"}`,
              }}>
                <Icon name={ico} size={16} stroke={2} style={{ color: col, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {c.label}
                    {c.required && <span style={{ marginLeft: 4, fontSize: 10, color: "var(--text-muted)" }}>obbligatorio</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>{c.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {goLiveReady && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "var(--verde-bg, #f0faf4)", color: "var(--verde)", fontWeight: 600, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
            <Icon name="checkCircle" size={16} stroke={2} />
            Tutti i servizi obbligatori sono operativi. Il sistema è pronto per l'avvio operativo.
          </div>
        )}
        {!goLiveReady && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--text-muted)" }}>
            Configura i servizi obbligatori mancanti per completare l'avvio. I servizi facoltativi (PEC, SMTP, Keycloak) possono essere aggiunti successivamente.
          </div>
        )}
      </div>
    </div>
  );
}

export default function Configurazione({ M, me, toast, tick, nav }) {
  const [data, setData] = useState(null);
  const [campiPerServizio, setCampiPerServizio] = useState({});
  const [testing, setTesting] = useState("");
  const [saving, setSaving] = useState("");
  const [backups, setBackups] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [smtpTo, setSmtpTo] = useState("");
  const [smtpBusy, setSmtpBusy] = useState(false);
  const [utenti, setUtenti] = useState(null);
  const [kcAdminUrl, setKcAdminUrl] = useState(null);
  const [ruoliDisp, setRuoliDisp] = useState({});
  const [ufficiDisp, setUfficiDisp] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUid, setEditingUid] = useState(null);
  const [formData, setFormData] = useState({});
  const [formBusy, setFormBusy] = useState(false);

  const canAdmin = !!(M.perm?.[me]?.supervisione);

  const load = useCallback(() =>
    api.diagnostica(me).then(setData).catch(() => setData(false)),
    [me]
  );

  const loadCampi = useCallback(() =>
    api.leggiImpostazioni(me).then(r => setCampiPerServizio(r.servizi || {})).catch(() => {}),
    [me]
  );

  const loadBackups = useCallback(() => {
    if (canAdmin) api.listBackup(me).then(r => setBackups(r.backup)).catch(() => setBackups([]));
  }, [me, canAdmin]);

  const loadUtenti = useCallback(() => {
    if (canAdmin) api.getUtenti(me).then(r => {
      setUtenti(r.utenti);
      setKcAdminUrl(r.kc_admin_url);
      if (r.ruoli) setRuoliDisp(r.ruoli);
      if (r.uffici) setUfficiDisp(r.uffici);
    }).catch(() => {});
  }, [me, canAdmin]);

  useEffect(() => { load(); loadCampi(); loadBackups(); loadUtenti(); }, [tick, me]); // eslint-disable-line

  async function testOne(key) {
    setTesting(key);
    try {
      const res = await api.testServizio(key, me);
      setData(d => d && ({
        ...d,
        servizi: d.servizi.map(s => s.key === key ? { ...s, stato: res } : s),
      }));
      toast(res.ok === true ? "Connessione OK" : res.ok === false ? "Connessione fallita" : "Servizio disabilitato",
            res.ok === true ? "success" : "");
    } catch {
      toast("Errore nel test", "");
    } finally {
      setTesting("");
    }
  }

  async function salvaServizio(srvKey, form, onDone) {
    setSaving(srvKey);
    try {
      const res = await api.salvaImpostazioni(form, me);
      if (res.cambiati?.length > 0) {
        toast(`Salvato${res.riavvio_necessario ? " · riavvio richiesto per alcune impostazioni" : ""}`, "success");
      } else {
        toast("Nessuna modifica applicata", "");
      }
      onDone();
      await load();
      await loadCampi();
    } catch (e) {
      toast(e.message || "Errore nel salvataggio", "");
    } finally {
      setSaving("");
    }
  }

  async function eseguiBackup() {
    setBackupBusy(true);
    try {
      const res = await api.creaBackup(me);
      toast(`Backup creato: ${res.file}`, "success");
      loadBackups();
    } catch (e) {
      toast(e.message || "Backup fallito", "");
    } finally {
      setBackupBusy(false);
    }
  }

  async function provaSmtp() {
    setSmtpBusy(true);
    try {
      const res = await api.provaSmtp({ to: smtpTo }, me);
      toast(res.ok ? `Email inviata: ${res.detail}` : `SMTP: ${res.detail}`, res.ok ? "success" : "");
    } catch (e) {
      toast(e.message || "Errore SMTP", "");
    } finally {
      setSmtpBusy(false);
    }
  }

  if (data === null) return <div className="page"><p>Caricamento…</p></div>;
  if (data === false) return (
    <div className="page">
      <div className="empty card">
        <Icon name="settings" size={40} />
        <h3>Diagnostica non disponibile</h3>
        <p>Il backend non espone ancora questo endpoint. Ricostruisci il servizio backend.</p>
      </div>
    </div>
  );

  const operativi = data.servizi.filter(s => s.stato.ok === true).length;
  const problemi = data.servizi.filter(s => s.stato.ok === false).length;

  function fmtSize(b) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>Configurazione</span></div>
          <h1>Configurazione & diagnostica</h1>
          <p>Stato dei servizi on-prem. {operativi} operativi{problemi > 0 ? `, ${problemi} con problemi` : ""}. Le password sono sempre mascherate.{canAdmin ? " Clicca «Modifica» su una card per aggiornare le impostazioni." : ""}</p>
        </div>
        <div className="pagehead__actions">
          <button className="btn btn--subtle" onClick={() => { load(); loadCampi(); loadBackups(); }}>
            <Icon name="refresh" size={16} stroke={2} />Aggiorna tutto
          </button>
        </div>
      </div>

      {canAdmin && <ChecklistAvvio servizi={data.servizi} nav={nav} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
        {data.servizi.map(s => (
          <ServizioCard
            key={s.key}
            s={s}
            campi={campiPerServizio[s.key] || []}
            canAdmin={canAdmin}
            onTest={testOne}
            onSalva={(form, done) => salvaServizio(s.key, form, done)}
            testing={testing === s.key}
            saving={saving === s.key}
          />
        ))}
      </div>

      {canAdmin && (
        <div className="split" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card__head">
              <Icon name="send" size={18} stroke={2} style={{ color: "var(--blu)" }} />
              <h3>Prova posta in uscita</h3>
            </div>
            <div className="card__body">
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
                Invia un'email di prova per verificare la configurazione SMTP/PEC. Lascia vuoto per usare la tua email.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  placeholder={M.users[me]?.email || "destinatario@esempio.it"}
                  value={smtpTo}
                  onChange={e => setSmtpTo(e.target.value)}
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}
                />
                <button className="btn btn--primary" onClick={provaSmtp} disabled={smtpBusy}>
                  <Icon name="send" size={15} stroke={2} />{smtpBusy ? "Invio…" : "Invia prova"}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card__head">
              <Icon name="download" size={18} stroke={2} style={{ color: "var(--verde)" }} />
              <h3 style={{ flex: 1 }}>Backup database</h3>
              <button className="btn btn--primary btn--sm" onClick={eseguiBackup} disabled={backupBusy}>
                <Icon name="save" size={14} stroke={2} />{backupBusy ? "Backup…" : "Esegui backup"}
              </button>
            </div>
            <div className="card__body" style={{ maxHeight: 240, overflowY: "auto" }}>
              {backups === null && <div className="muted">Caricamento…</div>}
              {backups && backups.length === 0 && <div className="muted">Nessun backup presente. Esegui il primo backup.</div>}
              {backups && backups.map(b => (
                <div key={b.file} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 4px", borderBottom: "1px solid var(--surface-2)", fontSize: 13 }}>
                  <Icon name="archive" size={15} stroke={2} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{b.file}</span>
                  <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtSize(b.size)}</span>
                  <button
                    className="btn btn--subtle btn--sm"
                    style={{ borderColor: "var(--rosso)", color: "var(--rosso)", flexShrink: 0 }}
                    onClick={() => {
                      if (!window.confirm(`ATTENZIONE: il ripristino sovrascrive il database corrente.\nFile: ${b.file}\n\nContinuare?`)) return;
                      api.ripristinaBackup(b.file, me)
                        .then(r => toast(r.detail || "Ripristino completato", "success"))
                        .catch(e => toast(e.message || "Ripristino fallito", ""));
                    }}
                  >
                    <Icon name="refresh" size={12} stroke={2} />Ripristina
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Integrazione sistemi documentali esterni */}
      {canAdmin && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card__head">
            <Icon name="link" size={18} stroke={2} style={{ color: "var(--blu)" }} />
            <h3 style={{ flex: 1 }}>Integrazione sistemi documentali comunali</h3>
          </div>
          <div className="card__body">
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 14px" }}>
              TrasParentIA si integra con il software documentale già in uso (Halley, Maggioli, PA Digitale, Protocomm…) per la registrazione del protocollo e la pubblicazione all'Albo Pretorio.
              Se non configurato, usa numerazione interna provvisoria. Impostare <code>ALBO_ESTERNO_URL</code> e <code>PROTOCOLLO_ESTERNO_URL</code> nel file <code>.env</code>.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { tipo: "albo", lbl: "Albo Pretorio esterno", desc: "Pubblicazione automatica atti firmati" },
                { tipo: "protocollo", lbl: "Protocollo informatico esterno", desc: "Numerazione DPR 445/2000 dal sistema ufficiale" },
              ].map(({ tipo, lbl, desc }) => (
                <div key={tipo} className="card" style={{ flex: "1 1 260px", border: "1px solid var(--border)" }}>
                  <div className="card__head" style={{ paddingBottom: 6 }}>
                    <Icon name={tipo === "albo" ? "book" : "list"} size={16} stroke={2} style={{ color: "var(--blu)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{lbl}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
                    </div>
                  </div>
                  <div className="card__body" style={{ paddingTop: 6 }}>
                    <button
                      className="btn btn--subtle btn--sm"
                      onClick={() =>
                        api.testIntegrazione(tipo, me)
                          .then(r => toast(r.ok ? `✓ ${r.detail}` : `✗ ${r.detail}`, r.ok ? "success" : ""))
                          .catch(e => toast(e.message, ""))
                      }
                    >
                      <Icon name="zap" size={13} stroke={2} />Testa connessione
                    </button>
                    {tipo === "albo" && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                        La pubblicazione avviene automaticamente quando un atto passa a stato «Pubblicato».
                      </div>
                    )}
                    {tipo === "protocollo" && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                        Il numero viene richiesto al sistema esterno alla presa in carico. Fallback: numerazione interna provvisoria.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sezione Utenti & accessi — visibile solo all'admin */}
      {/* Sezione utenti spostata nella pagina dedicata Utenti.jsx — nav item "Gestione utenti" */}
      {canAdmin && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card__head">
            <Icon name="users" size={18} stroke={2} style={{ color: "var(--blu)" }} />
            <h3 style={{ flex: 1 }}>Utenti e accessi</h3>
            <button className="btn btn--primary btn--sm" onClick={() => nav("utenti")}>
              <Icon name="users" size={14} stroke={2} />Gestisci utenti
            </button>
          </div>
          <div className="card__body">
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              Crea, modifica e sospendi gli accessi degli operatori di piattaforma.
            </p>
          </div>
        </div>
      )}
      {false && canAdmin && (() => {
        const AVATAR_COLORS = ["#0066cc","#0b7d99","#6a4ec2","#1a7a45","#c2610c","#a62c2c","#555f6e","#0a6b5c"];
        const PERM_LBL = { classifica:"Classifica", prendiCarico:"Prende in carico", assegna:"Assegna", lavora:"Lavora pratiche", bozze:"Bozze atti", supervisione:"Supervisione" };

        function openCreate() {
          setEditingUid(null);
          setFormData({ id:"", nome:"", email:"", ufficio: ufficiDisp[0] || "", ruolo_kc: Object.keys(ruoliDisp)[0] || "", col:"#0066cc" });
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
            loadUtenti();
          } catch(e) { toast(e.message || "Errore", ""); }
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
            loadUtenti();
          } catch(e) { toast(e.message || "Errore", ""); }
        }

        const lista = utenti || [];

        return (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card__head">
              <Icon name="users" size={18} stroke={2} style={{ color: "var(--blu)" }} />
              <h3 style={{ flex: 1 }}>Utenti e accessi</h3>
              {kcAdminUrl && (
                <a href={kcAdminUrl} target="_blank" rel="noopener noreferrer" className="btn btn--subtle btn--sm">
                  <Icon name="link" size={13} stroke={2} />Console Keycloak
                </a>
              )}
              <button className="btn btn--primary btn--sm" onClick={openCreate}>
                <Icon name="plus" size={14} stroke={2} />Nuovo utente
              </button>
            </div>

            <div className="card__body">
              {kcAdminUrl && (
                <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 6, background: "var(--surface-2)", fontSize: 12.5, color: "var(--text-muted)" }}>
                  <Icon name="info" size={13} stroke={2} style={{ verticalAlign: "middle", marginRight: 6, color: "var(--blu)" }} />
                  Con Keycloak attivo, crea anche l'utente nella <b>Console Keycloak</b> e assegnagli il ruolo corrispondente (<code>operatore_protocollo</code>, <code>responsabile_ut</code>, <code>istruttore</code>, <code>segretario</code>).
                </div>
              )}

              {/* ── Form creazione / modifica ── */}
              {formOpen && (
                <div style={{ marginBottom: 16, padding: "16px", borderRadius: 10, background: "var(--surface-2)", border: "1.5px solid var(--blu)" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--blu)" }}>
                    <Icon name={editingUid ? "edit" : "plus"} size={15} stroke={2} style={{ verticalAlign: "middle", marginRight: 6 }} />
                    {editingUid ? `Modifica — ${editingUid}` : "Nuovo utente"}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
                    {!editingUid && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Username *</label>
                        <input
                          type="text" placeholder="es. mario.rossi"
                          value={formData.id || ""}
                          onChange={e => setFormData(f => ({ ...f, id: e.target.value.toLowerCase().replace(/\s/g,"_") }))}
                          style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}
                        />
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Nome completo *</label>
                      <input
                        type="text" placeholder="es. Mario Rossi"
                        value={formData.nome || ""}
                        onChange={e => setFormData(f => ({ ...f, nome: e.target.value }))}
                        style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Email</label>
                      <input
                        type="email" placeholder="utente@comune.it"
                        value={formData.email || ""}
                        onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                        style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ufficio</label>
                      <select
                        value={formData.ufficio || ""}
                        onChange={e => setFormData(f => ({ ...f, ufficio: e.target.value }))}
                        style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}
                      >
                        <option value="">— Seleziona —</option>
                        {ufficiDisp.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ruolo *</label>
                      <select
                        value={formData.ruolo_kc || ""}
                        onChange={e => setFormData(f => ({ ...f, ruolo_kc: e.target.value }))}
                        style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "var(--surface)", color: "var(--text)" }}
                      >
                        {Object.entries(ruoliDisp).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Colore avatar</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {AVATAR_COLORS.map(c => (
                          <button
                            key={c} type="button"
                            onClick={() => setFormData(f => ({ ...f, col: c }))}
                            style={{
                              width: 26, height: 26, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                              outline: formData.col === c ? "3px solid var(--text)" : "2px solid transparent",
                              outlineOffset: 2,
                            }}
                            title={c}
                          />
                        ))}
                        {/* anteprima iniziali */}
                        <span className="avatar" style={{ width: 26, height: 26, background: formData.col || "#0066cc", fontSize: 10, marginLeft: 6 }}>
                          {(formData.nome || "").split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2) || "?"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn--primary btn--sm" onClick={submitForm} disabled={formBusy}>
                      <Icon name="save" size={14} stroke={2} />{formBusy ? "Salvataggio…" : editingUid ? "Salva modifiche" : "Crea utente"}
                    </button>
                    <button className="btn btn--subtle btn--sm" onClick={closeForm} disabled={formBusy}>Annulla</button>
                  </div>
                </div>
              )}

              {/* ── Lista utenti ── */}
              {lista.length === 0 && <div className="muted">Nessun utente ancora registrato.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lista.map(u => {
                  const permList = Object.entries(M.perm?.[u.id] || {}).filter(([,v]) => v).map(([k]) => PERM_LBL[k] || k);
                  return (
                    <div key={u.id} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                      borderRadius: 8, border: "1px solid var(--border)",
                      background: u.attivo ? "var(--surface-2)" : "var(--surface)",
                      opacity: u.attivo === false ? 0.65 : 1,
                    }}>
                      <Avatar user={u} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
                          {u.nome}
                          {u.attivo === false && (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: "var(--rosso-bg, #fff0f1)", color: "var(--rosso)" }}>SOSPESO</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {u.ruolo}{u.ufficio ? ` · ${u.ufficio}` : ""}
                          {u.email ? <span style={{ marginLeft: 8, opacity: 0.7 }}>{u.email}</span> : null}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                          {permList.map(p => (
                            <span key={p} style={{ fontSize: 11, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: "var(--blu-bg, #e8f0fb)", color: "var(--blu)" }}>{p}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button className="btn btn--subtle btn--sm" onClick={() => openEdit(u)} title="Modifica">
                          <Icon name="edit" size={13} stroke={2} />
                        </button>
                        <button
                          className="btn btn--subtle btn--sm"
                          style={{ borderColor: u.attivo ? "var(--rosso)" : "var(--verde)", color: u.attivo ? "var(--rosso)" : "var(--verde)" }}
                          onClick={() => toggleSospeso(u)}
                          disabled={u.id === me && u.attivo !== false}
                          title={u.attivo ? "Sospendi accesso" : "Riattiva accesso"}
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
        );
      })()}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__body">
          <div className="banner banner--verde" style={{ fontSize: 12.5 }}>
            <Icon name="lock" size={16} />
            <div>Tutti i servizi sono <b>on-prem</b>: AI, PEC, storage e database restano nella rete del Comune. Nessun dato esce. Le impostazioni salvate qui sovrascrivono il file <code>.env</code> e si applicano immediatamente (le impostazioni Keycloak richiedono il riavvio del backend).</div>
          </div>
        </div>
      </div>
    </div>
  );
}
