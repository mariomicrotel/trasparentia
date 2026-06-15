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

async function bootstrap() {
  let kcEnabled = false;
  let kcUsername = null;
  let kcLogout = null;

  try {
    const r = await fetch("/api/auth/config");
    if (r.ok) {
      const cfg = await r.json();
      if (cfg.enabled) {
        const { initKeycloak, getTokenFreshly, getUsername, doLogout } = await import("./keycloak.js");
        await initKeycloak(cfg);
        setTokenProvider(getTokenFreshly);
        kcEnabled = true;
        kcUsername = getUsername();
        kcLogout = doLogout;
      }
    }
  } catch {
    // KC non raggiungibile o disabilitato: modalità demo role-switch
  }

  createRoot(document.getElementById("root")).render(
    <App kcEnabled={kcEnabled} kcUsername={kcUsername} kcLogout={kcLogout} />
  );
}

bootstrap();
