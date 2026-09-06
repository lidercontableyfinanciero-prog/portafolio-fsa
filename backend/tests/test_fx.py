from datetime import date

from app.services.fx_simulator import FxInput, sensitivity, simulate_fx


def test_control_check_is_zero_and_fx_difference():
    data = FxInput(
        gross_sale_usd=120_000,
        sale_commission_usd=1_200,
        purchase_cost_usd=100_000,
        purchase_date=date(2025, 1, 10),
        sale_date=date(2026, 5, 5),
        trm_purchase=3_800,
        trm_sale=4_000,
        trm_close=4_050,
    )
    r = simulate_fx(data)
    assert r.accumulated_fx_difference == 100_000 * (4_000 - 3_800)
    assert r.gross_sale_cop == 480_000_000
    assert r.historical_cost_cop == 380_000_000
    assert r.net_sale_profit_cop == 95_200_000
    assert r.control_check == 0.0


def test_sensitivity_curve_monotonic_in_trm():
    data = FxInput(
        gross_sale_usd=120_000, sale_commission_usd=1_200, purchase_cost_usd=100_000,
        trm_purchase=3_800, trm_sale=4_000,
    )
    curve = sensitivity(data, 3_800, 4_400, steps=7)
    assert len(curve) == 7
    profits = [p.net_sale_profit_cop for p in curve]
    assert profits == sorted(profits)  # a mayor TRM de venta, mayor utilidad neta
