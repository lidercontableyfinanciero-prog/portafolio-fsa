"""Pruebas de integración de la API sobre datos reales del Excel.

Los valores esperados provienen de la hoja `DASHBOARD` del libro de referencia
(período Agosto 2026).
"""

from __future__ import annotations

import pytest

from tests.conftest import auth

pytestmark = pytest.mark.usefixtures("client")


# --------------------------------------------------------------------------- #
# Auth y control de acceso
# --------------------------------------------------------------------------- #
def test_login_bad_password(client):
    r = client.post("/api/auth/login", data={"username": "admin@fundacionsanantonio.org", "password": "x"})
    assert r.status_code == 401


def test_me_returns_role(client, admin_token, lector_token):
    assert client.get("/api/auth/me", headers=auth(admin_token)).json()["role"] == "admin"
    assert client.get("/api/auth/me", headers=auth(lector_token)).json()["role"] == "lector"


def test_dashboard_requires_auth(client):
    assert client.get("/api/portfolio/dashboard").status_code == 401


def test_etl_upload_forbidden_for_lector(client, lector_token):
    r = client.post("/api/etl/upload", headers=auth(lector_token), files={})
    assert r.status_code in (403, 422)  # 403 por rol antes de validar el archivo


def test_etl_upload_dry_run_admin(client, admin_token):
    csv = (
        "Statement Year,Statement Month,Classification,Type,Description,Sector,"
        "Total Cost Basis,Estimated Market Value,Identifier,Unnamed: 9\n"
        "2026,Septiembre,Renta Variable,Equity,PRUEBA SA,TECNOLOGIA,1000,1200,TEST123,\n"
    )
    r = client.post(
        "/api/etl/upload?dry_run=true",
        headers=auth(admin_token),
        files={"file": ("x.csv", csv, "text/csv")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["valid_rows"] == 1
    assert "Unnamed: 9" in body["ignored_columns"]
    assert body["dry_run"] is True


# --------------------------------------------------------------------------- #
# Dashboard: cifras contra el Excel
# --------------------------------------------------------------------------- #
def test_dashboard_kpis_match_excel(client, lector_token):
    r = client.get(
        "/api/portfolio/dashboard?year=2026&month=Agosto", headers=auth(lector_token)
    )
    assert r.status_code == 200
    k = r.json()["kpis"]
    assert round(k["costo_total"], 2) == 13_631_136.30      # DASHBOARD!A9
    assert round(k["valor_mercado"], 2) == 13_821_554.40    # DASHBOARD!B9
    assert round(k["gp_no_realizada"], 2) == 121_429.45     # DASHBOARD!C9
    assert round(k["rentab_sobre_costo"], 4) == 0.0089      # DASHBOARD!D9
    assert k["n_posiciones"] == 63                          # DASHBOARD!H9


def test_dashboard_breakdown_by_classification(client, admin_token):
    r = client.get(
        "/api/portfolio/dashboard?year=2026&month=Agosto", headers=auth(admin_token)
    )
    rows = {x["label"]: x for x in r.json()["por_clasificacion"]}
    assert round(rows["Renta Variable"]["valor_mercado"], 2) == 4_400_309.67
    assert round(rows["Money Accounts"]["valor_mercado"], 2) == 68_988.65
    assert sum(x["pct_participacion"] for x in rows.values()) == pytest.approx(1.0, abs=1e-6)


def test_slicer_bond_investment_grade_sp(client, admin_token):
    # DASHBOARD!K13/L13: Grado de Inversión (S&P) = 23 posiciones / 5.584.137,35
    r = client.get(
        "/api/portfolio/dashboard",
        params={
            "year": 2026,
            "month": "Agosto",
            "type": "Bond",
            "rating_grade": "Grado de Inversión",
            "rating_agency": "sp",
        },
        headers=auth(admin_token),
    )
    k = r.json()["kpis"]
    assert k["n_posiciones"] == 23
    assert round(k["valor_mercado"], 2) == 5_584_137.35


def test_periods_and_evolution(client, admin_token):
    periods = client.get("/api/portfolio/periods", headers=auth(admin_token)).json()
    assert [p["label"] for p in periods][-1] == "ago 2026"
    evo = client.get("/api/portfolio/evolution", headers=auth(admin_token)).json()
    last = evo[-1]
    assert round(last["valor_informe"], 2) == 13_975_106.05   # Resumen!K17


# --------------------------------------------------------------------------- #
# Posiciones / escenarios / FX / rentabilidad
# --------------------------------------------------------------------------- #
def test_positions_pagination_and_sort(client, lector_token):
    r = client.get(
        "/api/positions",
        params={"year": 2026, "month": "Agosto", "page": 1, "page_size": 5,
                "sort_by": "unrealized_gain_loss", "sort_dir": "asc"},
        headers=auth(lector_token),
    )
    body = r.json()
    assert body["total"] == 63
    assert len(body["items"]) == 5
    gl = [i["unrealized_gain_loss"] for i in body["items"]]
    assert gl == sorted(gl)  # ascendente: las mayores pérdidas primero


def test_scenarios_endpoint(client, admin_token):
    assets = client.get(
        "/api/scenarios/assets", params={"year": 2026, "month": "Agosto"},
        headers=auth(admin_token),
    ).json()
    assert assets and len({a["identifier"] for a in assets}) == len(assets)  # sin duplicados
    target = assets[0]["identifier"]
    r = client.post(
        "/api/scenarios",
        json={"identifier": target, "month": "Agosto", "year": 2026,
              "pct_sales": [0.5, 1.0]},
        headers=auth(admin_token),
    )
    assert r.status_code == 200
    sc = r.json()["scenarios"]
    assert len(sc) == 2
    assert all("roi" in s and "irr" in s for s in sc)


def test_fx_simulator_control_check_zero(client, lector_token):
    r = client.post(
        "/api/fx-simulator",
        json={"gross_sale_usd": 120000, "sale_commission_usd": 1200,
              "purchase_cost_usd": 100000, "trm_purchase": 3800, "trm_sale": 4000},
        headers=auth(lector_token),
    )
    res = r.json()["result"]
    assert res["control_check"] == 0.0
    assert res["accumulated_fx_difference"] == 100000 * (4000 - 3800)


def test_twr_endpoint(client, admin_token):
    r = client.get("/api/returns/twr", headers=auth(admin_token))
    body = r.json()
    assert len(body["rows"]) == 8
    ago = body["rows"][-1]
    assert ago["month_name"] == "Agosto"
    assert round(ago["portfolio_return"], 4) == 0.0146   # Dietz agosto ~ 1,46 %
