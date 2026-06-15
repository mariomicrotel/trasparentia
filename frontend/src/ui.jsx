import React from "react";
import { Icon } from "./icons.jsx";

// meta (CAT, STATI, PRIO, USERS, ...) caricata una volta da /api/meta
let META = { cat: {}, stati: {}, prio: {}, users: {}, atti_tipi: {} };
export function setMeta(m) { META = m; }
export const meta = () => META;

// ---- date helpers (porting da data.jsx) ----
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const pad = (n) => String(n).padStart(2, "0");
export function fmtDate(iso) { if (!iso) return "—"; const d = new Date(iso); return `${pad(d.getDate())} ${MESI[d.getMonth()]} ${d.getFullYear()}`; }
export function fmtDateTime(iso) { if (!iso) return "—"; const d = new Date(iso); return `${pad(d.getDate())} ${MESI[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function fmtTime(iso) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function daysUntil(iso) {
  if (!iso) return null;
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(iso); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
}
export function relScadenza(iso) {
  const d = daysUntil(iso);
  if (d === null) return { txt: "—", tone: "gray", d };
  if (d < 0) return { txt: `in ritardo di ${Math.abs(d)} ${Math.abs(d) === 1 ? "giorno" : "giorni"}`, tone: "rosso", d };
  if (d === 0) return { txt: "scade oggi", tone: "rosso", d };
  if (d === 1) return { txt: "scade domani", tone: "ambra", d };
  if (d <= 7) return { txt: `tra ${d} giorni`, tone: "ambra", d };
  return { txt: `tra ${d} giorni`, tone: "verde", d };
}

// ---- tone → colori (CSS vars) ----
export function bgFor(tone) {
  return { ai: "var(--ai-bg)", blu: "var(--blu-050)", verde: "var(--verde-bg)", ambra: "var(--ambra-bg)", rosso: "var(--rosso-bg)", azure: "var(--azure-bg)", viola: "var(--viola-bg)", gray: "#eceff2" }[tone] || "#eceff2";
}
export function colFor(tone) {
  return { ai: "var(--ai)", blu: "var(--blu)", verde: "var(--verde)", ambra: "var(--ambra)", rosso: "var(--rosso)", azure: "var(--azure)", viola: "var(--viola)", gray: "var(--text-muted)" }[tone] || "var(--text-muted)";
}
export const confClass = (p) => (p >= 0.85 ? "hi" : p >= 0.65 ? "mid" : "lo");

// ---- primitivi ----
export function Avatar({ user, size = 34 }) {
  // user può essere: stringa (username lookup in META), oggetto {nome,iniz,col}, o stringa username KC non in META
  let u = typeof user === "string" ? META.users[user] : user;
  if (!u && typeof user === "string" && user.length > 0) {
    // fallback sintetico per utenti KC non nel dizionario statico
    const parts = user.split(/[.\-_ ]/);
    u = { iniz: parts.map(p => p[0] ?? "").join("").toUpperCase().slice(0, 2) || user[0].toUpperCase(), col: "#0066cc" };
  }
  if (!u) return null;
  return <span className="avatar" style={{ width: size, height: size, background: u.col, fontSize: size * 0.38 }}>{u.iniz}</span>;
}

export function Badge({ tone = "gray", icon, children, style }) {
  return <span className={`badge badge--${tone}`} style={style}>{icon && <Icon name={icon} size={13} stroke={2} />}{children}</span>;
}

export function CatBadge({ cat, small }) {
  const c = META.cat[cat]; if (!c) return null;
  return <span className={`badge badge--${c.col}`} style={small ? { height: 22, fontSize: 11.5 } : null}><Icon name={c.ico} size={13} stroke={2} />{c.lbl}</span>;
}

export function StatoPill({ stato, ritardo }) {
  if (ritardo) return <span className="badge badge--rosso"><Icon name="alertTriangle" size={13} stroke={2} />In ritardo</span>;
  const s = META.stati[stato]; if (!s) return null;
  return <span className={`badge badge--${s.col}`}><Icon name={s.ico} size={13} stroke={2} />{s.lbl}</span>;
}

export function PrioTag({ prio }) {
  const p = META.prio[prio]; if (!p) return null;
  return <span className="prio"><span className="prio__dot" style={{ background: p.col }} />{p.lbl}</span>;
}

export function ConfBar({ p, showPct = true, width }) {
  const cls = confClass(p);
  return (
    <div className="conf">
      <div className="conf__bar" style={width ? { maxWidth: width } : null}>
        <div className={`conf__fill conf__fill--${cls}`} style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      {showPct && <span className={`conf__pct conf__pct--${cls}`}>{Math.round(p * 100)}%</span>}
    </div>
  );
}

const LOG_TONE = {
  protocollo: { tone: "blu", ico: "tag" }, classificazione: { tone: "ai", ico: "sparkles" },
  assegnazione: { tone: "blu", ico: "forward" }, cambio_stato: { tone: "blu", ico: "route" },
  nota: { tone: "gray", ico: "edit" }, bozza_generata: { tone: "ai", ico: "sparkles" },
  bozza_approvata: { tone: "verde", ico: "checkCircle" }, integrazione: { tone: "ambra", ico: "forward" },
  comunicazione_inviata: { tone: "blu", ico: "send" }, override: { tone: "ambra", ico: "swap" },
  creazione: { tone: "blu", ico: "plus" }, pubblicazione: { tone: "verde", ico: "book" },
};

export function TimelineItem({ entry }) {
  const u = META.users[entry.attoreId] || {};
  const t = LOG_TONE[entry.tipo] || LOG_TONE.nota;
  return (
    <div className="tlitem">
      <div className="tlitem__ico" style={{ background: bgFor(t.tone), color: colFor(t.tone) }}><Icon name={t.ico} size={16} stroke={2} /></div>
      <div className="tlitem__body">
        <div className="tlitem__act">{entry.azione}</div>
        <div className="tlitem__meta">
          {entry.attoreId === "ai"
            ? <Badge tone="ai" icon="sparkles">AI</Badge>
            : <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Avatar user={u} size={18} />{u.nome}</span>}
          <span>·</span><span>{fmtDateTime(entry.ts)}</span>
          {entry.aiBadge && <span className="mono" style={{ color: "var(--ai)" }}>confidenza {entry.aiBadge}</span>}
        </div>
        {entry.dettaglio && <div className="tlitem__detail">{entry.dettaglio}</div>}
      </div>
    </div>
  );
}

// ciclo di vita di un atto in base al tipo
export function attoFlow(tipo, M) {
  const t = (M.atti_tipi && M.atti_tipi[tipo]) || {};
  if (t.albo) return ["bozza", "in_revisione", "pronta_firma", "firmato", "pubblicato"];
  if (t.interno) return ["bozza", "in_revisione", "pronta_firma", "firmato"];
  return ["bozza", "in_revisione", "pronta_firma", "firmato", "protocollato"];
}
export function attoNext(tipo, stato, M) {
  const f = attoFlow(tipo, M);
  const i = f.indexOf(stato);
  return i >= 0 && i < f.length - 1 ? f[i + 1] : null;
}

// tipi di bozza per l'assistente atti
export const DRAFT_TIPI = {
  avvio_procedimento: { lbl: "Comunicazione avvio procedimento", ico: "send" },
  risposta_cittadino: { lbl: "Risposta al cittadino", ico: "mail" },
  richiesta_parere: { lbl: "Richiesta parere ad altro ente", ico: "building" },
  sollecito: { lbl: "Sollecito interno", ico: "bell" },
  richiesta_integrazione: { lbl: "Richiesta integrazione", ico: "forward" },
  riepilogo: { lbl: "Riepilogo pratica", ico: "list" },
};
