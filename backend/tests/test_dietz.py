from datetime import date

from app.services.dietz import CashFlowInput, modified_dietz


def test_agosto_2026_matches_excel():
    # Hoja "Rentabilidad": Vi = J17, Vf = K17, sin flujos externos.
    res = modified_dietz(
        start_date=date(2026, 7, 31),
        end_date=date(2026, 8, 31),
        value_start=13_773_343.30,
        value_end=13_975_106.05,
        cash_flows=[],
    )
    # Excel: (K17-J17)/J17 = 0.0146487853824...
    assert abs(res.period_return - 0.01464878538) < 1e-8
    assert res.days_total == 31
    assert res.net_flows == 0


def test_weighting_of_external_flow():
    # Aporte de 100 a mitad de un período de 30 días -> peso 0.5 (aprox).
    res = modified_dietz(
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
        value_start=1000.0,
        value_end=1200.0,
        cash_flows=[CashFlowInput(date(2026, 1, 16), 100.0, "aporte")],
    )
    assert res.days_total == 30
    wf = res.flows[0]
    assert wf.days_remaining == 15
    assert abs(wf.weight - 0.5) < 1e-9
    # R = (1200 - 1000 - 100) / (1000 + 50)
    assert abs(res.period_return - (100 / 1050)) < 1e-9


def test_alpha_vs_benchmark():
    res = modified_dietz(
        start_date=date(2026, 7, 31),
        end_date=date(2026, 8, 31),
        value_start=13_773_343.30,
        value_end=13_975_106.05,
        benchmark_composite_annual=0.06793,
    )
    assert res.benchmark_composite_monthly is not None
    assert abs(res.benchmark_composite_monthly - 0.06793 / 12) < 1e-12
    assert abs(res.alpha_composite - (res.period_return - 0.06793 / 12)) < 1e-12
