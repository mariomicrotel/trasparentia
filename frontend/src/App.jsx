import React, { useEffect, useState, useCallback } from "react";
import { api, setCurrentUser } from "./api.js";
import { Icon } from "./icons.jsx";
import { setMeta, Avatar } from "./ui.jsx";
import { NotifPanel } from "./views/Notifiche.jsx";
import Cruscotto from "./views/Cruscotto.jsx";
import Inbox from "./views/Inbox.jsx";
import Comunicazione from "./views/Comunicazione.jsx";
import Pratica from "./views/Pratica.jsx";
import Scadenziario from "./views/Scadenziario.jsx";
import Atti from "./views/Atti.jsx";
import AttoDetail from "./views/AttoDetail.jsx";
import Inventario from "./views/Inventario.jsx";
import Sicurezza from "./views/Sicurezza.jsx";
import Ricerca from "./views/Ricerca.jsx";
import Configurazione from "./views/Configurazione.jsx";
import Import from "./views/Import.jsx";
import Aiuto from "./views/Aiuto.jsx";
import Utenti from "./views/Utenti.jsx";
import Calibrazione from "./views/Calibrazione.jsx";
import Uffici from "./views/Uffici.jsx";

function SlimbarCrest({ tick }) {
  const [err, setErr] = useState(false);
  useEffect(() => { setErr(false); }, [tick]);
  if (err) return <span className="slimbar__crest" />;
  return (
    <img
      src={`/api/configurazione/stemma?t=${tick}`}
      alt=""
      className="slimbar__crest"
      style={{ objectFit: "contain" }}
      onError={() => setErr(true)}
    />
  );
}

function Stub({ title, icon, nav }) {
  return (
    <div className="page">
      <div className="pagehead"><div className="pagehead__main">
        <div className="breadcrumb"><span>TrasParentIA</span><Icon name="chevronRight" size={14} /><span>{title}</span></div>
        <h1>{title}</h1></div></div>
      <div className="empty card" style={{ padding: "64px 24px" }}>
        <Icon name={icon} size={48} />
        <h3>Modulo disponibile nella piattaforma completa</h3>
        <p style={{ maxWidth: "46ch", margin: "0 auto 18px" }}>
          Questo primo incremento sviluppa in dettaglio il flusso dell'<b>Ufficio Tecnico</b>: dalla PEC alla conclusione della pratica. Il modulo «{title}» fa parte del perimetro ma non è incluso in questa versione.
        </p>
        <button className="btn btn--primary" onClick={() => nav("cruscotto")}><Icon name="grid" size={17} stroke={2} />Torna al cruscotto</button>
      </div>
    </div>
  );
}

export default function App({ kcEnabled = false, kcUsername = null, kcLogout = null }) {
  const [ready, setReady] = useState(false);
  const [M, setM] = useState(null);
  const [me, setMe] = useState(kcEnabled && kcUsername ? kcUsername : "rossi");
  const [kcUser, setKcUser] = useState(null);
  const [route, setRoute] = useState({ view: "inbox", params: {} });
  const [roleOpen, setRoleOpen] = useState(false);
  const [counts, setCounts] = useState({ daLavorare: 0, inRitardo: 0, daFirmare: 0 });
  const [tick, setTick] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [qText, setQText] = useState("");
  const [notifiche, setNotifiche] = useState([]);
  const [notifPanel, setNotifPanel] = useState(false);

  const toast = useCallback((msg, tone = "") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Propaga l'utente corrente al client API: in modalità demo viene inviato come
  // header X-Role su tutte le chiamate (necessario ora che anche i GET sono autenticati).
  useEffect(() => { setCurrentUser(me); }, [me]);

  useEffect(() => {
    api.meta().then((m) => {
      setMeta(m); setM(m); setReady(true);
      if (m?.tema?.blu) document.documentElement.style.setProperty("--blu", m.tema.blu);
    }).catch(() => setReady(true));
    if (kcEnabled) {
      api.getMe().then((u) => setKcUser(u)).catch(() => {});
    }
  }, [kcEnabled]);

  useEffect(() => {
    api.cruscotto().then((c) => setCounts({ daLavorare: c.daLavorare, inRitardo: c.inRitardo, daFirmare: c.daFirmare })).catch(() => {});
  }, [tick]);

  const fetchNotifiche = useCallback(() => {
    api.listNotifiche(me).then((n) => setNotifiche(n || [])).catch(() => {});
  }, [me]);

  useEffect(() => { fetchNotifiche(); }, [tick, fetchNotifiche]);

  useEffect(() => {
    const timer = setInterval(fetchNotifiche, 30_000);
    return () => clearInterval(timer);
  }, [fetchNotifiche]);

  function nav(view, params = {}) {
    setRoute({ view, params });
    const main = document.querySelector(".main"); if (main) main.scrollTop = 0;
  }
  function switchRole(r) {
    setMe(r); setRoleOpen(false);
    const home = r === "bianchi" ? "cruscotto"
      : r === "rossi" ? "inbox"
      : "scadenziario";
    nav(home);
    toast(`Ruolo: ${M.users[r].ruolo}`, "");
  }

  if (!ready || !M) return <div style={{ padding: 40, fontFamily: "Titillium Web, sans-serif" }}>Caricamento…</div>;

  const ENTE = M.ente;
  const viewProps = { me, nav, toast, refresh, tick, M };

  function renderView() {
    const { view, params } = route;
    if (view === "cruscotto") return <Cruscotto {...viewProps} />;
    if (view === "inbox") return <Inbox {...viewProps} />;
    if (view === "comunicazione") return <Comunicazione key={params.id} id={params.id} {...viewProps} />;
    if (view === "scadenziario") return <Scadenziario {...viewProps} />;
    if (view === "pratica") return <Pratica key={params.id} id={params.id} {...viewProps} />;
    if (view === "atti") return <Atti {...viewProps} />;
    if (view === "atto") return <AttoDetail key={params.id} id={params.id} {...viewProps} />;
    if (view === "inventario") return <Inventario {...viewProps} />;
    if (view === "sicurezza") return <Sicurezza {...viewProps} />;
    if (view === "ricerca") return <Ricerca key={params.q} q={params.q} {...viewProps} />;
    if (view === "config") return <Configurazione {...viewProps} />;
    if (view === "import") return <Import {...viewProps} />;
    if (view === "aiuto") return <Aiuto {...viewProps} />;
    if (view === "utenti") return <Utenti {...viewProps} />;
    if (view === "calibrazione") return <Calibrazione {...viewProps} />;
    if (view === "uffici") return <Uffici {...viewProps} />;
    return <Stub title="Modulo" icon="grid" nav={nav} />;
  }

  const activeKey = route.view === "comunicazione" ? "inbox" : route.view === "pratica" ? "scadenziario" : route.view === "atto" ? "atti" : route.view;
  const NAV = [
    { g: "Operativo" },
    { k: "cruscotto",    lbl: "Cruscotto",            ico: "grid" },
    { k: "inbox",        lbl: "Comunicazioni",         ico: "mail",     badge: counts.daLavorare },
    { k: "scadenziario", lbl: "Pratiche",              ico: "folder",   badge: counts.inRitardo, alert: true },
    { k: "atti",         lbl: "Atti & bozze",          ico: "fileText", badge: counts.daFirmare },
    { g: "Patrimonio" },
    { k: "inventario",   lbl: "Inventario beni",       ico: "box" },
    { g: "Sistema" },
    { k: "uffici",       lbl: "Uffici e flussi",       ico: "building" },
    { k: "import",       lbl: "Importazione massiva",  ico: "upload" },
    { k: "calibrazione", lbl: "Calibrazione AI",       ico: "sliders" },
    { k: "utenti",       lbl: "Gestione utenti",       ico: "users" },
    { k: "sicurezza",    lbl: "Sicurezza & log",       ico: "shield" },
    { k: "config",       lbl: "Configurazione",        ico: "settings" },
    { k: "aiuto",        lbl: "Guida & aiuto",         ico: "info" },
  ];

  return (
    <div className="app" data-tema="blu" data-density="comoda">
      <div className="slimbar">
        <SlimbarCrest tick={tick} />
        <span><strong>{ENTE.nome}</strong>{` · Provincia di ${ENTE.prov}`}</span>
        <span className="slimbar__spacer" />
        <span className="slimbar__chip">{kcEnabled ? "AUTENTICAZIONE KEYCLOAK" : "AMBIENTE DIMOSTRATIVO"}</span>
        <span className="slimbar__sep" /><a href="#">Assistenza</a><a href="#">Manuale</a>
      </div>

      <div className="topbar">
        <div className="brand" onClick={() => nav("cruscotto")} style={{ cursor: "pointer" }}>
          <span className="brand__mark"><Icon name="sparkles" size={22} stroke={2} /></span>
          <div><div className="brand__name">TrasParent<b>IA</b></div><div className="brand__sub">Micro PA</div></div>
        </div>
        <div className="searchbox">
          <Icon name="search" size={18} />
          <input placeholder="Cerca comunicazioni, pratiche, protocolli, documenti…" aria-label="Cerca"
                 value={qText} onChange={(e) => setQText(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter" && qText.trim()) nav("ricerca", { q: qText.trim() }); }} />
          <kbd>⌘K</kbd>
        </div>
        <span className="topbar__spacer" />
        <div className="topbar__actions">
          <div style={{ position: "relative" }}>
            <button
              className="iconbtn"
              title="Notifiche"
              onClick={() => setNotifPanel((o) => !o)}
            >
              <Icon name="bell" size={20} />
              {notifiche.filter((n) => !n.letta).length > 0 && (
                <span className="dot">{notifiche.filter((n) => !n.letta).length}</span>
              )}
            </button>
            {notifPanel && (
              <NotifPanel
                notifiche={notifiche}
                onClose={() => setNotifPanel(false)}
                onLetta={(id) => {
                  api.segnaLetta(id, me).then(fetchNotifiche).catch(() => {});
                }}
                onTuttoLetto={() => {
                  api.segnaTuttoLetto(me).then(fetchNotifiche).catch(() => {});
                }}
                nav={nav}
              />
            )}
          </div>
          <div className="role">
            {kcEnabled ? (
              /* Keycloak attivo: mostra utente autenticato + pulsante logout */
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar user={kcUser || me} />
                <span className="role__meta">
                  <span className="role__name">{kcUser?.nome ?? M.users[me]?.nome ?? me}</span>
                  <span className="role__role">{kcUser?.ruolo ?? M.users[me]?.ruolo ?? ""}</span>
                </span>
                <button className="btn btn--subtle btn--sm" onClick={kcLogout} title="Esci" style={{ marginLeft: 4 }}>
                  <Icon name="arrowRight" size={15} stroke={2} />Esci
                </button>
              </div>
            ) : (
              /* Modalità demo: role-switch */
              <>
                <button className="role__btn" onClick={() => setRoleOpen((o) => !o)}>
                  <Avatar user={me} />
                  <span className="role__meta"><span className="role__name">{M.users[me].nome}</span><span className="role__role">{M.users[me].ruolo}</span></span>
                  <Icon name="chevronDown" size={16} style={{ color: "var(--text-muted)" }} />
                </button>
                {roleOpen && (
                  <div className="role__menu">
                    {[
                      { g: "Protocollo" },
                      "rossi",
                      { g: "Istruttori" },
                      "deluca", "ferrari",
                      { g: "Responsabili di ufficio" },
                      "esposito", "ferrara", "russo", "moretti", "ricci",
                      { g: "Segretario" },
                      "bianchi",
                    ].map((r, i) =>
                      typeof r === "object" ? (
                        <div key={"g" + i} style={{ padding: "6px 14px 2px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>{r.g}</div>
                      ) : (
                        <button key={r} className="role__opt" data-active={me === r} onClick={() => switchRole(r)}>
                          <Avatar user={r} size={36} />
                          <span className="role__meta"><span className="role__name">{M.users[r].nome}</span><span className="role__role">{M.users[r].ruolo} · {M.users[r].ufficio}</span></span>
                          {me === r && <span className="check"><Icon name="check" size={18} stroke={2.5} /></span>}
                        </button>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="body">
        <nav className="sidebar">
          {NAV.map((it, i) => it.g
            ? <div className="sidebar__group" key={"g" + i}>{it.g}</div>
            : <button key={it.k} className="navitem" data-active={activeKey === it.k} onClick={() => nav(it.k)}>
                <Icon name={it.ico} size={19} stroke={1.9} />{it.lbl}
                {it.badge > 0 && <span className={"navbadge" + (it.alert ? " navbadge--alert" : "")}>{it.badge}</span>}
              </button>)}
          <div className="sidebar__spacer" />
          <div className="sidebar__ente">
            <b>{ENTE.nome}</b>
            {`${ENTE.abitanti.toLocaleString("it-IT")} abitanti · ${ENTE.cap} (${ENTE.prov})`}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, color: "var(--blu)" }}>
              <Icon name="sparkles" size={14} stroke={2} /><span style={{ fontWeight: 700, fontSize: 12 }}>AI assistiva attiva</span>
            </div>
          </div>
        </nav>
        <main className="main">{renderView()}</main>
      </div>

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={"toast" + (t.tone ? ` toast--${t.tone}` : "")}>
            <Icon name={t.tone === "ai" ? "sparkles" : t.tone === "success" ? "checkCircle" : "info"} size={18} stroke={2} />{t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
