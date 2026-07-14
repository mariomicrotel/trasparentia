import React, { useState } from "react";
import { Icon } from "../icons.jsx";
import { Presenta } from "../sueForm.jsx";
import MockSpidLogin from "../mockSpid.jsx";

// Portale pubblico dello Sportello Unico per l'Edilizia — Front-office.
// Pagina STANDALONE, raggiungibile su /sportello-sue SENZA login interno: il
// presentatore (cittadino/tecnico) non ha e non deve avere credenziali di
// staff. Bypassa interamente l'autenticazione dell'app (nativa/Keycloak) —
// vedi il check in App.jsx (e in main.jsx per il caso Keycloak).
//
// L'accesso al portale avviene invece tramite SPID/CIE (simulato: vedi
// mockSpid.jsx). Finché l'identità non è verificata, il modulo di istanza
// non è raggiungibile.

export default function PortaleSUEPubblico() {
  const [identita, setIdentita] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toast = (msg, tone = "") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page, #f5f6fa)", fontFamily: "Titillium Web, sans-serif" }}>
      <div style={{ background: "#0066cc", color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <Icon name="building" size={26} stroke={2} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Sportello Unico per l'Edilizia</div>
          <div style={{ fontSize: 12.5, opacity: .9 }}>Portale pubblico — presentazione istanze online</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 20px 60px" }}>
        {!identita ? (
          <div style={{ paddingTop: 24 }}>
            <MockSpidLogin onIdentita={setIdentita} />
          </div>
        ) : (
          <>
            <div className="banner banner--info" style={{ marginBottom: 20, fontSize: 13 }}>
              <Icon name="info" size={16} stroke={2} />
              <span>Prototipo dimostrativo: la firma digitale e il Catalogo nazionale degli Sportelli Unici sono simulati.</span>
            </div>
            <Presenta toast={toast} identita={identita} onCambiaIdentita={() => setIdentita(null)} />
          </>
        )}
      </div>

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={"toast" + (t.tone ? ` toast--${t.tone}` : "")}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
