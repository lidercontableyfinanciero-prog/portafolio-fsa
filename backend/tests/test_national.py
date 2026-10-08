"""Portafolio Nacional: motor de cálculo cotejado contra el libro
`2. INFORME INVERSIONES NACIONALES FSA 2026.xlsx` (corte agosto-2026)."""

from __future__ import annotations

import pytest

from app.core.config import settings
from app.db.national_seed_data import NATIONAL_ASSETS, NATIONAL_IPC
from app.services.national import Asset, Filters, Ipc, Params, build_report
from app.services.national_etl import parse_national

NAL = settings.seed_dir_path / settings.seed_national_file


@pytest.fixture(scope="module")
def report():
    if not NAL.exists():
        pytest.skip("Base nacional de Referencias/ no disponible")
    parsed = parse_national(NAL.read_bytes(), NAL.name)
    assert parsed.ok, parsed.errors[:3]
    assets = {a[0]: Asset(*a) for a in NATIONAL_ASSETS}
    ipc = {(y, m): Ipc(a, b) for y, m, a, b, _ in NATIONAL_IPC}
    params = Params(
        coupons_as_returns_from=(2026, 7), split_parent="CDT Davivienda 1",
        split_child="CDT Davivienda 2", split_until=(2026, 6),
    )
    return lambda **kw: build_report(parsed.movements, assets, ipc, params, **kw)


def test_dashboard_kpis_match_excel(report):
    k = report()["kpis"]
    assert round(k["total_value"], 2) == 8_710_191_750.48        # Dashboard!E7
    assert round(k["paid_income"], 2) == 737_929_429.53          # Dashboard!B7
    assert round(k["mom_pct"], 6) == 0.064882                    # Dashboard!J7
    assert round(k["mom_abs"], 2) == 530_698_988.87              # Dashboard!E9
    assert round(k["rent_ea"], 6) == 0.088426                    # Dashboard!O7
    assert round(k["rent_period"], 6) == 0.058115                # Dashboard!O9
    assert round(k["benchmark_ea"], 5) == 0.10294                # Dashboard!S7
    assert round(k["diff_vs_benchmark"], 6) == -0.014514         # Dashboard!S9


def test_allocation_and_limits(report):
    r = report()
    alloc = {a["type"]: round(a["value"], 2) for a in r["allocation"]}
    assert alloc == {"CDT": 5_084_385_000.0, "FIC": 2_137_974_750.17,
                     "FCP": 996_592_250.31, "Bono": 491_239_750.0}
    lim = {x["key"]: x for x in r["limits"]}
    assert round(lim["baja_liquidez"]["value"], 6) == 0.203458   # Alertas!C6
    assert round(lim["emisor"]["value"], 6) == 0.234824          # Alertas!C7
    assert round(lim["plazo"]["value"], 5) == 3.89863            # Alertas!C8
    assert all(x["status"] == "Excede límite" for x in r["limits"])


def test_returns_by_group(report):
    g = {x["label"]: x for x in report()["returns_by_group"]}
    assert round(g["Cartera Colectiva (FIC)"]["rent_ea"], 6) == 0.084146     # Rentabilidad!G23
    assert round(g["Cartera Colectiva (FIC)"]["benchmark_ea"], 6) == 0.094288
    assert round(g["Renta Fija (CDT + Bono)"]["return"], 2) == 422_996_250.0
    assert round(g["Futuro Inmobiliario / FCP"]["rent_ea"], 6) == 0.087186


def test_asset_valuation_and_alerts(report):
    a = {x.name: x for x in report()["assets"]}
    # Valoracion!Q15 (FIC por saldo) y reparto Davivienda (MtM)
    assert round(a["Credicorp Capital Alta Liquidez"].value_cut, 2) == 1_355_452_040.91
    assert round(a["CDT Davivienda 2"].values["dic 2025"], 2) == 526_410_300.0
    assert a["CDT Banco de Bogotá"].classification == "En seguimiento"
    assert a["CDT Banco de Bogotá"].observation == "Cupón inferior a IPC + spread"
    assert a["CDT Bancolombia"].st_term == "Crítico"
    assert a["CDTs Banco Popular"].classification == "Sobresaliente"
    assert a["CDT BBVA Colombia S.A."].classification == "Cerrado"
    counts = report()["kpis"]["classification_counts"]
    assert counts == {"En riesgo": 6, "En seguimiento": 2, "Sobresaliente": 3,
                      "Normal": 2, "Cerrado": 2}                  # Dashboard!B35


def test_trend_and_cut_selection(report):
    t = report()["trend"]
    assert t[0]["period"] == "dic 2025" and t[0]["cum_return"] == 0
    assert round(t[-1]["cum_benchmark"], 4) == 0.0675            # Rentabilidad!G66
    assert round(t[1]["cum_return"], 6) == -0.01236              # Rentabilidad!F59
    junio = report(cut=(2026, 6))
    assert junio["cut"]["label"] == "jun 2026"
    assert round(junio["kpis"]["total_value"], 2) == 10_481_313_114.77  # Valoracion!N27


def test_filters_only_narrow_aggregates(report):
    full = report()
    fic = report(filters=Filters(asset_type={"FIC"}))
    assert {x.asset_type for x in fic["assets"]} == {"FIC"}
    assert round(fic["kpis"]["total_value"], 2) == 2_137_974_750.17
    # los límites del Reglamento siguen siendo del portafolio total
    assert fic["limits"] == full["limits"]
    assert fic["returns_total"]["label"] == "Selección filtrada"


def test_import_rejects_bad_structure():
    res = parse_national(b"", "x.xlsx")
    assert not res.ok and res.errors
    csv = "Año,Mes,Entidad,Tipo de Inversión,Nombre de la Inversión,Valor\n2026,Enero,A,CDT,X,1\n"
    res = parse_national(csv.encode(), "x.csv")
    assert res.missing_columns == ["Concepto del Movimiento"]
    csv = ("Año,Mes,Entidad,Tipo de Inversión,Nombre de la Inversión,"
           "Concepto del Movimiento,Valor,Fecha de Vencimiento\n"
           "2026,Enero,A,CDT,X,Valor de Mercado,abc,01/02/2027\n"
           "2026,Mesx,A,CDT,X,Valor de Mercado,10,32/13/2027\n")
    res = parse_national(csv.encode(), "x.csv")
    assert len(res.errors) == 2 and not res.ok
    assert "no numérico" in res.errors[0]["error"]
    assert "Mes inválido" in res.errors[1]["error"] and "fecha inválida" in res.errors[1]["error"]
