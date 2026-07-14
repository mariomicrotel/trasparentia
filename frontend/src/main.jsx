import React from "react";
import { createRoot } from "react-dom/client";
// Font self-hosted via @fontsource — nessuna richiesta a CDN esterni
import "@fontsource/titillium-web/300.css";
import "@fontsource/titillium-web/400.css";
import "@fontsource/titillium-web/600.css";
import "@fontsource/titillium-web/700.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/500.css";
import "@fontsource/lora/600.css";
import "@fontsource/lora/400-italic.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "./styles.css";
import App from "./App.jsx";
import { setTokenProvider } from "./api.js";

// Path pubblici che NON richiedono autenticazione (interna né Keycloak): il
// Front-office SUE è per cittadini/tecnici esterni, senza credenziali di staff.
// Il check va fatto qui, PRIMA di un eventuale initKeycloak(), che altrimenti
// forzerebbe il login anche su questa pagina.
const PUBLIC_PATHS = ["/sportello-sue"];
const isPublicPath = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));

async function bootstrap() {
  if (isPublicPath) {
    createRoot(document.getElementById("root")).render(<App authMode="demo" />);
    return;
  }

  let kcEnabled = false;
  let kcUsername = null;
  let kcLogout = null;
  let authMode = "demo";

  try {
    const r = await fetch("/api/auth/config");
    if (r.ok) {
      const cfg = await r.json();
      // Keycloak solo se esplicitamente in modalità keycloak (o config legacy
      // priva di `mode` ma con enabled:true). NON basarsi solo su enabled:true:
      // anche la modalità native ritorna enabled:true.
      if (cfg.mode === "keycloak" || (cfg.mode == null && cfg.enabled === true)) {
        // Keycloak: comportamento invariato
        const { initKeycloak, getTokenFreshly, getUsername, doLogout } = await import("./keycloak.js");
        await initKeycloak(cfg);
        setTokenProvider(getTokenFreshly);
        kcEnabled = true;
        kcUsername = getUsername();
        kcLogout = doLogout;
        authMode = "keycloak";
      } else if (cfg.mode === "native") {
        authMode = "native";
        // Il token viene letto da localStorage dentro api.js (_tokenFn default)
      }
      // mode === "demo": authMode rimane "demo"
    }
  } catch {
    // Backend non raggiungibile: fallback demo
  }

  createRoot(document.getElementById("root")).render(
    <App
      kcEnabled={kcEnabled}
      kcUsername={kcUsername}
      kcLogout={kcLogout}
      authMode={authMode}
    />
  );
}

bootstrap();
