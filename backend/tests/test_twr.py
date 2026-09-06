from app.services.twr import MonthlyReturnInput, time_weighted_return


def test_geometric_chaining():
    rows = [
        MonthlyReturnInput(2026, 6, 0.01, 0.005),
        MonthlyReturnInput(2026, 7, 0.02, 0.005),
    ]
    res = time_weighted_return(rows)
    assert abs(res.cumulative_twr - (1.01 * 1.02 - 1)) < 1e-12
    assert abs(res.cumulative_benchmark - (1.005 * 1.005 - 1)) < 1e-12
    assert res.rows[-1].month_name == "Julio"


def test_missing_month_is_skipped_not_zero():
    rows = [
        MonthlyReturnInput(2026, 1, None),
        MonthlyReturnInput(2026, 2, 0.03),
    ]
    res = time_weighted_return(rows)
    assert abs(res.cumulative_twr - 0.03) < 1e-12
    assert res.rows[0].cumulative_twr is None
