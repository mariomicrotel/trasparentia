import Keycloak from "keycloak-js";

let _kc = null;

export async function initKeycloak(config) {
  _kc = new Keycloak({
    url: config.url,
    realm: config.realm,
    clientId: config.clientId,
  });
  await _kc.init({
    onLoad: "login-required",
    pkceMethod: "S256",
    checkLoginIframe: false,  // evita problemi cross-origin con cookie SameSite
  });
  // Refresh automatico: rinnova il token quando mancano meno di 30s alla scadenza
  setInterval(() => {
    _kc.updateToken(30).catch(() => _kc.login());
  }, 20_000);
}

export async function getTokenFreshly() {
  if (!_kc || !_kc.authenticated) return null;
  try {
    await _kc.updateToken(30);
    return _kc.token;
  } catch {
    // Token scaduto e non rinnovabile: forza nuovo login
    _kc.login();
    return null;
  }
}

export function getUsername() {
  return _kc?.tokenParsed?.preferred_username ?? null;
}

export function getUserDisplayName() {
  if (!_kc?.tokenParsed) return null;
  const t = _kc.tokenParsed;
  return [t.given_name, t.family_name].filter(Boolean).join(" ") || t.preferred_username;
}

export function doLogout() {
  return _kc?.logout({ redirectUri: window.location.origin });
}
