"""Verifica JWT emessi da Keycloak. Usato quando KC_AUTH_ENABLED=true.
La chiave pubblica viene recuperata via JWKS e cachata per 5 minuti."""
import time

import httpx
from jose import JWTError, jwt

from .config import settings
from . import reference as R

_cache: dict = {"keys": None, "ts": 0.0}
_JWKS_TTL = 300  # 5 min


def _jwks() -> dict:
    now = time.monotonic()
    if _cache["keys"] and (now - _cache["ts"]) < _JWKS_TTL:
        return _cache["keys"]
    url = f"{settings.KC_INTERNAL_URL}/realms/{settings.KC_REALM}/protocol/openid-connect/certs"
    try:
        r = httpx.get(url, timeout=5)
        r.raise_for_status()
        _cache["keys"] = r.json()
        _cache["ts"] = now
        return _cache["keys"]
    except Exception as e:
        raise RuntimeError(f"JWKS non raggiungibile ({url}): {e}")


def verify_token(token: str) -> dict:
    """Verifica firma, scadenza, issuer e azp del JWT."""
    keys = _jwks()
    issuer = f"{settings.KC_INTERNAL_URL}/realms/{settings.KC_REALM}"
    claims = jwt.decode(
        token, keys,
        algorithms=["RS256"],
        options={"verify_aud": False},  # audience gestita via azp
        issuer=issuer,
    )
    # Verifica che il token sia destinato a questo client
    azp = claims.get("azp") or claims.get("client_id") or ""
    if azp and settings.KC_CLIENT_ID and azp != settings.KC_CLIENT_ID:
        raise JWTError(f"Token non destinato a questo client (azp={azp})")
    return claims


def username_from_token(token: str) -> str | None:
    """Estrae preferred_username dal JWT. None se il token non è valido."""
    try:
        claims = verify_token(token)
        return claims.get("preferred_username")
    except (JWTError, RuntimeError, Exception):
        return None


def user_context_from_token(token: str) -> dict | None:
    """Deriva il profilo utente completo dai claims JWT (nome, ruolo, permessi).
    Usato per utenti Keycloak non ancora in R.USERS."""
    try:
        claims = verify_token(token)
    except Exception:
        return None

    username = claims.get("preferred_username", "")
    if not username:
        return None

    # Cerca il primo ruolo di piattaforma tra i realm_roles del token
    realm_roles: list = claims.get("realm_access", {}).get("roles", [])
    kc_role = next((r for r in realm_roles if r in R.KC_ROLE_PERM), None)
    perm = R.KC_ROLE_PERM.get(kc_role, {})

    given = claims.get("given_name", "")
    family = claims.get("family_name", "")
    nome = f"{given} {family}".strip() or username
    iniz = ((given[:1] + family[:1]).upper() or username[:2].upper())

    return {
        "id": username,
        "nome": nome,
        "ruolo": R.KC_ROLE_DISPLAY.get(kc_role, "Utente"),
        "ufficio": "",
        "iniz": iniz,
        "col": "#0066cc",
        "email": claims.get("email", ""),
        "perm": perm,
    }
