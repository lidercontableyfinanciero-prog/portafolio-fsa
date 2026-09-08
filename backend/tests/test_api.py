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
    assert body["periods"] == ["2026-Septiembre"]
    assert body["existing_periods"] == []


def _csv(month: str, year: int = 2026, ident: str = "TESTX", mv: int = 1200) -> str:
    return (
        "Statement Year,Statement Month,Classification,Type,Description,Sector,"
        "Total Cost Basis,Estimated Market Value,Identifier\n"
        f"{year},{month},Renta Variable,Equity,PRUEBA SA,TECNOLOGIA,1000,{mv},{ident}\n"
    )


def test_etl_history_records_seed_and_uploads(client, admin_token, lector_token):
    # el seed deja un registro "Carga inicial"
    h = client.get("/api/etl/history", headers=auth(admin_token)).json()
    assert h["total"] >= 1
    assert any(x["uploaded_by"] == "seed" and x["status"] in ("success", "partial")
               for x in h["items"])
    # lector no puede ver el histórico
    assert client.get("/api/etl/history", headers=auth(lector_token)).status_code == 403


def test_etl_duplicate_month_is_rejected(client, admin_token):
    r = client.post(
        "/api/etl/upload",
        headers=auth(admin_token),
        files={"file": ("agosto.csv", _csv("Agosto"), "text/csv")},
    )
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert "ya fue cargado" in detail["message"]
    assert any(p["month"] == "Agosto" and p["year"] == 2026 for p in detail["existing_periods"])
    # queda registrado como conflicto en el histórico
    h = client.get("/api/etl/history", headers=auth(admin_token)).json()
    assert h["items"][0]["status"] == "conflict"


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


def test_slicer_grades_independent(client, admin_token):
    # DASHBOARD!K13/L13: Grado de Inversión (S&P) = 23 posiciones / 5.584.137,35
    r = client.get(
        "/api/portfolio/dashboard",
        params={"year": 2026, "month": "Agosto", "sp_grade": "Grado de Inversión"},
        headers=auth(admin_token),
    )
    k = r.json()["kpis"]
    assert k["n_posiciones"] == 23
    assert round(k["valor_mercado"], 2) == 5_584_137.35
    # Moody's independiente: en el extracto INFORME muchos bonos traen "***"/"WR<",
    # así que el grado de inversión Moody's es reducido (2 posiciones).
    r2 = client.get(
        "/api/portfolio/dashboard",
        params={"year": 2026, "month": "Agosto", "moodys_grade": "Grado de Inversión"},
        headers=auth(admin_token),
    )
    m_inv = r2.json()["kpis"]["n_posiciones"]
    assert m_inv == 2
    # ambos a la vez: Moody's IG (2) ∩ S&P IG (23) -> como mucho 2
    r3 = client.get(
        "/api/portfolio/dashboard",
        params={
            "year": 2026, "month": "Agosto",
            "moodys_grade": "Grado de Inversión", "sp_grade": "Grado de Inversión",
        },
        headers=auth(admin_token),
    )
    assert 0 <= r3.json()["kpis"]["n_posiciones"] <= 2


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


def test_dashboard_risk_alerts(client, lector_token):
    d = client.get(
        "/api/portfolio/dashboard?year=2026&month=Agosto", headers=auth(lector_token)
    ).json()
    for panel in ("alerta_tiempo", "alerta_emisor", "limite_cash", "stop_loss"):
        assert panel in d and isinstance(d[panel], list)
    ra = d["risk_alerts"]
    assert ra["vencimientos_1a_posiciones"] >= 0
    assert ra["plazo_prom_vencimiento_bonos"] > 0        # hay bonos
    # coherencia: la suma de posiciones de stop_loss = N° de posiciones
    assert sum(r["posiciones"] for r in d["stop_loss"]) == d["kpis"]["n_posiciones"]


def test_limite_cash_solo_contempla_efectivo(client, admin_token):
    d = client.get(
        "/api/portfolio/dashboard?year=2026&month=Agosto", headers=auth(admin_token)
    ).json()
    # Solo 1 posición de tipo Cash -> el panel de límite de caja suma 1 posición
    assert sum(r["posiciones"] for r in d["limite_cash"]) == 1


def test_concentracion_politica_rf_rv(client, admin_token):
    d = client.get(
        "/api/portfolio/dashboard?year=2026&month=Agosto", headers=auth(admin_token)
    ).json()
    lims = {c["label"]: c for c in d["limites_concentracion"]}
    assert lims["Renta Fija"]["limite"] == 0.70
    assert lims["Renta Variable"]["limite"] == 0.30
    # Renta Fija ~67,66 % de participación (DASHBOARD) -> cumple el 70 %
    assert 0.6 < lims["Renta Fija"]["participacion"] < 0.72
    assert lims["Renta Fija"]["cumple"] is True


def test_variacion_vs_mes_anterior(client, lector_token):
    d = client.get(
        "/api/portfolio/dashboard?year=2026&month=Agosto", headers=auth(lector_token)
    ).json()
    v = d["variacion_portafolio"]
    assert v["mes_anterior"] == "jul 2026"
    assert round(v["valor_actual"], 2) == 13_975_106.05      # Resumen!K17
    assert round(v["valor_anterior"], 2) == 13_773_343.30    # Resumen!J17
    assert round(v["variacion_pct"], 6) == round(201_762.75 / 13_773_343.30, 6)
    # por_tipo trae la variación mes a mes
    bond = next(r for r in d["por_tipo"] if r["label"] == "Bond")
    assert bond["variacion_abs"] is not None


def test_evolution_matches_resumen(client, admin_token):
    evo = client.get("/api/portfolio/evolution", headers=auth(admin_token)).json()
    by = {e["label"]: e["valor_informe"] for e in evo}
    assert round(by["dic 2025"], 2) == 13_498_803.48
    assert round(by["jul 2026"], 2) == 13_773_343.30
    assert round(by["ago 2026"], 2) == 13_975_106.05
    assert len(evo) == 9


def test_position_history_endpoint(client, admin_token):
    # NVIDIA se reconcilia al ticker NVDA (varios meses con y sin CUSIP en el extracto)
    r = client.get("/api/positions/NVDA/history", headers=auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert body["identifier"] == "NVDA"
    assert len(body["points"]) >= 6          # tiene historia multi-mes
    p = body["points"][-1]
    assert "market_value" in p and "current_yield" in p
    assert body["points"] == sorted(body["points"], key=lambda x: (x["year"], x["month_index"]))
    # 404 para un id inexistente
    assert client.get(
        "/api/positions/NOEXISTE123/history", headers=auth(admin_token)
    ).status_code == 404


def test_equity_reconciled_across_months(client, admin_token):
    """Una acción sin CUSIP en agosto no debe fragmentarse: NVDA vive en varios meses."""
    r = client.get("/api/positions/NVDA/history", headers=auth(admin_token)).json()
    months = {p["month"] for p in r["points"]}
    assert {"Julio", "Agosto"} <= months


def test_positions_new_columns(client, lector_token):
    r = client.get(
        "/api/positions?year=2026&month=Agosto&classification=Renta Variable&page_size=5",
        headers=auth(lector_token),
    )
    item = r.json()["items"][0]
    for f in ("dividends_paid", "tax", "tax_rate", "current_yield",
              "equity_return_on_cost", "equity_market_value_return",
              "moodys_rating", "sp_rating"):
        assert f in item


# --------------------------------------------------------------------------- #
# Exportación (Excel / PDF)
# --------------------------------------------------------------------------- #
_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_exports_for_both_roles(client, admin_token, lector_token):
    cases = [
        ("/api/export/positions.xlsx", _XLSX, b"PK"),           # zip -> "PK"
        ("/api/export/dashboard.xlsx", _XLSX, b"PK"),
        ("/api/export/positions.pdf", "application/pdf", b"%PDF"),
        ("/api/export/dashboard.pdf", "application/pdf", b"%PDF"),
    ]
    for token in (admin_token, lector_token):
        for path, ctype, magic in cases:
            r = client.get(f"{path}?year=2026&month=Agosto", headers=auth(token))
            assert r.status_code == 200, f"{path}: {r.text[:200]}"
            assert r.headers["content-type"].startswith(ctype)
            assert "attachment" in r.headers.get("content-disposition", "")
            assert r.content[:4].startswith(magic)
            assert len(r.content) > 800


def test_export_respects_filters(client, admin_token):
    full = client.get("/api/export/positions.pdf?year=2026&month=Agosto",
                      headers=auth(admin_token))
    filt = client.get(
        "/api/export/positions.pdf?year=2026&month=Agosto&type=Bond",
        headers=auth(admin_token),
    )
    assert full.status_code == filt.status_code == 200
    # el PDF filtrado (menos filas) debe pesar menos
    assert len(filt.content) < len(full.content)


def test_export_requires_auth(client):
    assert client.get("/api/export/dashboard.xlsx").status_code == 401


# --------------------------------------------------------------------------- #
# ZZ: mutan datos (nuevos meses) — deben ir al final para no afectar a los
# tests que consultan "el período más reciente".
# --------------------------------------------------------------------------- #
def test_zz_new_month_then_replace(client, admin_token):
    # 1) mes nuevo -> se carga
    r1 = client.post(
        "/api/etl/upload",
        headers=auth(admin_token),
        files={"file": ("marzo2027.csv", _csv("Marzo", 2027, "NEWMAR", 1500), "text/csv")},
    )
    assert r1.status_code == 200
    assert r1.json()["status"] == "success"
    assert r1.json()["snapshots_inserted"] == 1

    # 2) mismo mes sin replace -> 409
    r2 = client.post(
        "/api/etl/upload",
        headers=auth(admin_token),
        files={"file": ("marzo2027.csv", _csv("Marzo", 2027, "NEWMAR", 1500), "text/csv")},
    )
    assert r2.status_code == 409

    # 3) mismo mes con replace -> reemplaza (borra el anterior, inserta de nuevo)
    r3 = client.post(
        "/api/etl/upload?replace=true",
        headers=auth(admin_token),
        files={"file": ("marzo2027b.csv", _csv("Marzo", 2027, "NEWMAR2", 1600), "text/csv")},
    )
    assert r3.status_code == 200
    body = r3.json()
    assert body["snapshots_deleted"] == 1
    assert body["snapshots_inserted"] == 1
    assert body["status"] == "success"

    # el período Marzo 2027 tiene exactamente 1 registro (no se duplicó)
    pos = client.get(
        "/api/positions",
        params={"year": 2027, "month": "Marzo", "page_size": 10},
        headers=auth(admin_token),
    ).json()
    assert pos["total"] == 1
    assert pos["items"][0]["identifier"] == "NEWMAR2"

    # el histórico refleja las 3 operaciones (2 success + 1 conflict) sobre marzo2027
    h = client.get("/api/etl/history", headers=auth(admin_token)).json()
    mar = [x for x in h["items"] if "2027-Marzo" in x["periods"]]
    assert {x["status"] for x in mar} == {"success", "conflict"}
    assert any(x["snapshots_deleted"] == 1 for x in mar)
