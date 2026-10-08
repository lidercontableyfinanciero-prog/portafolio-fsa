from app.services.aggregations import build_dashboard, compute_kpis, filter_positions
from app.services.valuation import PositionInput, compute_position


def _sample() -> list:
    raw = [
        PositionInput(identifier="A", description="Bono A", classification="Renta Fija",
                      type="Bond", sector="FINANCIERO", sp_rating="BBB",
                      total_cost_basis=100_000, estimated_market_value=95_000,
                      accrued_interest=1_000, annual_income=5_000),
        PositionInput(identifier="B", description="Accion B", classification="Renta Variable",
                      type="Equity", sector="TECNOLOGIA", sp_rating="BB",
                      total_cost_basis=50_000, estimated_market_value=70_000,
                      annual_income=800),
        PositionInput(identifier="C", description="Cash", classification="Money Accounts",
                      type="Cash", estimated_market_value=10_000, quantity=10_000),
    ]
    return [compute_position(p) for p in raw]


def test_kpis():
    k = compute_kpis(_sample())
    assert k.costo_total == 150_000
    assert k.valor_mercado == 175_000
    # A: 95k-100k = -5k ; B: 70k-50k = +20k ; C (Efectivo, sin costo): 0
    assert k.gp_no_realizada == 15_000
    assert round(k.rentab_sobre_costo, 6) == round(15_000 / 150_000, 6)
    assert k.n_posiciones == 3


def test_filter_by_rating_grade_independent():
    # A (Bono, S&P BBB) -> Grado de Inversión. B (acción) y C (Cash) NO son bonos:
    # su KPI crediticio es "N/A" aunque traigan calificación.
    inv = filter_positions(_sample(), sp_grade="Grado de Inversión")
    assert {p.identifier for p in inv} == {"A"}
    spec = filter_positions(_sample(), sp_grade="Grado Especulativo")
    assert spec == []
    # Moody's y S&P se pueden combinar (independientes y simultáneos)
    both = filter_positions(
        _sample(), moodys_grade="Sin calificación", sp_grade="Grado de Inversión"
    )
    assert {p.identifier for p in both} == {"A"}


def test_credit_panels_only_count_bonds():
    payload = build_dashboard(_sample())
    for rows in (payload.calidad_moodys, payload.calidad_sp):
        assert sum(r.posiciones for r in rows) == 1          # solo el bono A
        assert abs(sum(r.pct_participacion for r in rows) - 1.0) < 1e-9  # % sobre bonos
    assert payload.calidad_universo.posiciones == 1
    assert payload.calidad_universo.valor_mercado == 95_000


def test_alert_detail_matches_counter():
    from datetime import date

    from app.services.aggregations import alert_detail

    hoy = date(2026, 10, 8)
    raw = [
        PositionInput(identifier="X", description="Bono corto", type="Bond",
                      maturity_date=date(2027, 3, 15), estimated_market_value=100),
        PositionInput(identifier="Y", description="Bono largo", type="Bond",
                      maturity_date=date(2030, 12, 10), estimated_market_value=200),
        PositionInput(identifier="Z", description="Accion", type="Equity",
                      estimated_market_value=300),
    ]
    pos = [compute_position(p, as_of=hoy) for p in raw]
    ra = build_dashboard(pos).risk_alerts

    venc = alert_detail(pos, "vencimientos_1a")
    assert [i["identifier"] for i in venc["items"]] == ["X"]
    assert venc["summary"]["posiciones"] == ra.vencimientos_1a_posiciones == 1

    plazo = alert_detail(pos, "plazo_prom_vencimiento")
    assert {i["identifier"] for i in plazo["items"]} == {"X", "Y"}   # solo bonos
    assert plazo["summary"]["plazo_promedio_anios"] == ra.plazo_prom_vencimiento_bonos
    assert "time_to_maturity_years" in plazo["columns"]

    # Panel dinámico: misma función para cualquier alerta/categoría
    eq = alert_detail(pos, "calidad_moodys", "Sin calificación")
    assert {i["identifier"] for i in eq["items"]} == {"X", "Y"}      # la acción no entra


def test_dashboard_breakdowns():
    payload = build_dashboard(_sample())
    tipos = {r.label for r in payload.por_tipo}
    assert {"Bond", "Equity", "Cash"} <= tipos
    total_pct = sum(r.pct_participacion for r in payload.por_clasificacion)
    assert abs(total_pct - 1.0) < 1e-9
