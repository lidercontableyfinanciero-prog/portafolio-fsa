"""API del Portafolio Nacional + seguridad (roles, permisos por módulo, usuarios)."""

from __future__ import annotations

from tests.conftest import auth


def _login(client, username, password):
    r = client.post("/api/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_national_report_endpoint(client, lector_token):
    r = client.get("/api/national/report", headers=auth(lector_token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert round(body["kpis"]["total_value"], 2) == 8_710_191_750.48
    assert body["cut"]["label"] == "ago 2026"
    assert len(body["assets"]) == 15
    fic = client.get("/api/national/report?type=FIC", headers=auth(lector_token)).json()
    assert {a["asset_type"] for a in fic["assets"]} == {"FIC"}


def test_national_data_isolated_from_international(client, admin_token):
    intl = client.get("/api/portfolio/dashboard?year=2026&month=Agosto",
                      headers=auth(admin_token)).json()
    assert intl["kpis"]["n_posiciones"] == 63          # sin posiciones nacionales
    params = client.get("/api/parameters", headers=auth(admin_token)).json()["parameters"]
    assert not any(p["key"].startswith("nal_") for p in params)
    hist = client.get("/api/etl/history", headers=auth(admin_token)).json()["items"]
    assert all(not h["filename"].startswith("Base de Datos Portafolio") for h in hist)


def test_national_export_columns(client, admin_token):
    cols = client.get("/api/national/export/columns", headers=auth(admin_token)).json()
    assert {"name", "value_cut", "rent_ea"} <= {c["key"] for c in cols}
    r = client.get("/api/national/export/positions.xlsx?columns=name&columns=value_cut",
                   headers=auth(admin_token))
    assert r.status_code == 200 and r.content[:2] == b"PK"
    p = client.get("/api/national/export/positions.pdf", headers=auth(admin_token))
    assert p.status_code == 200 and p.content[:4] == b"%PDF"


def test_national_upload_validation(client, admin_token, lector_token):
    bad = ("Año,Mes,Entidad,Tipo de Inversión,Nombre de la Inversión,Valor\n"
           "2026,Enero,A,CDT,X,1\n").encode()
    files = {"file": ("bad.csv", bad, "text/csv")}
    r = client.post("/api/national/upload", files=files, headers=auth(admin_token))
    assert r.status_code == 422
    assert "Concepto del Movimiento" in r.json()["detail"]["message"]
    # el lector sin permiso de carga no puede importar
    r = client.post("/api/national/upload", files=files, headers=auth(lector_token))
    assert r.status_code == 403
    # un mes ya cargado se rechaza sin «reemplazar»
    ok = ("Año,Mes,Entidad,Tipo de Inversión,Nombre de la Inversión,"
          "Concepto del Movimiento,Valor\n2026,Agosto,A,CDT,X,Valor de Mercado,1\n").encode()
    r = client.post("/api/national/upload", files={"file": ("ok.csv", ok, "text/csv")},
                    headers=auth(admin_token))
    assert r.status_code == 409
    prev = client.post("/api/national/upload?dry_run=true",
                       files={"file": ("ok.csv", ok, "text/csv")}, headers=auth(admin_token))
    assert prev.status_code == 200 and prev.json()["new_assets"] == ["X"]


def test_catalog_and_ipc_edit_admin_only(client, admin_token, lector_token):
    name = "Deuda Corporativa"
    body = {"asset_type": "FIC", "group": "Cartera Colectiva (FIC)",
            "issuer": "FIC Deuda Corporativa", "entity": "Credicorp Capital",
            "low_liquidity": False, "benchmark": "IPC"}
    assert client.put(f"/api/national/catalog/{name}", json=body,
                      headers=auth(lector_token)).status_code == 403
    assert client.put(f"/api/national/catalog/{name}", json=body,
                      headers=auth(admin_token)).status_code == 200
    ipc = {"year": 2026, "month": 8, "ipc_ytd": 0.0535, "ipc_12m": 0.0624, "source": "DANE"}
    assert client.put("/api/national/ipc", json=ipc, headers=auth(lector_token)).status_code == 403
    assert client.put("/api/national/ipc", json=ipc, headers=auth(admin_token)).status_code == 200


def test_lector_cannot_manage_users(client, lector_token):
    assert client.get("/api/users", headers=auth(lector_token)).status_code == 403
    r = client.post("/api/users", json={"username": "HACK", "full_name": "x",
                                        "password": "123456"}, headers=auth(lector_token))
    assert r.status_code == 403
    assert client.post("/api/users/1/reset-password", json={"new_password": "abcdef"},
                       headers=auth(lector_token)).status_code == 403


def test_admin_user_lifecycle_and_module_permissions(client, admin_token):
    r = client.post("/api/users", json={
        "username": "lector_nal", "full_name": "Solo Nacional", "password": "secreto1",
        "can_view_international": False, "can_view_national": True,
    }, headers=auth(admin_token))
    assert r.status_code == 201, r.text
    uid = r.json()["id"]
    assert r.json()["username"] == "LECTOR_NAL"
    dup = client.post("/api/users", json={"username": "LECTOR_NAL", "full_name": "x",
                                          "password": "secreto1"}, headers=auth(admin_token))
    assert dup.status_code == 409

    tok = _login(client, "LECTOR_NAL", "secreto1")
    # backend: el módulo internacional queda bloqueado aunque se llame directo al endpoint
    assert client.get("/api/portfolio/dashboard", headers=auth(tok)).status_code == 403
    assert client.get("/api/export/positions.xlsx", headers=auth(tok)).status_code == 403
    assert client.get("/api/national/report", headers=auth(tok)).status_code == 200
    # el lector puede cambiar su propia contraseña
    ch = client.post("/api/auth/change-password",
                     json={"current_password": "secreto1", "new_password": "secreto2"},
                     headers=auth(tok))
    assert ch.status_code == 200

    # admin: restablece contraseña, cambia permisos y desactiva
    assert client.post(f"/api/users/{uid}/reset-password", json={"new_password": "nuevo123"},
                       headers=auth(admin_token)).status_code == 200
    tok = _login(client, "LECTOR_NAL", "nuevo123")
    client.patch(f"/api/users/{uid}", json={"can_view_national": False},
                 headers=auth(admin_token))
    assert client.get("/api/national/report", headers=auth(tok)).status_code == 403
    client.patch(f"/api/users/{uid}", json={"is_active": False}, headers=auth(admin_token))
    assert client.get("/api/auth/me", headers=auth(tok)).status_code == 401


def test_admin_cannot_lock_out_last_admin(client, admin_token):
    me = client.get("/api/auth/me", headers=auth(admin_token)).json()
    r = client.patch(f"/api/users/{me['id']}", json={"role": "lector"}, headers=auth(admin_token))
    assert r.status_code == 400
    r = client.patch(f"/api/users/{me['id']}", json={"is_active": False},
                     headers=auth(admin_token))
    assert r.status_code == 400


def test_session_idle_token_and_refresh(client, lector_token):
    """Sesión deslizante: el token dura SESSION_IDLE_MINUTES (60) y se renueva con actividad."""
    from datetime import UTC, datetime

    from app.core.security import create_access_token, decode_access_token

    exp = datetime.fromtimestamp(decode_access_token(lector_token)["exp"], UTC)
    minutes = (exp - datetime.now(UTC)).total_seconds() / 60
    assert 55 < minutes <= 60
    r = client.post("/api/auth/refresh", headers=auth(lector_token))
    assert r.status_code == 200 and r.json()["access_token"]
    assert client.post("/api/auth/refresh").status_code == 401
    expired = create_access_token("LECTOR1_FSA", "lector", expires_minutes=-1)
    assert client.post("/api/auth/refresh", headers=auth(expired)).status_code == 401
    assert client.get("/api/health").json()["status"] == "ok"
