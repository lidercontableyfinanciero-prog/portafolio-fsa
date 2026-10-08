"""Cotejo contra filas reales del libro INFORME (hoja Base Datos)."""

from datetime import date

from app.services.valuation import (
    PositionInput,
    cash_limit_alert,
    compute_position,
    moodys_grade,
    sp_grade,
    stop_loss_indicator,
    time_to_maturity_years,
    unrealized_gain_loss,
    valor_informe,
)


def test_mark_to_market_metinvest():
    # Fila 3: USD METINVEST BV — cb=201840, mv=178858, accrued=3163.89
    gl = unrealized_gain_loss(178858, 201840)
    assert round(gl, 2) == -22982.00                      # Excel col L
    assert round(valor_informe(178858, 3163.89, "Bond"), 2) == 182021.89  # Excel col AF


def test_stop_loss_metinvest_is_monitoreo():
    # ratio = -22982 / 201840 = -11.39 %  -> "Monitoreo"
    assert stop_loss_indicator(-22982, 201840) == "Monitoreo"


def test_rating_grades():
    # Sin calificación vigente ("***", retirada "WR", vacío) -> no se asigna grado.
    assert moodys_grade("***") == "Sin calificación"
    assert moodys_grade("WR<") == "Sin calificación"
    assert sp_grade(None) == "Sin calificación"
    assert moodys_grade("BA2") == "Grado Especulativo"
    assert sp_grade("CCC+") == "Grado Especulativo"
    assert moodys_grade("Baa3") == "Grado de Inversión"
    assert sp_grade("BBB-") == "Grado de Inversión"
    assert sp_grade("A+") == "Grado de Inversión"


def test_cash_row():
    # Fila 2: Cash, mv = 565840.09
    p = PositionInput(
        identifier="CASH", description="Money Account", classification="Money Accounts",
        type="Cash", estimated_market_value=565840.09, quantity=565840.09,
    )
    m = compute_position(p, as_of=date(2026, 9, 3))
    assert round(m.valor_informe, 2) == 565840.09        # Cash: no suma accrued
    assert m.unrealized_gain_loss == 0.0                 # sin base de costo -> sin G/(P)
    assert m.cash_limit_alert == "Revision"              # 565840 > 200000  (Excel col AO)
    assert cash_limit_alert(180000) == "OK"


def test_issuer_alert_threshold():
    p = PositionInput(identifier="X", description="x", total_cost_basis=600000,
                      estimated_market_value=600000)
    assert compute_position(p).issuer_alert == "Revisar"


def test_credit_kpi_only_for_bonds():
    """Moody's / S&P solo aplican a bonos: el resto queda en "N/A"."""
    eq = compute_position(PositionInput(identifier="E", description="Accion", type="Equity",
                                        moodys_rating="Baa1", sp_rating="BBB"))
    assert eq.moodys_grade == eq.sp_grade == "N/A"
    for t in ("Mutual Fund", "Alternative Investment", "Cash"):
        m = compute_position(PositionInput(identifier=t, description=t, type=t))
        assert m.moodys_grade == m.sp_grade == "N/A"
    bond = compute_position(PositionInput(identifier="B", description="Bono", type="Bond",
                                          moodys_rating="BAA2", sp_rating="***"))
    assert bond.moodys_grade == "Grado de Inversión"
    assert bond.sp_grade == "Sin calificación"


def test_time_to_maturity_single_source():
    hoy = date(2026, 10, 8)
    # (vencimiento - hoy) / 365
    assert round(time_to_maturity_years(date(2028, 9, 20), hoy), 2) == 1.95
    assert time_to_maturity_years(None, hoy) is None
    assert time_to_maturity_years(date(2026, 1, 1), hoy) < 0          # ya vencido
    m = compute_position(
        PositionInput(identifier="B", description="Bono", type="Bond",
                      maturity_date=date(2027, 3, 15), acquired_date=date(2020, 1, 1),
                      quantity=200_000, estimated_market_value=199_000),
        as_of=hoy,
    )
    assert m.time_to_maturity_years == time_to_maturity_years(date(2027, 3, 15), hoy)
    assert m.face_value == 200_000 and m.currency == "USD"
