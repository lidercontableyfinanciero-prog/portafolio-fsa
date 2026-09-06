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


def test_filter_by_rating_grade_sp():
    # A = BBB -> Grado de Inversión ; B = BB y C (Cash, sin rating) -> Grado Especulativo
    inv = filter_positions(_sample(), rating_grade="Grado de Inversión", rating_agency="sp")
    assert {p.identifier for p in inv} == {"A"}
    spec = filter_positions(_sample(), rating_grade="Grado Especulativo", rating_agency="sp")
    assert {p.identifier for p in spec} == {"B", "C"}


def test_dashboard_breakdowns():
    payload = build_dashboard(_sample())
    tipos = {r.label for r in payload.por_tipo}
    assert {"Bond", "Equity", "Cash"} <= tipos
    total_pct = sum(r.pct_participacion for r in payload.por_clasificacion)
    assert abs(total_pct - 1.0) < 1e-9
