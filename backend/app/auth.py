"""Autenticazione: JWT Keycloak (KC_AUTH_ENABLED=true) e JWT locale nativo (NATIVE_AUTH_ENABLED=true)."""
import time
from datetime import datetime, timedelta, timezone

import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings
from . import reference as R

# ── Auth nativa: password hashing + JWT HS256 ──────────────────────────────
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_NATIVE_ISSUER = "trasparentia-local"


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd.verify(plain, hashed)
    except Exception:
        return False


def create_local_token(username: str) -> str:
    """Crea un JWT HS256 firmato localmente con scadenza configurabile."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": username, "exp": expire, "iss": _NATIVE_ISSUER}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm="HS256")


def username_from_local_token(token: str) -> str | None:
    """Verifica un JWT locale e restituisce lo username, None se non valido/scaduto."""
    try:
        claims = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"],
                            options={"verify_aud": False})
        if claims.get("iss") != _NATIVE_ISSUER:
            return None
        return claims.get("sub")
    except Exception:
        return None

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
