from datetime import date

from app.services.scenarios import ScenarioAssetInput, run_matrix
from app.services.xirr import xirr


def _nvidia() -> ScenarioAssetInput:
    # Hoja "Escenarios": NVIDIA, Agosto. quantity=900, C15=156178.28, C16=198702
    return ScenarioAssetInput(
        identifier="NVIDIA",
        description="NVIDIA",
        type="Equity",
        purchase_date=date(2025, 11, 25),
        quantity=900,
        purchase_value=156178.28,
        market_value=198702.0,
        as_of=date(2026, 9, 3),
    )


def test_scenario_1_half_sale_matches_excel():
    r = run_matrix(_nvidia(), [0.5])[0]
    assert round(r.unit_market_price, 2) == 220.78         # C17
    assert round(r.gross_sale_value, 2) == 99351.00        # C22
    assert round(r.broker_commission, 3) == 1092.861       # C23
    assert round(r.net_sale_value, 3) == 98255.139         # C25
    assert round(r.profit, 3) == -57923.141                # C27
    assert round(r.profit_per_share, 5) == -128.71809      # C28
    assert round(r.holding_years, 5) == round(282 / 360, 5)  # C29
    assert round(r.roi, 5) == 0.25824                      # C31


def test_scenario_full_and_partial_roi_consistent():
    results = run_matrix(_nvidia(), [0.5, 1.0, 0.7])
    # ROI ~ estable entre escenarios (Excel: 0.25824 / 0.25826 / 0.25825)
    rois = [round(r.roi, 3) for r in results]
    assert rois == [0.258, 0.258, 0.258]


def test_xirr_two_flows():
    rate = xirr([(date(2025, 11, 25), -156178.28), (date(2026, 9, 3), 198702.0)])
    assert rate is not None
    assert abs(rate - 0.3657) < 5e-3                       # Excel C30 = 0.36572
