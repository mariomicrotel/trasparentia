import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Icon } from "../icons.jsx";
import { Badge, TimelineItem, attoNext, fmtDate } from "../ui.jsx";

const STATO_LABEL = {
  in_revisione: ["Invia in revisione", "eye"], pronta_firma: ["Contrassegna pronto per la firma", "signature"],
  firmato: ["Firma atto", "checkCircle"], protocollato: ["Protocolla in uscita", "send"], pubblicato: ["Pubblica all'Albo", "book"],
};

// Modificabile fino alla firma inclusa la fase "pronta_firma": il responsabile può
// revisionare il testo prima di firmare. Dopo «firmato» l'atto è bloccato.
const EDITABILE = new Set(["bozza", "in_revisione", "pronta_firma"]);

export default function AttoDetail({ id, M, me, nav, toast, refresh }) {
  const perm = M.perm[me] || {};
  const [a, setA] = useState(null);
  const [busy, setBusy] = useState(false);

  // editor state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [originalDraft, setOriginalDraft] = useState("");
  const [note, setNote] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  // AI rigenera
  const [aiPanel, setAiPanel] = useState(false);
  const [istruzioni, setIstruzioni] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiModello, setAiModello] = useState("");

  const textareaRef = useRef(null);

  function load() { return api.getAtto(id).then(setA).catch(() => setA(false)); }
  useEffect(() => { load(); }, [id]);

  // auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [draft, editing]);

  if (a === false) return <div className="page"><div className="empty card"><Icon name="fileText" size={40} /><h3>Atto non trovato</h3></div></div>;
  if (!a) return <div className="page"><p>Caricamento…</p></div>;

  const t = M.atti_tipi[a.tipo] || { lbl: a.tipo };
  const s = M.atti_stati[a.stato] || {};
  const next = editing ? null : attoNext(a.tipo, a.stato, M);
  const canEdit = perm.bozze && EDITABILE.has(a.stato);

  async function avanza() {
    if (!next) return;
    setBusy(true);
    try {
      await api.attoStato(a.id, { nuovo: next, me }, me);
      await load(); refresh();
      toast(M.atti_stati[next].lbl, next === "pubblicato" || next === "firmato" ? "success" : "");
    } catch (e) { toast(e.message, ""); } finally { setBusy(false); }
  }

  function startEdit() {
    setDraft(a.contenuto || "");
    setOriginalDraft(a.contenuto || "");
    setNote("");
    setAiPanel(false);
    setIstruzioni("");
    setAiModello("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft("");
    setAiPanel(false);
  }

  async function saveEdit() {
    if (!draft.trim()) { toast("Il testo non può essere vuoto", ""); return; }
    setSaveBusy(true);
    try {
      const updated = await api.salvaContenuto(a.id, { contenuto: draft, note, me }, me);
      setA(updated);
      setEditing(false);
      setDraft("");
      toast("Testo salvato", "success");
      refresh();
    } catch (e) { toast(e.message, ""); } finally { setSaveBusy(false); }
  }

  async function rigenera() {
    setAiBusy(true);
    try {
      const res = await api.rigeneraContenuto(a.id, { istruzioni, me }, me);
      setDraft(res.contenuto_nuovo || "");
      setAiModello(res.modello || "");
      setAiPanel(false);
      setIstruzioni("");
      toast("Bozza rigenerata dall'AI — verifica e salva", "ai");
    } catch (e) { toast(e.message, ""); } finally { setAiBusy(false); }
  }

  const [lbl, ico] = STATO_LABEL[next] || ["Avanza", "play"];
  const hasChanged = editing && draft !== originalDraft;

  return (
    <div className="page page--wide">
      <div className="pagehead">
        <div className="pagehead__main">
          <div className="breadcrumb">
            <a onClick={() => nav("atti")}>Atti &amp; bozze</a>
            <Icon name="chevronRight" size={14} />
            <span className="mono">{a.numero || a.id}</span>
          </div>
          <h1>{a.oggetto}</h1>
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Badge tone={s.col} icon={s.ico}>{s.lbl}</Badge>
            <Badge tone={t.col || "blu"} icon={t.ico}>{t.lbl}</Badge>
            {a.generatoAI && !editing && <Badge tone="ai" icon="sparkles">Bozza AI</Badge>}
            {editing && hasChanged && <Badge tone="ambra" icon="edit">Modifiche non salvate</Badge>}
            {a.numero && <span className="mono" style={{ fontSize: 13, color: "var(--text-muted)" }}>{a.numero}</span>}
          </div>
        </div>
        <div className="pagehead__actions">
          <button className="btn btn--subtle" onClick={() => nav("atti")}><Icon name="arrowLeft" size={17} stroke={2} />Registro</button>
          {!editing && <button className="btn btn--subtle" onClick={() => window.print()} aria-label="Stampa atto"><Icon name="printer" size={17} stroke={2} />Stampa</button>}
          {!editing && canEdit && (
            <button className="btn btn--subtle" onClick={startEdit}><Icon name="edit" size={17} stroke={2} />Modifica testo</button>
          )}
          {!editing && next && (
            <button className="btn btn--primary" disabled={!perm.bozze || busy} onClick={avanza}><Icon name={ico} size={17} stroke={2} />{lbl}</button>
          )}
          {editing && (
            <>
              <button className="btn btn--subtle" disabled={saveBusy || aiBusy} onClick={cancelEdit}><Icon name="x" size={17} stroke={2} />Annulla</button>
              <button className="btn btn--primary" disabled={saveBusy || aiBusy || !draft.trim()} onClick={saveEdit}>
                <Icon name="save" size={17} stroke={2} />{saveBusy ? "Salvataggio…" : "Salva testo"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="split">
        <div className="docview">
          <div className="docview__head">
            <div className="docview__subj">{a.oggetto}</div>
            <div className="metarow" style={{ fontSize: 12.5, color: "var(--text-muted)", padding: "0 0 4px" }}>
              {t.lbl}{a.numero ? " · " + a.numero : ""}{a.protocollo ? " · prot. " + a.protocollo : ""} · creato {fmtDate(a.creato)}
            </div>
          </div>

          {a.albo && (
            <div className="banner banner--verde" style={{ margin: "0 22px 12px" }}>
              <Icon name="book" size={20} />
              <div><b>Pubblicato all'Albo Pretorio n. {a.albo.numero}</b> · dal {fmtDate(a.albo.dal)} al {fmtDate(a.albo.al)}</div>
            </div>
          )}

          {editing ? (
            <div style={{ padding: "0 22px 22px" }}>
              {/* AI rigenera toolbar */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  className="btn btn--ai btn--sm"
                  disabled={aiBusy}
                  onClick={() => setAiPanel((p) => !p)}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Icon name="sparkles" size={15} stroke={2} />
                  {aiBusy ? "AI in elaborazione…" : "Rigenera con AI"}
                </button>
                {aiModello && (
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontFamily: "monospace" }}>
                    modello: {aiModello}
                  </span>
                )}
              </div>

              {aiPanel && (
                <div className="aibox" style={{ marginBottom: 14, padding: "14px 16px" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="sparkles" size={15} stroke={2} style={{ color: "var(--ai)" }} />
                    Istruzioni di revisione
                  </div>
                  <textarea
                    value={istruzioni}
                    onChange={(e) => setIstruzioni(e.target.value)}
                    placeholder="es. «rendi più formale», «aggiungi riferimento al DPR 380/2001», «accorcia eliminando le ripetizioni»…"
                    rows={3}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "8px 10px", borderRadius: 6,
                      border: "1.5px solid var(--border)", fontSize: 13,
                      fontFamily: "inherit", resize: "none",
                      background: "var(--surface-1)", color: "var(--text)",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button className="btn btn--ai btn--sm" disabled={aiBusy} onClick={rigenera}>
                      <Icon name="sparkles" size={15} stroke={2} />{aiBusy ? "Elaborazione…" : "Genera revisione"}
                    </button>
                    <button className="btn btn--subtle btn--sm" onClick={() => setAiPanel(false)}>Annulla</button>
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}>
                    Il testo verrà proposto nell'editor — nessun salvataggio automatico. Verifica e usa "Salva testo" per confermare.
                  </p>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  minHeight: 320, padding: "14px 16px",
                  border: "1.5px solid var(--blu)", borderRadius: 8,
                  fontFamily: "inherit", fontSize: 14.5, lineHeight: 1.65,
                  resize: "vertical", background: "var(--surface-1)", color: "var(--text)",
                  outline: "none",
                }}
              />

              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12.5, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Note sulla modifica (opzionale — registrate in tracciabilità)
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="es. «corretti riferimenti normativi», «aggiornato indirizzo destinatario»"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "7px 10px", borderRadius: 6,
                    border: "1.5px solid var(--border)", fontSize: 13,
                    fontFamily: "inherit", background: "var(--surface-1)", color: "var(--text)",
                  }}
                />
              </div>

              <div className="aibox__disclaimer" style={{ marginTop: 14 }}>
                <Icon name="info" size={15} stroke={2} />
                Le bozze AI sono proposte di supporto alla redazione. Il testo definitivo è responsabilità dell'ufficio competente (L.132/2025 art. 14).
              </div>
            </div>
          ) : (
            <div className="docview__body">
              {(a.contenuto || "").split("\n").map((line, i) => <p key={i} style={{ whiteSpace: "pre-wrap" }}>{line || " "}</p>)}
            </div>
          )}

          {!editing && a.generatoAI && (
            <div className="aibox__disclaimer" style={{ borderTop: "1px solid var(--border)" }}>
              <Icon name="info" size={15} stroke={2} />Bozza generata dall'AI: da verificare, modificare e firmare a cura dell'ufficio competente.
            </div>
          )}
          {/* Marcatura AI in stampa — art. 50 AI Act / L.132/2025 art.14 (visibile solo su @media print) */}
          {a.generatoAI && (
            <div className="ai-print-notice" aria-hidden="true">
              Documento elaborato con supporto AI — L. 132/2025 art. 14 · AI Act art. 50.<br />
              Il testo è stato verificato e assunto sotto la responsabilità del personale competente dell'Ente.
            </div>
          )}
        </div>

        <div className="sidecol">
          {!perm.bozze && (
            <div className="card"><div className="card__body"><div className="banner banner--ambra" style={{ fontSize: 13 }}>
              <Icon name="lock" size={16} /><div>Le azioni sull'atto sono riservate ai tecnici dell'Ufficio. Il ruolo <b>{M.users[me]?.ruolo ?? me}</b> può consultare.</div>
            </div></div></div>
          )}
          {canEdit && !editing && (
            <div className="card">
              <div className="card__head"><Icon name="edit" size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Editor atti</h3></div>
              <div className="card__body" style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
                <p style={{ margin: "0 0 10px" }}>Modifica il testo prima della firma. L'AI assistiva può riscrivere o affinare la bozza seguendo le tue istruzioni.</p>
                <button className="btn btn--subtle btn--sm" style={{ width: "100%" }} onClick={startEdit}>
                  <Icon name="edit" size={15} stroke={2} />Apri editor
                </button>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card__head"><Icon name="history" size={18} stroke={2} style={{ color: "var(--blu)" }} /><h3>Tracciabilità</h3><span className="sub">· {a.cronologia.length} eventi</span></div>
            <div className="card__body"><div className="timeline">{[...a.cronologia].reverse().map((e) => <TimelineItem key={e.id} entry={e} />)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
