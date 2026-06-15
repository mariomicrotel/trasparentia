// Client API. Base relativa: in dev Vite fa proxy /api, in prod nginx.
// Quando Keycloak è attivo, setTokenProvider inietta un getter asincrono per il Bearer token.
let _tokenFn = () => Promise.resolve(null);
export function setTokenProvider(fn) { _tokenFn = fn; }

async function req(method, path, body, me) {
  const headers = { "Content-Type": "application/json" };
  const token = await _tokenFn();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (me) {
    headers["X-Role"] = me;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

async function upload(path, formData, me) {
  const headers = {};
  const token = await _tokenFn();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (me) {
    headers["X-Role"] = me;
  }
  const res = await fetch(path, { method: "POST", headers, body: formData });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch {}
    const err = new Error(detail); err.status = res.status; throw err;
  }
  return res.json();
}

export const api = {
  meta: () => req("GET", "/api/meta"),
  aiStatus: () => req("GET", "/api/ai/status"),
  aiClassifica: (payload) => req("POST", "/api/ai/classifica", payload),

  listCom: () => req("GET", "/api/comunicazioni"),
  getCom: (id) => req("GET", `/api/comunicazioni/${encodeURIComponent(id)}`),
  prendiCarico: (id, payload, me) => req("POST", `/api/comunicazioni/${encodeURIComponent(id)}/prendi-carico`, payload, me),

  listPratiche: (me) => req("GET", "/api/pratiche", null, me),
  getPratica: (id) => req("GET", `/api/pratiche/${encodeURIComponent(id)}`),
  cambioStato: (id, payload, me) => req("POST", `/api/pratiche/${encodeURIComponent(id)}/stato`, payload, me),
  riassegna: (id, payload, me) => req("POST", `/api/pratiche/${encodeURIComponent(id)}/riassegna`, payload, me),
  bozza: (id, payload, me) => req("POST", `/api/pratiche/${encodeURIComponent(id)}/bozza`, payload, me),

  listAtti: (me) => req("GET", "/api/atti", null, me),
  getAtto: (id) => req("GET", `/api/atti/${encodeURIComponent(id)}`),
  attoStato: (id, payload, me) => req("POST", `/api/atti/${encodeURIComponent(id)}/stato`, payload, me),

  listBeni: () => req("GET", "/api/beni"),
  geoBene: (id, lat, lon, me) => req("PATCH", `/api/beni/${encodeURIComponent(id)}/geo`, { lat, lon }, me),
  qrUrl: (id) => `/api/beni/${encodeURIComponent(id)}/qr.png`,

  log: () => req("GET", "/api/log"),
  cruscotto: () => req("GET", "/api/cruscotto"),

  importComunicazione: (formData, me) => upload("/api/comunicazioni/import", formData, me),
  pecStatus: () => req("GET", "/api/pec/status"),
  pecSync: (me) => req("POST", "/api/pec/sync", null, me),
  docFileUrl: (id) => `/api/documenti/${encodeURIComponent(id)}/file`,
  eccezioni: () => req("GET", "/api/eccezioni"),

  cerca: (q, mode = "auto") => req("GET", `/api/cerca?q=${encodeURIComponent(q)}&mode=${mode}`),
  cercaStatus: () => req("GET", "/api/cerca/status"),
  reindex: (me) => req("POST", "/api/cerca/reindex", null, me),

  salvaContenuto: (id, payload, me) => req("PATCH", `/api/atti/${encodeURIComponent(id)}/contenuto`, payload, me),
  rigeneraContenuto: (id, payload, me) => req("POST", `/api/atti/${encodeURIComponent(id)}/rigenera`, payload, me),

  // notifiche (Fase 6)
  listNotifiche: (me) => req("GET", "/api/notifiche", null, me),
  segnaLetta: (id, me) => req("POST", `/api/notifiche/${encodeURIComponent(id)}/letta`, null, me),
  segnaTuttoLetto: (me) => req("POST", "/api/notifiche/segna-tutto-letto", null, me),

  // report (Fase 6)
  getReport: (tipo, me) => req("GET", `/api/report?tipo=${encodeURIComponent(tipo)}`, null, me),

  // diagnostica & configurazione (Fase 3+7)
  diagnostica: (me) => req("GET", "/api/diagnostica", null, me),
  testServizio: (key, me) => req("POST", `/api/diagnostica/test/${encodeURIComponent(key)}`, null, me),
  provaSmtp: (payload, me) => req("POST", "/api/diagnostica/smtp/prova", payload, me),

  // importazione massiva (Fase 8)
  listLotti: (me) => req("GET", "/api/import/lotti", null, me),
  creaLotto: (nome, me) => req("POST", "/api/import/lotto", { nome }, me),
  getLotto: (id, me) => req("GET", `/api/import/lotto/${id}`, null, me),
  uploadItems: (lottoId, files, me) => {
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    return upload(`/api/import/lotto/${encodeURIComponent(lottoId)}/upload`, fd, me);
  },
  classificaItem: (id, me) => req("POST", `/api/import/item/${id}/classifica`, null, me),
  applicaItem: (id, payload, me) => req("POST", `/api/import/item/${id}/applica`, payload, me),
  scartaItem: (id, nota, me) => req("POST", `/api/import/item/${id}/scarta`, { nota }, me),
  chiudiLotto: (id, me) => req("POST", `/api/import/lotto/${id}/chiudi`, null, me),

  // impostazioni configurazione runtime
  leggiImpostazioni: (me) => req("GET", "/api/configurazione/impostazioni", null, me),
  salvaImpostazioni: (payload, me) => req("POST", "/api/configurazione/impostazioni", payload, me),

  // backup & restore (Fase 7 + Bundle D)
  listBackup: (me) => req("GET", "/api/backup", null, me),
  creaBackup: (me) => req("POST", "/api/backup", null, me),
  ripristinaBackup: (file, me) => req("POST", "/api/backup/ripristina", { file }, me),

  // integrazione sistemi documentali esterni
  testIntegrazione: (tipo, me) => req("POST", `/api/integrazione/${encodeURIComponent(tipo)}/test`, null, me),

  // calibrazione AI — golden set (P4)
  goldenSetCampione: (n, ordine, me) => req("GET", `/api/golden-set/campione?n=${n}&ordine=${encodeURIComponent(ordine)}`, null, me),
  goldenSetValuta: (payload, me) => req("POST", "/api/golden-set/valuta", payload, me),

  // importazione massiva beni da CSV (P4)
  importBeniCsv: (file, me) => {
    const fd = new FormData();
    fd.append("file", file);
    return upload("/api/beni/import-csv", fd, me);
  },

  // utenti & auth
  getMe: () => req("GET", "/api/me"),
  getUtenti: (me) => req("GET", "/api/utenti", null, me),
  creaUtente: (payload, me) => req("POST", "/api/utenti", payload, me),
  aggiornaUtente: (uid, payload, me) => req("PATCH", `/api/utenti/${encodeURIComponent(uid)}`, payload, me),
  sospendiUtente: (uid, me) => req("POST", `/api/utenti/${encodeURIComponent(uid)}/sospendi`, null, me),
  riattivaUtente: (uid, me) => req("POST", `/api/utenti/${encodeURIComponent(uid)}/riattiva`, null, me),
};
