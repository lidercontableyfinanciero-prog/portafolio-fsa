"""XIRR — tasa interna de retorno con fechas irregulares (equivalente a Excel XIRR)."""

from __future__ import annotations

from datetime import date


def _xnpv(rate: float, cashflows: list[tuple[date, float]]) -> float:
    d0 = cashflows[0][0]
    return sum(
        cf / (1.0 + rate) ** ((d - d0).days / 365.0) for d, cf in cashflows
    )


def _xnpv_derivative(rate: float, cashflows: list[tuple[date, float]]) -> float:
    d0 = cashflows[0][0]
    total = 0.0
    for d, cf in cashflows:
        t = (d - d0).days / 365.0
        total += -t * cf / (1.0 + rate) ** (t + 1.0)
    return total


def xirr(cashflows: list[tuple[date, float]], guess: float = 0.1) -> float | None:
    """Devuelve la tasa anual efectiva o None si no converge.

    `cashflows` debe contener al menos un valor negativo y uno positivo.
    """
    flows = sorted((d, float(cf)) for d, cf in cashflows if cf != 0)
    if len(flows) < 2:
        return None
    if not (any(cf < 0 for _, cf in flows) and any(cf > 0 for _, cf in flows)):
        return None

    # Newton-Raphson
    rate = guess
    for _ in range(100):
        try:
            f = _xnpv(rate, flows)
            df = _xnpv_derivative(rate, flows)
        except (OverflowError, ZeroDivisionError):
            break
        if abs(df) < 1e-12:
            break
        new_rate = rate - f / df
        if new_rate <= -0.9999:
            new_rate = (rate - 0.9999) / 2  # mantener dentro del dominio
        if abs(new_rate - rate) < 1e-9:
            return new_rate
        rate = new_rate

    # Fallback: bisección en un rango amplio
    lo, hi = -0.9999, 100.0
    try:
        f_lo = _xnpv(lo, flows)
        f_hi = _xnpv(hi, flows)
    except OverflowError:
        return None
    if f_lo * f_hi > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        f_mid = _xnpv(mid, flows)
        if abs(f_mid) < 1e-8:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2
