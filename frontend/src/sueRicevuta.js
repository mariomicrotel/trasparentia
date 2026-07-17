// Ricevuta di avvenuta trasmissione di un'istanza SUE.
// Nel Portale SUE reale la ricevuta è generata dall'ente e inviata via PEC con i
// riferimenti di protocollo; vale come comunicazione di avvio del procedimento
// ai sensi dell'art. 18-bis della L. 241/1990 (cfr. Guida operativa SUE).
// Qui, nel prototipo, la generiamo lato client come documento HTML scaricabile
// a partire dai dati dell'istanza restituiti dal backend.

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Costruisce l'HTML della ricevuta a partire dall'istanza (dict del backend) e
// dagli estremi di protocollo/pratica.
export function ricevutaHtml(ist, extra = {}) {
  const cui = ist.cui || ist.id || "";
  const protocollo = extra.protocollo || ist.protocollo || "—";
  const pratica = extra.praticaId || ist.praticaId || "—";
  const delega = ist.ruoloPresentatore === "tecnico_delegato";
  const presentatore = [ist.presentatoreNome, ist.presentatoreCognome].filter(Boolean).join(" ") || "—";
  const titolare = delega
    ? ([ist.deleganteNome, ist.deleganteCognome].filter(Boolean).join(" ") || "—")
    : presentatore;
  const allegati = (ist.allegati || []).filter(a => a && a.nome);
  const righeAll = allegati.length
    ? allegati.map(a => `<li>${esc(a.label || a.tipoDoc)} — <span class="mono">${esc(a.nome)}</span></li>`).join("")
    : "<li><i>Nessun allegato</i></li>";

  return `<!doctype html><html lang="it"><head><meta charset="utf-8">
<title>Ricevuta ${esc(cui)}</title>
<style>
  body{font-family:'Titillium Web',Arial,sans-serif;color:#1f2937;max-width:720px;margin:24px auto;padding:0 20px;line-height:1.5}
  header{border-bottom:3px solid #0066cc;padding-bottom:12px;margin-bottom:20px}
  header .ente{font-size:13px;color:#6b7280}
  header h1{font-size:20px;margin:6px 0 0;color:#0b3d91}
  .sub{font-size:13px;color:#6b7280;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin:14px 0}
  th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:14px;vertical-align:top}
  th{width:38%;color:#6b7280;font-weight:600}
  .mono{font-family:ui-monospace,'Courier New',monospace}
  .badge{display:inline-block;background:#eef4ff;color:#0b3d91;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:700}
  ul{margin:6px 0;padding-left:20px;font-size:14px}
  .note{margin-top:22px;padding:12px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;font-size:12.5px;color:#4b5563}
  footer{margin-top:24px;font-size:11.5px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:10px}
</style></head><body>
<header>
  <div class="ente">Sportello Unico per l'Edilizia</div>
  <h1>Ricevuta di avvenuta trasmissione</h1>
  <div class="sub">Istanza edilizia presentata online</div>
</header>
<p>Si attesta la corretta trasmissione e protocollazione della seguente istanza edilizia.</p>
<table>
  <tr><th>Codice Unico Istanza (CUI)</th><td class="mono"><span class="badge">${esc(cui)}</span></td></tr>
  <tr><th>Protocollo generale</th><td class="mono">${esc(protocollo)}</td></tr>
  <tr><th>Numero pratica</th><td class="mono">${esc(pratica)}</td></tr>
  <tr><th>Procedimento</th><td>${esc(ist.procedimento)} <span style="color:#6b7280">(${esc(ist.regime)})</span></td></tr>
  <tr><th>Titolare / richiedente</th><td>${esc(titolare)}</td></tr>
  ${delega ? `<tr><th>Presentata dal tecnico incaricato</th><td>${esc(presentatore)}</td></tr>` : ""}
  <tr><th>Data di presentazione</th><td>${esc(ist.creato)}</td></tr>
  <tr><th>Documentazione trasmessa</th><td><ul>${righeAll}</ul></td></tr>
</table>
<div class="note">
  La presente ricevuta può costituire comunicazione di avvio del procedimento ai sensi dell'art. 18-bis
  della legge 7 agosto 1990, n. 241. I termini del procedimento decorrono dalla data di protocollazione
  sopra indicata.
</div>
<footer>
  Documento generato automaticamente dal Portale SUE — TrasParentIA (prototipo dimostrativo).
</footer>
</body></html>`;
}

// Genera e scarica la ricevuta come file HTML.
export function scaricaRicevuta(ist, extra = {}) {
  const html = ricevutaHtml(ist, extra);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Ricevuta_${(ist.cui || ist.id || "istanza")}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
