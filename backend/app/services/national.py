"""Motor de cálculo del Portafolio Nacional (COP) — funciones puras.

Reimplementa las hojas `Valoracion`, `Rentabilidad` y `Alertas` del libro
`2. INFORME INVERSIONES NACIONALES FSA 2026.xlsx` sobre la base de movimientos
`Data_Nal`. Es la ÚNICA fuente de los indicadores nacionales: dashboard,
posiciones, alertas y reportes leen de `build_report`.

Ver docs/NATIONAL_LOGIC.md (fórmulas y referencias de celda).
"""

from __future__ import annotations

import calendar
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date

from app.services.constants import MONTH_ABBR_ES, month_index_to_name

Period = tuple[int, int]  # (año, mes 1..12)

# --- Tipos normalizados y grupos (Valoracion!B:C) ---
TYPE_CDT, TYPE_BONO, TYPE_FIC, TYPE_FCP = "CDT", "Bono", "FIC", "FCP"
GROUP_RF = "Renta Fija (CDT + Bono)"
GROUP_FIC = "Cartera Colectiva (FIC)"
GROUP_FCP = "Futuro Inmobiliario / FCP"
GROUPS = [GROUP_FIC, GROUP_RF, GROUP_FCP]               # orden de Rentabilidad!A23:A25
TYPE_ORDER = [TYPE_CDT, TYPE_FIC, TYPE_FCP, TYPE_BONO]  # orden de Dashboard!B13:B16
TYPE_LABELS = {
    TYPE_CDT: "CDTs",
    TYPE_FIC: "FIC (Cartera Colectiva)",
    TYPE_FCP: "Futuros / FCP",
    TYPE_BONO: "Bonos",
}
BENCH_IPC = "IPC"
BENCH_IPC_SPREAD = "IPC + 2"

# "Tipo de Inversión" de la base -> tipo normalizado
_RAW_TYPE_MAP = {
    "cdt": TYPE_CDT,
    "bonos": TYPE_BONO,
    "bono": TYPE_BONO,
    "fondo de inversión colectiva": TYPE_FIC,
    "fondo de inversion colectiva": TYPE_FIC,
    "fondo de capital privado": TYPE_FCP,
}
_GROUP_BY_TYPE = {TYPE_CDT: GROUP_RF, TYPE_BONO: GROUP_RF, TYPE_FIC: GROUP_FIC, TYPE_FCP: GROUP_FCP}

# Signos del saldo de FIC / FCP (Parametros!tblSigno)
SALDO_SIGNS: dict[str, int] = {
    "saldo mes anterior": 1,
    "depositos": 1,
    "rendimientos": 1,
    "valorización": 1,
    "valorizacion": 1,
    "retiros": -1,
    "retiros - redención": -1,
    "retiros - redencion": -1,
    "gravamen a los movimientos financieros": -1,
    "redencion": -1,
    "redención": -1,
}
C_MARKET_VALUE = "valor de mercado"
C_COMPOSITION = "composición de portafolio"
C_RETURNS = "rendimientos"
C_RETURNS_PAID = "rendimientos pagados"
C_VALUATION = "valorización"
C_DEPOSITS = "depositos"
C_WITHDRAWALS = ("retiros", "retiros - redención")

KNOWN_CONCEPTS = set(SALDO_SIGNS) | {
    C_MARKET_VALUE, C_COMPOSITION, C_RETURNS_PAID, "rendimientos mes anterior",
}

ST_CRIT, ST_ATTN, ST_OK, ST_NA, ST_ND, ST_TOP = (
    "Crítico", "Atención", "OK", "N/A", "N/D", "Sobresaliente",
)
CLS_RISK, CLS_WATCH, CLS_TOP, CLS_NORMAL, CLS_CLOSED = (
    "En riesgo", "En seguimiento", "Sobresaliente", "Normal", "Cerrado",
)


def norm(s: str | None) -> str:
    return (s or "").strip().lower()


def normalize_type(raw: str | None) -> str | None:
    return _RAW_TYPE_MAP.get(norm(raw))


def period_label(p: Period) -> str:
    return f"{MONTH_ABBR_ES[p[1] - 1]} {p[0]}"


def month_diff(a: Period, b: Period) -> int:
    """Meses de `a` a `b` (b − a)."""
    return (b[0] * 12 + b[1]) - (a[0] * 12 + a[1])


def end_of_month(p: Period) -> date:
    return date(p[0], p[1], calendar.monthrange(p[0], p[1])[1])


# --------------------------------------------------------------------------- #
# Entradas
# --------------------------------------------------------------------------- #
@dataclass(slots=True)
class Movement:
    year: int
    month: int
    entity: str
    investment_type: str
    name: str
    concept: str
    value: float | None = None
    movement_type: str | None = None
    nominal_value: float | None = None
    purchase_value: float | None = None
    coupon_rate: float | None = None
    rate_em: float | None = None
    issue_date: date | None = None
    purchase_date: date | None = None
    maturity_date: date | None = None
    status: str | None = None
    sale_value: float | None = None
    pnl: float | None = None
    holding_irr: float | None = None
    sale_rate: float | None = None
    nemo: str | None = None
    ref: str | None = None
    per: str | None = None

    @property
    def period(self) -> Period:
        return (self.year, self.month)


@dataclass(slots=True)
class Asset:
    name: str
    asset_type: str
    group: str
    issuer: str
    entity: str | None = None
    low_liquidity: bool = False
    benchmark: str = BENCH_IPC_SPREAD
    needs_review: bool = False


@dataclass(slots=True)
class Params:
    spread: float = 0.02
    limit_issuer: float = 0.20
    limit_low_liquidity: float = 0.20
    max_term_years: float = 3.0
    yellow: float = 0.9
    days_critical: float = 90
    days_attention: float = 180
    stop_loss: float = -0.10
    top_margin: float = 0.01
    coupons_as_returns_from: Period | None = None
    split_parent: str | None = None
    split_child: str | None = None
    split_until: Period | None = None


@dataclass(slots=True)
class Ipc:
    ytd: float | None
    m12: float | None


def default_asset(name: str, raw_type: str | None, entity: str | None) -> Asset:
    """Atributos deducidos para una inversión nueva (sin catálogo). Se marca
    `needs_review`: el emisor, la liquidez y el benchmark deben confirmarse.

    - Tipo y grupo: del "Tipo de Inversión" de la base.
    - Baja liquidez: solo FCP (el Reglamento, literal b, los nombra expresamente).
    - Benchmark: IPC para FIC líquidos, IPC + 2 para el resto (Anexo 6).
    - Emisor: el propio nombre (cada fondo es su propio emisor; para CDT/Bono
      debe corregirse al banco emisor).
    """
    t = normalize_type(raw_type) or TYPE_FIC
    return Asset(
        name=name,
        asset_type=t,
        group=_GROUP_BY_TYPE[t],
        issuer=name,
        entity=entity,
        low_liquidity=t == TYPE_FCP,
        benchmark=BENCH_IPC if t == TYPE_FIC else BENCH_IPC_SPREAD,
        needs_review=True,
    )


# --------------------------------------------------------------------------- #
# Núcleo
# --------------------------------------------------------------------------- #
def _status_from_use(use: float, yellow: float) -> str:
    if use >= 1:
        return "Excede límite"
    if use >= yellow:
        return "Cerca del límite"
    return "Dentro del límite"


def _annualize(rate: float, months: int) -> float | None:
    if months <= 0:
        return None
    return (1 + rate) ** (12 / months) - 1


@dataclass(slots=True)
class _Ctx:
    periods: list[Period]
    window: list[Period]
    base: Period
    cut: Period
    months: int
    cut_date: date
    sums: dict[tuple[str, Period, str], float]
    composition: dict[str, Movement]
    assets: dict[str, Asset]
    params: Params
    ipc: dict[Period, Ipc]
    names: list[str] = field(default_factory=list)


def _idx(ctx: _Ctx, p: Period) -> int:
    return month_diff(ctx.base, p) + 1


def available_periods(movements: Iterable[Movement]) -> list[Period]:
    return sorted({m.period for m in movements})


def _context(
    movements: list[Movement],
    assets: dict[str, Asset],
    ipc: dict[Period, Ipc],
    params: Params,
    cut: Period | None,
) -> _Ctx:
    periods = available_periods(movements)
    if not periods:
        raise ValueError("No hay movimientos del portafolio nacional cargados.")
    cut = cut if cut in periods else periods[-1]
    # Base del periodo de rentabilidad = cierre de diciembre del año anterior
    # al corte (Rentabilidad!B5); si no existe, el primer cierre disponible.
    base = (cut[0] - 1, 12) if (cut[0] - 1, 12) in periods else periods[0]
    if base > cut:
        base = cut
    window = [p for p in periods if base <= p <= cut]

    sums: dict[tuple[str, Period, str], float] = defaultdict(float)
    composition: dict[str, Movement] = {}
    names: list[str] = []
    seen: set[str] = set()
    all_assets = dict(assets)
    for m in movements:
        if m.period > cut:
            continue
        if m.name not in seen:
            seen.add(m.name)
            names.append(m.name)
        if m.name not in all_assets:
            all_assets[m.name] = default_asset(m.name, m.investment_type, m.entity)
        c = norm(m.concept)
        sums[(m.name, m.period, c)] += m.value or 0.0
        if c == C_COMPOSITION:
            prev = composition.get(m.name)
            if prev is None or m.period >= prev.period:
                composition[m.name] = m
    return _Ctx(
        periods=periods, window=window, base=base, cut=cut,
        months=month_diff(base, cut), cut_date=end_of_month(cut),
        sums=sums, composition=composition, assets=all_assets,
        params=params, ipc=ipc, names=names,
    )


def _split_weight(ctx: _Ctx, name: str) -> float:
    """Reparto del valor consolidado matriz/hijo según el Giro de Venta
    (Parametros!B14:B15)."""
    p = ctx.params
    parent = ctx.composition.get(p.split_parent or "")
    child = ctx.composition.get(p.split_child or "")
    g_parent = (parent.sale_value or 0.0) if parent else 0.0
    g_child = (child.sale_value or 0.0) if child else 0.0
    total = g_parent + g_child
    if not total:
        return 1.0 if name == p.split_parent else 0.0
    return (g_parent if name == p.split_parent else g_child) / total


def _valuation(ctx: _Ctx, name: str, p: Period) -> float:
    """Valor de cierre del activo en el mes (Valoracion!H6:P20)."""
    a = ctx.assets[name]
    s = ctx.sums
    if a.asset_type in (TYPE_FIC, TYPE_FCP):  # "Saldo cierre" / "Saldo + valorización"
        return sum(sign * s.get((name, p, c), 0.0) for c, sign in SALDO_SIGNS.items())
    pr = ctx.params
    if (
        name in (pr.split_parent, pr.split_child)
        and pr.split_until is not None
        and p <= pr.split_until
    ):
        return s.get((pr.split_parent, p, C_MARKET_VALUE), 0.0) * _split_weight(ctx, name)
    return s.get((name, p, C_MARKET_VALUE), 0.0)


def _coupons(ctx: _Ctx, name: str, p: Period) -> float:
    """Cupones pagados de renta fija (Valoracion!tblCup)."""
    if ctx.assets[name].asset_type not in (TYPE_CDT, TYPE_BONO):
        return 0.0
    paid = ctx.sums.get((name, p, C_RETURNS_PAID), 0.0)
    since = ctx.params.coupons_as_returns_from
    if since is not None and p >= since:
        paid += ctx.sums.get((name, p, C_RETURNS), 0.0)
    return paid


def _monthly_return(ctx: _Ctx, name: str, p: Period, val: dict[Period, float]) -> float:
    """Retorno del mes (Valoracion!tblRet): FIC = rendimientos; FCP =
    valorización; renta fija = Δ valor de mercado (si ambos cierres > 0) + cupones."""
    t = ctx.assets[name].asset_type
    if t == TYPE_FIC:
        return ctx.sums.get((name, p, C_RETURNS), 0.0)
    if t == TYPE_FCP:
        return ctx.sums.get((name, p, C_VALUATION), 0.0) + ctx.sums.get(
            (name, p, "valorizacion"), 0.0
        )
    i = ctx.window.index(p)
    if i == 0:
        return 0.0
    prev, cur = val[ctx.window[i - 1]], val[p]
    delta = cur - prev if prev > 0 and cur > 0 else 0.0
    return delta + _coupons(ctx, name, p)


def benchmarks(ipc: dict[Period, Ipc], cut: Period, months: int, spread: float) -> dict:
    """Anexo 6: IPC + spread (portafolio total) e IPC (inversiones líquidas)."""
    cur = ipc.get(cut)
    ytd = cur.ytd if cur else None
    m12 = cur.m12 if cur else None
    per = liq_per = ea = liq_ea = None
    if ytd is not None:
        per = (1 + ytd) * (1 + spread) ** (months / 12) - 1
        liq_per = ytd
        ea = _annualize(per, months)
        liq_ea = _annualize(liq_per, months)
    return {
        "ipc_ytd": ytd, "ipc_12m": m12, "spread": spread,
        "period": per, "ea": ea, "liquid_period": liq_per, "liquid_ea": liq_ea,
    }


@dataclass(slots=True)
class AssetResult:
    name: str
    asset_type: str
    group: str
    issuer: str
    entity: str | None
    low_liquidity: bool
    benchmark_rule: str
    needs_review: bool
    values: dict[str, float]          # etiqueta de período -> valor de cierre
    returns: dict[str, float]
    coupons: dict[str, float]
    value_base: float
    value_cut: float
    sum_value_months: float
    avg_balance: float
    months_with_value: int
    period_return: float              # Retorno ($) Ene–corte
    rent_period: float
    rent_ea: float | None
    benchmark_ea: float | None
    diff_vs_benchmark: float | None
    coupons_total: float
    paid_income: float                # Intereses y rendimientos liquidados
    weight: float = 0.0
    # composición (CDT / Bono)
    nemo: str | None = None
    ref: str | None = None
    per: str | None = None
    nominal_value: float | None = None
    purchase_value: float | None = None
    sale_value: float | None = None
    pnl: float | None = None
    holding_irr: float | None = None
    sale_rate: float | None = None
    coupon_rate: float | None = None
    rate_em: float | None = None
    issue_date: date | None = None
    purchase_date: date | None = None
    maturity_date: date | None = None
    sale_purchase_diff: float | None = None
    income_tax_20: float | None = None
    discount: float | None = None
    years_remaining: float | None = None
    days_to_maturity: int | None = None
    cal: float | None = None
    status: str = "Vigente"
    # movimientos del mes de corte (FIC / FCP)
    prev_balance: float = 0.0
    deposits: float = 0.0
    withdrawals: float = 0.0
    month_returns: float = 0.0
    # alertas
    st_issuer: str = ST_NA
    st_liquidity: str = ST_NA
    st_term: str = ST_NA
    st_maturity: str = ST_NA
    st_rate: str = ST_NA
    st_return: str = ST_NA
    classification: str = CLS_NORMAL
    observation: str = ""


def _asset_results(ctx: _Ctx, bench: dict) -> list[AssetResult]:
    out: list[AssetResult] = []
    labels = {p: period_label(p) for p in ctx.window}
    cut_i = len(ctx.window) - 1
    for name in ctx.names:
        a = ctx.assets[name]
        val = {p: _valuation(ctx, name, p) for p in ctx.window}
        ret = {p: _monthly_return(ctx, name, p, val) for p in ctx.window}
        cup = {p: _coupons(ctx, name, p) for p in ctx.window}

        sum_vm = sum(val.values())
        n_pos = sum(1 for v in val.values() if v > 0)
        avg = sum_vm / n_pos if n_pos else 0.0
        mwv = sum(1 for i, p in enumerate(ctx.window) if i >= 1 and val[p] > 0)
        period_ret = sum(ret[p] for i, p in enumerate(ctx.window) if i >= 1)
        rent = period_ret / avg if avg else 0.0
        rent_ea = _annualize(rent, mwv)
        b_ea = bench["liquid_ea"] if a.benchmark == BENCH_IPC else bench["ea"]
        diff = rent_ea - b_ea if rent_ea is not None and b_ea is not None else None
        cup_total = sum(cup.values())
        if a.asset_type == TYPE_FIC:
            paid = sum(ret.values())
        elif a.asset_type in (TYPE_CDT, TYPE_BONO):
            paid = cup_total
        else:
            paid = 0.0

        r = AssetResult(
            name=name, asset_type=a.asset_type, group=a.group, issuer=a.issuer,
            entity=a.entity, low_liquidity=a.low_liquidity, benchmark_rule=a.benchmark,
            needs_review=a.needs_review,
            values={labels[p]: val[p] for p in ctx.window},
            returns={labels[p]: ret[p] for p in ctx.window},
            coupons={labels[p]: cup[p] for p in ctx.window},
            value_base=val[ctx.base] if ctx.base in val else 0.0,
            value_cut=val[ctx.cut],
            sum_value_months=sum_vm, avg_balance=avg, months_with_value=mwv,
            period_return=period_ret, rent_period=rent, rent_ea=rent_ea,
            benchmark_ea=b_ea, diff_vs_benchmark=diff, coupons_total=cup_total,
            paid_income=paid,
        )
        comp = ctx.composition.get(name)
        if comp is not None:
            r.nemo, r.ref, r.per = comp.nemo, comp.ref, comp.per
            r.nominal_value, r.purchase_value = comp.nominal_value, comp.purchase_value
            r.sale_value, r.pnl = comp.sale_value, comp.pnl
            r.holding_irr, r.sale_rate = comp.holding_irr, comp.sale_rate
            r.coupon_rate, r.rate_em = comp.coupon_rate, comp.rate_em
            r.issue_date, r.purchase_date = comp.issue_date, comp.purchase_date
            r.maturity_date = comp.maturity_date
            if comp.purchase_value is not None and comp.sale_value is not None:
                r.sale_purchase_diff = comp.purchase_value - comp.sale_value
                r.income_tax_20 = r.sale_purchase_diff * 0.20
                r.discount = (
                    r.sale_purchase_diff / comp.purchase_value if comp.purchase_value else None
                )
        if r.maturity_date is not None:
            r.days_to_maturity = (r.maturity_date - ctx.cut_date).days
            r.years_remaining = r.days_to_maturity / 365
            if r.discount is not None and r.value_cut > 0 and r.years_remaining > 0:
                r.cal = r.discount / r.years_remaining
        r.status = "Vigente" if r.value_cut > 0 else "Vendido / Vencido"

        if a.asset_type in (TYPE_FIC, TYPE_FCP):
            p = ctx.cut
            r.prev_balance = val[ctx.window[cut_i - 1]] if cut_i >= 1 else 0.0
            r.deposits = ctx.sums.get((name, p, C_DEPOSITS), 0.0)
            r.withdrawals = sum(ctx.sums.get((name, p, c), 0.0) for c in C_WITHDRAWALS)
            r.month_returns = ctx.sums.get((name, p, C_RETURNS), 0.0)
        out.append(r)
    return out


def _limits_and_alerts(ctx: _Ctx, results: list[AssetResult], bench: dict) -> dict:
    """Hoja Alertas: límites del Reglamento (portafolio total) y semáforo por activo."""
    pr = ctx.params
    total = sum(r.value_cut for r in results)
    for r in results:
        r.weight = r.value_cut / total if total else 0.0

    low_liq = sum(r.value_cut for r in results if r.low_liquidity)
    liq_share = low_liq / total if total else 0.0
    liq_use = liq_share / pr.limit_low_liquidity if pr.limit_low_liquidity else 0.0

    by_issuer: dict[str, float] = defaultdict(float)
    for r in results:
        by_issuer[r.issuer] += r.value_cut
    issuers = []
    for name, v in by_issuer.items():
        share = v / total if total else 0.0
        use = share / pr.limit_issuer if pr.limit_issuer else 0.0
        issuers.append({
            "issuer": name, "value": v, "share": share, "limit": pr.limit_issuer,
            "use": use,
            "status": "Sin posición" if v == 0 else _status_from_use(use, pr.yellow),
        })
    issuers.sort(key=lambda x: -x["value"])
    issuer_use = {i["issuer"]: i["use"] for i in issuers}
    max_issuer = max(issuers, key=lambda x: x["share"]) if issuers else None

    terms = [r for r in results if r.value_cut > 0 and r.years_remaining is not None]
    max_term = max(terms, key=lambda r: r.years_remaining) if terms else None
    term_val = max_term.years_remaining if max_term else 0.0
    term_use = term_val / pr.max_term_years if pr.max_term_years else 0.0

    ipc12 = bench["ipc_12m"]
    for r in results:
        open_ = r.value_cut != 0
        u = issuer_use.get(r.issuer, 0.0)
        r.st_issuer = ST_NA if not open_ else (
            ST_CRIT if u >= 1 else ST_ATTN if u >= pr.yellow else ST_OK)
        r.st_liquidity = ST_NA if (not open_ or not r.low_liquidity) else (
            ST_CRIT if liq_use >= 1 else ST_ATTN if liq_use >= pr.yellow else ST_OK)
        y = r.years_remaining
        r.st_term = ST_NA if (not open_ or y is None) else (
            ST_CRIT if y > pr.max_term_years
            else ST_ATTN if y > pr.max_term_years * pr.yellow else ST_OK)
        d = r.days_to_maturity
        r.st_maturity = ST_NA if (not open_ or d is None) else (
            ST_CRIT if d <= pr.days_critical
            else ST_ATTN if d <= pr.days_attention else ST_OK)
        rt = r.coupon_rate if r.asset_type in (TYPE_CDT, TYPE_BONO) else None
        r.st_rate = ST_NA if (not open_ or rt is None or ipc12 is None) else (
            ST_CRIT if rt < ipc12 else ST_ATTN if rt < ipc12 + pr.spread else ST_OK)
        if not open_:
            r.st_return = ST_NA
        elif r.diff_vs_benchmark is None:
            r.st_return = ST_ND
        elif r.rent_period <= pr.stop_loss:
            r.st_return = ST_CRIT
        elif r.rent_period < 0 or r.diff_vs_benchmark < 0:
            r.st_return = ST_ATTN
        elif r.diff_vs_benchmark >= pr.top_margin:
            r.st_return = ST_TOP
        else:
            r.st_return = ST_OK

        sts = [r.st_issuer, r.st_liquidity, r.st_term, r.st_maturity, r.st_rate, r.st_return]
        if not open_:
            r.classification = CLS_CLOSED
            r.observation = "Posición cerrada (vendida o vencida)"
            continue
        n_crit, n_attn = sts.count(ST_CRIT), sts.count(ST_ATTN)
        if n_crit or n_attn >= 2:
            r.classification = CLS_RISK
        elif n_attn == 1:
            r.classification = CLS_WATCH
        elif r.st_return == ST_TOP:
            r.classification = CLS_TOP
        else:
            r.classification = CLS_NORMAL
        notes = []
        for st, crit, attn in (
            (r.st_issuer, "Excede límite por emisor", "Emisor cerca del límite"),
            (r.st_liquidity, "Excede límite de baja liquidez", "Baja liquidez cerca del límite"),
            (r.st_term, "Plazo mayor al máximo", "Plazo cercano al máximo"),
            (r.st_maturity, f"Vence en menos de {pr.days_critical:g} días",
             f"Vence en menos de {pr.days_attention:g} días"),
            (r.st_rate, "Cupón inferior al IPC", "Cupón inferior a IPC + spread"),
            (r.st_return, "Pérdida del periodo", "Rentabilidad bajo el benchmark"),
        ):
            if st == ST_CRIT:
                notes.append(crit)
            elif st == ST_ATTN:
                notes.append(attn)
        if r.st_return == ST_TOP and r.diff_vs_benchmark is not None:
            pp = f"{round(r.diff_vs_benchmark * 100, 1):.1f}".replace(".", ",")
            notes.append(f"Supera el benchmark en {pp} pp")
        r.observation = "; ".join(notes)

    limits = [
        {
            "key": "baja_liquidez",
            "rule": "Inversiones de baja liquidez (FCP y fondos inmobiliarios) / portafolio",
            "reference": "Portafolio total, literal b",
            "value": liq_share, "limit": pr.limit_low_liquidity, "use": liq_use,
            "unit": "pct", "status": _status_from_use(liq_use, pr.yellow),
            "detail": [r.name for r in results if r.low_liquidity and r.value_cut > 0],
        },
        {
            "key": "emisor",
            "rule": "Mayor concentración por emisor / portafolio COP",
            "reference": "Anexo 5",
            "value": max_issuer["share"] if max_issuer else 0.0,
            "limit": pr.limit_issuer,
            "use": max_issuer["use"] if max_issuer else 0.0,
            "unit": "pct",
            "status": _status_from_use(max_issuer["use"], pr.yellow) if max_issuer else "Dentro del límite",
            "detail": [max_issuer["issuer"]] if max_issuer else [],
        },
        {
            "key": "plazo",
            "rule": "Plazo remanente máximo de deuda privada (años)",
            "reference": "Anexo 4",
            "value": term_val, "limit": pr.max_term_years, "use": term_use,
            "unit": "years", "status": _status_from_use(term_use, pr.yellow),
            "detail": [max_term.name] if max_term else [],
        },
    ]
    return {"limits": limits, "issuers": issuers}


def _aggregate(
    ctx: _Ctx, rs: list[AssetResult], bench: dict, official: bool
) -> dict:
    """Rentabilidad por grupo y total (Rentabilidad!A22:K26) sobre `rs`."""
    cut_idx = _idx(ctx, ctx.cut)
    months = ctx.months

    def summarize(items: list[AssetResult], label: str, b_ea, b_per) -> dict:
        base = sum(r.value_base for r in items)
        cut = sum(r.value_cut for r in items)
        svm = sum(r.sum_value_months for r in items)
        avg = svm / cut_idx if cut_idx else 0.0
        ret = sum(r.period_return for r in items)
        rent = ret / avg if avg else 0.0
        rent_ea = _annualize(rent, months)
        diff = rent_ea - b_ea if rent_ea is not None and b_ea is not None else None
        top = ctx.params.top_margin
        result = (
            None if diff is None
            else "Sobre benchmark" if diff >= top
            else "En línea" if diff >= 0 else "Bajo benchmark"
        )
        return {
            "label": label, "value_base": base, "value_cut": cut, "avg_balance": avg,
            "return": ret, "rent_period": rent, "rent_ea": rent_ea,
            "benchmark_period": b_per, "benchmark_ea": b_ea,
            "diff_vs_benchmark": diff, "result": result,
        }

    def weighted_bench(items: list[AssetResult]):
        den = sum(r.sum_value_months for r in items)
        if not den or any(r.benchmark_ea is None for r in items):
            return None, None
        ea = sum(r.sum_value_months * r.benchmark_ea for r in items) / den
        per = (1 + ea) ** (months / 12) - 1
        return ea, per

    groups = []
    for g in GROUPS:
        items = [r for r in rs if r.group == g]
        if not items:
            continue
        ea, per = weighted_bench(items)
        groups.append(summarize(items, g, ea, per))
    if official:
        total = summarize(rs, "Portafolio total", bench["ea"], bench["period"])
    else:
        ea, per = weighted_bench(rs)
        total = summarize(rs, "Selección filtrada", ea, per)
    return {"groups": groups, "total": total}


def _trend(ctx: _Ctx, rs: list[AssetResult]) -> list[dict]:
    """Tendencia acumulada portafolio vs benchmark (Rentabilidad!tblTend)."""
    out = []
    acc_ret = acc_val = 0.0
    for i, p in enumerate(ctx.window):
        lbl = period_label(p)
        mret = 0.0 if i == 0 else sum(r.returns[lbl] for r in rs)
        val = sum(r.values[lbl] for r in rs)
        acc_ret += mret
        acc_val += val
        c = i + 1
        cum = 0.0 if i == 0 else (acc_ret / (acc_val / c) if acc_val else 0.0)
        ipc = ctx.ipc.get(p)
        if i == 0:
            bm = 0.0
        elif ipc is not None and ipc.ytd is not None:
            bm = (1 + ipc.ytd) * (1 + ctx.params.spread) ** (month_diff(ctx.base, p) / 12) - 1
        else:
            bm = None
        diff = cum - bm if bm is not None else None
        out.append({
            "period": lbl, "year": p[0], "month": p[1], "month_name": month_index_to_name(p[1]),
            "close_date": end_of_month(p), "month_return": mret, "portfolio_value": val,
            "cum_return": cum, "cum_benchmark": bm, "diff": diff,
            "result": "Base" if i == 0 else (
                None if diff is None else "Sobre benchmark" if diff >= 0 else "Bajo benchmark"),
        })
    return out


def _series(ctx: _Ctx, rs: list[AssetResult]) -> dict:
    out = {"periods": [], "total": [], "mom": [], "by_group": {}, "by_type": {}}
    prev = None
    for p in ctx.window:
        lbl = period_label(p)
        tot = sum(r.values[lbl] for r in rs)
        out["periods"].append(lbl)
        out["total"].append(tot)
        out["mom"].append(None if not prev else tot / prev - 1)
        prev = tot
    for key, attr, order in (("by_group", "group", GROUPS), ("by_type", "asset_type", TYPE_ORDER)):
        for g in order:
            items = [r for r in rs if getattr(r, attr) == g]
            if items:
                out[key][g] = [sum(r.values[lbl] for r in items) for lbl in out["periods"]]
    return out


@dataclass(slots=True)
class Filters:
    asset_type: set[str] | None = None
    entity: set[str] | None = None
    group: set[str] | None = None
    issuer: set[str] | None = None
    status: set[str] | None = None   # Vigente / Vendido / Vencido

    def active(self) -> bool:
        return any((self.asset_type, self.entity, self.group, self.issuer, self.status))

    def match(self, r: AssetResult) -> bool:
        return (
            (not self.asset_type or r.asset_type in self.asset_type)
            and (not self.entity or (r.entity or "") in self.entity)
            and (not self.group or r.group in self.group)
            and (not self.issuer or r.issuer in self.issuer)
            and (not self.status or r.status in self.status)
        )


def build_report(
    movements: list[Movement],
    assets: dict[str, Asset],
    ipc: dict[Period, Ipc],
    params: Params,
    cut: Period | None = None,
    filters: Filters | None = None,
) -> dict:
    """Modelo completo del portafolio nacional para un mes de corte.

    Los límites del Reglamento y el semáforo por activo se calculan SIEMPRE
    sobre el portafolio total (son reglas de portafolio); los filtros solo
    acotan las posiciones, KPIs, distribuciones, rentabilidad y gráficos.
    """
    ctx = _context(movements, assets, ipc, params, cut)
    bench = benchmarks(ipc, ctx.cut, ctx.months, params.spread)
    results = _asset_results(ctx, bench)
    risk = _limits_and_alerts(ctx, results, bench)

    flt = filters or Filters()
    rs = [r for r in results if flt.match(r)] if flt.active() else results
    agg = _aggregate(ctx, rs, bench, official=not flt.active())
    series = _series(ctx, rs)
    trend = _trend(ctx, rs)

    total_cut = sum(r.value_cut for r in rs)
    for r in rs:
        r.weight = r.value_cut / total_cut if total_cut else 0.0
    allocation = []
    for t in TYPE_ORDER:
        v = sum(r.value_cut for r in rs if r.asset_type == t)
        if any(r.asset_type == t for r in rs):
            allocation.append({
                "type": t, "label": TYPE_LABELS[t], "value": v,
                "share": v / total_cut if total_cut else 0.0,
            })
    by_entity: dict[str, float] = defaultdict(float)
    by_issuer: dict[str, float] = defaultdict(float)
    for r in rs:
        by_entity[r.entity or "(sin entidad)"] += r.value_cut
        by_issuer[r.issuer] += r.value_cut
    term_buckets = {"< 1 año": 0.0, "1 – 2 años": 0.0, "2 – 3 años": 0.0, "> 3 años": 0.0,
                    "Sin vencimiento (fondos)": 0.0}
    for r in rs:
        if r.value_cut <= 0:
            continue
        y = r.years_remaining
        key = (
            "Sin vencimiento (fondos)" if y is None or r.asset_type in (TYPE_FIC, TYPE_FCP)
            else "< 1 año" if y < 1 else "1 – 2 años" if y < 2
            else "2 – 3 años" if y <= 3 else "> 3 años"
        )
        term_buckets[key] += r.value_cut

    vals = series["total"]
    mom_pct = series["mom"][-1] if len(vals) > 1 else None
    mom_abs = vals[-1] - vals[-2] if len(vals) > 1 else None
    counts = defaultdict(int)
    for r in rs:
        counts[r.classification] += 1

    def dist(d: dict[str, float]) -> list[dict]:
        return [
            {"label": k, "value": v, "share": v / total_cut if total_cut else 0.0}
            for k, v in sorted(d.items(), key=lambda kv: -kv[1]) if v
        ]

    return {
        "cut": {
            "year": ctx.cut[0], "month": ctx.cut[1],
            "month_name": month_index_to_name(ctx.cut[1]),
            "label": period_label(ctx.cut), "date": ctx.cut_date,
        },
        "base": {"year": ctx.base[0], "month": ctx.base[1], "label": period_label(ctx.base),
                 "date": end_of_month(ctx.base)},
        "months_elapsed": ctx.months,
        "periods": [
            {"year": p[0], "month": p[1], "label": period_label(p),
             "month_name": month_index_to_name(p[1])}
            for p in ctx.periods
        ],
        "filtered": flt.active(),
        "benchmark": bench,
        "kpis": {
            "paid_income": sum(r.paid_income for r in rs),
            "total_value": total_cut,
            "mom_pct": mom_pct,
            "mom_abs": mom_abs,
            "rent_period": agg["total"]["rent_period"],
            "rent_ea": agg["total"]["rent_ea"],
            "benchmark_ea": agg["total"]["benchmark_ea"],
            "benchmark_period": agg["total"]["benchmark_period"],
            "diff_vs_benchmark": agg["total"]["diff_vs_benchmark"],
            "positions_open": sum(1 for r in rs if r.value_cut > 0),
            "positions_total": len(rs),
            "classification_counts": dict(counts),
        },
        "allocation": allocation,
        "by_entity": dist(by_entity),
        "by_issuer": dist(by_issuer),
        "by_term": [
            {"label": k, "value": v, "share": v / total_cut if total_cut else 0.0}
            for k, v in term_buckets.items() if v
        ],
        "returns_by_group": agg["groups"],
        "returns_total": agg["total"],
        "trend": trend,
        "series": series,
        "limits": risk["limits"],
        "issuers": risk["issuers"],
        "assets": rs,
        "needs_review": sorted(r.name for r in results if r.needs_review),
    }
