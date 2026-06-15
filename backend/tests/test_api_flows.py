"""Suite di smoke test sui flussi critici di TrasParentIA Micro PA.

Eseguire con:
    cd platform/backend
    pip install -r requirements-dev.txt
    pytest tests/ -v

Prerequisiti: nessun servizio esterno richiesto — DB SQLite in-memory,
pgvector patchato, MinIO/Redis/Keycloak non necessari.
"""
import io

import pytest


# ── infrastruttura ──────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "TrasParentIA" in r.json().get("name", "")


# ── auth ─────────────────────────────────────────────────────────────────────

def test_auth_config_disabled(client):
    r = client.get("/api/auth/config")
    assert r.status_code == 200
    assert r.json()["enabled"] is False


def test_unauth_rejected(client):
    # /api/backup richiede autenticazione + permesso: senza header X-Role va respinto.
    # (cruscotto e le liste principali sono letture pubbliche by-design.)
    r = client.get("/api/backup")
    assert r.status_code in (400, 401, 403)


def test_me(client, hdr):
    r = client.get("/api/me", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert "id" in body
    assert "perm" in body


# ── meta / riferimenti ───────────────────────────────────────────────────────

def test_meta(client, hdr):
    r = client.get("/api/meta", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert "users" in body
    assert "cat" in body  # categorie documentali


def test_meta_uffici_e_routing(client, hdr):
    # Il meta espone il catalogo uffici (con procedimenti) e la mappa categoria→ufficio.
    body = client.get("/api/meta", headers=hdr).json()
    uffici = body.get("uffici", {})
    assert {"segreteria", "tecnico", "tributi", "demografici", "vigilanza", "sociali"} <= set(uffici)
    # ogni ufficio ha categorie e procedimenti con termine/atto finale
    for u in uffici.values():
        assert u["categorie"] and u["procedimenti"]
        assert all("termineGiorni" in p and "attoFinale" in p for p in u["procedimenti"])
    # instradamento di default coerente
    cat_uff = body.get("catUfficio", {})
    assert cat_uff.get("richiesta_tributi") == "Ragioneria / Tributi"
    assert cat_uff.get("richiesta_anagrafica") == "Anagrafe e Stato Civile"


# ── cruscotto ────────────────────────────────────────────────────────────────

def test_cruscotto(client, hdr):
    r = client.get("/api/cruscotto", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert "daLavorare" in body
    assert "inRitardo" in body


# ── liste principali ─────────────────────────────────────────────────────────

def test_comunicazioni_list(client, hdr):
    r = client.get("/api/comunicazioni", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert "items" in body or isinstance(body, list)


def test_pratiche_list(client, hdr):
    r = client.get("/api/pratiche", headers=hdr)
    assert r.status_code == 200


def test_pratica_dettaglio_id_con_slash(client):
    # Regressione: gli ID pratica contengono slash (es. "UT/001"). La route deve usare
    # il converter {pid:path} altrimenti Starlette decodifica %2F e va in 404.
    r = client.get("/api/pratiche/UT%2F001")
    assert r.status_code == 200
    assert r.json()["id"] == "UT/001"


def test_atti_list(client, hdr):
    r = client.get("/api/atti", headers=hdr)
    assert r.status_code == 200


def test_beni_list(client, hdr):
    r = client.get("/api/beni", headers=hdr)
    assert r.status_code == 200


# ── import lotti ─────────────────────────────────────────────────────────────

def test_import_lotti(client):
    # /api/import/lotti richiede il permesso 'classifica' (operatore protocollo),
    # che il segretario non possiede: si usa il ruolo operativo 'rossi'.
    r = client.get("/api/import/lotti", headers={"X-Role": "rossi"})
    assert r.status_code == 200


def test_import_lotti_negato_a_segretario(client, hdr):
    # Verifica il gating RBAC: il segretario (solo supervisione) non può classificare.
    r = client.get("/api/import/lotti", headers=hdr)
    assert r.status_code == 403


# ── golden set ───────────────────────────────────────────────────────────────

def test_golden_set_campione(client, hdr):
    r = client.get("/api/golden-set/campione?n=10", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert "campione" in body


def test_golden_set_valuta_empty(client, hdr):
    r = client.post(
        "/api/golden-set/valuta",
        json={"campione": []},
        headers=hdr,
    )
    assert r.status_code in (400, 422)


def test_golden_set_valuta_sample(client, hdr):
    campione_r = client.get("/api/golden-set/campione?n=10", headers=hdr)
    items = campione_r.json().get("campione", [])
    if not items:
        pytest.skip("Nessun campione disponibile — seed insufficiente")
    payload = {
        "campione": [
            {"id": items[0]["id"], "categoria_corretta": items[0].get("ai_categoria", "accesso_atti")}
        ]
    }
    r = client.post("/api/golden-set/valuta", json=payload, headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert "accuratezza_pct" in body


# ── beni CSV import ───────────────────────────────────────────────────────────

def test_beni_import_csv_valido(client, hdr):
    csv_content = (
        "tipo,categoria,denominazione,ubicazione,codice,stato\n"
        "immobile,edificio_pubblico,Municipio Test,Piazza del Comune 1,IM-TEST-001,buono\n"
    )
    r = client.post(
        "/api/beni/import-csv",
        files={"file": ("beni.csv", io.BytesIO(csv_content.encode()), "text/csv")},
        headers=hdr,
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("importati", 0) >= 1


def test_beni_import_csv_mancante_campo(client, hdr):
    csv_content = "tipo,categoria\nimmobile,edificio_pubblico\n"
    r = client.post(
        "/api/beni/import-csv",
        files={"file": ("beni.csv", io.BytesIO(csv_content.encode()), "text/csv")},
        headers=hdr,
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get("errori", 0) >= 1 or body.get("importati", 0) == 0


# ── integrazione ─────────────────────────────────────────────────────────────

def test_integrazione_albo_test(client, hdr):
    r = client.post("/api/integrazione/albo/test", headers=hdr)
    assert r.status_code == 200
    body = r.json()
    assert "ok" in body


def test_integrazione_protocollo_test(client, hdr):
    r = client.post("/api/integrazione/protocollo/test", headers=hdr)
    assert r.status_code == 200
    assert "ok" in r.json()


# ── diagnostica e backup ──────────────────────────────────────────────────────

def test_diagnostica(client, hdr):
    r = client.get("/api/diagnostica", headers=hdr)
    assert r.status_code == 200


def test_backup_elenco(client, hdr):
    r = client.get("/api/backup", headers=hdr)
    assert r.status_code == 200
    assert "backup" in r.json()
