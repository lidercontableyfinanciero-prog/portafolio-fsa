"""Catálogo único de columnas de posición para reportes y ventanas de detalle.

Lo consumen:
- `exporters.positions_to_xlsx` / `positions_to_pdf` (columnas seleccionadas en
  "Configurar reporte"),
- el frontend (`GET /api/export/positions/columns`) para pintar la lista de
  casillas y formatear las tablas de las ventanas de alertas.

Cada clave es un atributo de `PositionMetrics`.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

# Tipos de formato: text · money · price · pct · date · years · number
KINDS = {"text", "money", "price", "pct", "date", "years", "number"}


@dataclass(frozen=True, slots=True)
class ReportColumn:
    key: str
    label: str            # encabezado completo (Excel, configuración)
    short: str            # encabezado compacto (PDF, modal)
    kind: str = "text"
    group: str = "General"
    pdf_weight: float = 1.0   # ancho relativo en el PDF
    total: bool = False       # se suma en la fila de totales
    default: bool = False     # marcada por defecto en "Configurar reporte"


REPORT_COLUMNS: list[ReportColumn] = [
    # --- Identificación
    ReportColumn("description", "Emisor / Descripción", "Emisor", "text", "Identificación", 2.6, default=True),
    ReportColumn("identifier", "Instrumento (CUSIP / Ticker)", "Instrumento", "text", "Identificación", 1.2, default=True),
    ReportColumn("type", "Tipo de activo", "Tipo", "text", "Identificación", 1.1, default=True),
    ReportColumn("classification", "Clasificación", "Clasificación", "text", "Identificación", 1.2),
    ReportColumn("sector", "Sector", "Sector", "text", "Identificación", 1.5),
    ReportColumn("currency", "Moneda", "Moneda", "text", "Identificación", 0.6),
    # --- Fechas y plazos
    ReportColumn("acquired_date", "Fecha de compra", "F. compra", "date", "Fechas y plazos", 0.95, default=True),
    ReportColumn("maturity_date", "Fecha de vencimiento", "F. vencimiento", "date", "Fechas y plazos", 0.95, default=True),
    ReportColumn("time_to_maturity_years", "Tiempo al vencimiento (años)", "T. al venc. (años)", "years", "Fechas y plazos", 0.9, default=True),
    ReportColumn("initial_term_years", "Plazo inicial de compra (años)", "Plazo inicial (años)", "years", "Fechas y plazos", 0.9),
    # --- Valores
    ReportColumn("quantity", "Cantidad", "Cantidad", "number", "Valores", 0.9),
    ReportColumn("face_value", "Valor nominal (USD)", "V. nominal", "money", "Valores", 1.0, total=True),
    ReportColumn("market_price", "Precio de mercado", "Precio", "price", "Valores", 0.8),
    ReportColumn("cost_basis", "Costo (USD)", "Costo", "money", "Valores", 1.0, total=True),
    ReportColumn("market_value", "Valor de mercado (USD)", "V. mercado", "money", "Valores", 1.0, total=True, default=True),
    ReportColumn("valor_informe", "Valor informe (USD)", "V. informe", "money", "Valores", 1.0, total=True),
    ReportColumn("unrealized_gain_loss", "G/(P) no realizada (USD)", "G/(P)", "money", "Valores", 1.0, total=True),
    ReportColumn("accrued_interest", "Interés acumulado (USD)", "Int. acum.", "money", "Valores", 0.9, total=True),
    # --- Rentabilidad
    ReportColumn("return_on_cost", "Rentabilidad s/ costo", "Rent. s/ costo", "pct", "Rentabilidad", 0.8),
    ReportColumn("coupon_rate", "Tasa cupón", "Tasa", "pct", "Rentabilidad", 0.7),
    ReportColumn("current_yield", "Yield actual", "Yield", "pct", "Rentabilidad", 0.7),
    ReportColumn("annual_income", "Ingreso anual estimado (USD)", "Ingreso anual", "money", "Rentabilidad", 1.0, total=True),
    ReportColumn("dividends_paid", "Intereses / dividendos pagados (USD)", "Int./Div. pagados", "money", "Rentabilidad", 1.0, total=True),
    ReportColumn("tax", "Impuesto (USD)", "Impuesto", "money", "Rentabilidad", 0.8, total=True),
    ReportColumn("tax_rate", "Tasa impositiva", "Tasa imp.", "pct", "Rentabilidad", 0.7),
    ReportColumn("equity_return_on_cost", "Rentab. costo (Renta Variable)", "Rent. costo RV", "pct", "Rentabilidad", 0.8),
    ReportColumn("equity_market_value_return", "Rentab. valor de mercado (Renta Variable)", "Rent. V. merc. RV", "pct", "Rentabilidad", 0.8),
    # --- Riesgo
    ReportColumn("moodys_rating", "Calificación Moody's", "Moody's", "text", "Riesgo", 0.7),
    ReportColumn("moodys_grade", "KPI riesgo Moody's", "KPI Moody's", "text", "Riesgo", 1.1),
    ReportColumn("sp_rating", "Calificación S&P", "S&P", "text", "Riesgo", 0.6),
    ReportColumn("sp_grade", "KPI riesgo S&P", "KPI S&P", "text", "Riesgo", 1.1),
    ReportColumn("stop_loss", "Indicador Stop-Loss", "Stop-Loss", "text", "Riesgo", 1.4),
    ReportColumn("time_alert", "Alerta tiempo", "Alerta tiempo", "text", "Riesgo", 0.7),
    ReportColumn("issuer_alert", "Alerta emisor", "Alerta emisor", "text", "Riesgo", 0.7),
    ReportColumn("cash_limit_alert", "Alerta límite de caja", "Límite caja", "text", "Riesgo", 0.7),
]

COLUMNS_BY_KEY: dict[str, ReportColumn] = {c.key: c for c in REPORT_COLUMNS}

# Sin selección explícita se conserva el formato histórico de cada exportación.
LEGACY_XLSX_COLUMNS = [
    "description", "identifier", "classification", "type", "sector", "cost_basis",
    "market_value", "unrealized_gain_loss", "return_on_cost", "annual_income",
    "accrued_interest", "dividends_paid", "tax", "tax_rate", "current_yield",
    "equity_return_on_cost", "equity_market_value_return", "moodys_rating",
    "moodys_grade", "sp_rating", "sp_grade", "stop_loss", "time_alert", "issuer_alert",
]
LEGACY_PDF_COLUMNS = [
    "description", "identifier", "classification", "type", "sector", "cost_basis",
    "market_value", "unrealized_gain_loss", "return_on_cost", "stop_loss", "moodys_grade",
]


def resolve_columns(
    keys: list[str] | None,
    fallback: list[str],
    catalog_cols: list[ReportColumn] | None = None,
) -> list[ReportColumn]:
    """Columnas pedidas (en el orden del catálogo), ignorando claves desconocidas."""
    cat = catalog_cols or REPORT_COLUMNS
    by_key = {c.key: c for c in cat}
    wanted = set(keys or [])
    if not wanted:
        return [by_key[k] for k in fallback]
    cols = [c for c in cat if c.key in wanted]
    return cols or [by_key[k] for k in fallback]


def catalog(catalog_cols: list[ReportColumn] | None = None) -> list[dict]:
    return [asdict(c) for c in (catalog_cols or REPORT_COLUMNS)]


# --------------------------------------------------------------------------- #
# Portafolio Nacional (COP) — claves de `services.national.AssetResult`
# --------------------------------------------------------------------------- #
_N = ReportColumn
NATIONAL_REPORT_COLUMNS: list[ReportColumn] = [
    _N("name", "Inversión", "Inversión", "text", "Identificación", 2.4, default=True),
    _N("asset_type", "Tipo de inversión", "Tipo", "text", "Identificación", 0.7, default=True),
    _N("group", "Grupo", "Grupo", "text", "Identificación", 1.5),
    _N("entity", "Entidad / Administrador", "Entidad", "text", "Identificación", 1.3, default=True),
    _N("issuer", "Emisor", "Emisor", "text", "Identificación", 1.5, default=True),
    _N("nemo", "Nemotécnico", "Nemo", "text", "Identificación", 1.0),
    _N("ref", "Referencia de tasa (REF)", "REF", "text", "Identificación", 0.5),
    _N("per", "Periodicidad (Per)", "Per", "text", "Identificación", 0.5),
    _N("status", "Estado", "Estado", "text", "Identificación", 0.9, default=True),
    _N("issue_date", "Fecha de emisión", "F. emisión", "date", "Fechas y plazos", 0.9),
    _N("purchase_date", "Fecha de compra", "F. compra", "date", "Fechas y plazos", 0.9),
    _N("maturity_date", "Fecha de vencimiento", "F. vencimiento", "date", "Fechas y plazos", 0.9, default=True),
    _N("years_remaining", "Años remanentes al corte", "Años rem.", "years", "Fechas y plazos", 0.7, default=True),
    _N("days_to_maturity", "Días a vencimiento", "Días venc.", "number", "Fechas y plazos", 0.7),
    _N("value_cut", "Valor al corte (COP)", "Valor al corte", "money", "Valores", 1.3, total=True, default=True),
    _N("weight", "Peso en el portafolio", "Peso %", "pct", "Valores", 0.7, default=True),
    _N("value_base", "Valor cierre periodo base (COP)", "Valor base", "money", "Valores", 1.3, total=True),
    _N("nominal_value", "Valor nominal (COP)", "Vr nominal", "money", "Valores", 1.2, total=True),
    _N("purchase_value", "Valor de compra (COP)", "Vr compra", "money", "Valores", 1.2, total=True),
    _N("sale_value", "Valor de venta / Giro (COP)", "Vr venta", "money", "Valores", 1.2, total=True),
    _N("pnl", "P&G (COP)", "P&G", "money", "Valores", 1.1, total=True),
    _N("sale_purchase_diff", "Dif. giro compra y venta (COP)", "Dif. giro", "money", "Valores", 1.1, total=True),
    _N("income_tax_20", "20 % renta (COP)", "20 % renta", "money", "Valores", 1.0, total=True),
    _N("prev_balance", "Saldo mes anterior (COP)", "Saldo ant.", "money", "Movimientos del mes", 1.2, total=True),
    _N("deposits", "Depósitos del mes (COP)", "Depósitos", "money", "Movimientos del mes", 1.1, total=True),
    _N("withdrawals", "Retiros del mes (COP)", "Retiros", "money", "Movimientos del mes", 1.1, total=True),
    _N("month_returns", "Rendimientos del mes (COP)", "Rend. mes", "money", "Movimientos del mes", 1.0, total=True),
    _N("avg_balance", "Saldo promedio (COP)", "Saldo prom.", "money", "Rentabilidad", 1.2),
    _N("period_return", "Retorno del periodo (COP)", "Retorno", "money", "Rentabilidad", 1.1, total=True),
    _N("paid_income", "Intereses y rendimientos liquidados (COP)", "Liquidados", "money", "Rentabilidad", 1.1, total=True),
    _N("coupons_total", "Cupones pagados (COP)", "Cupones", "money", "Rentabilidad", 1.0, total=True),
    _N("coupon_rate", "Tasa cupón", "Tasa cupón", "pct", "Rentabilidad", 0.7, default=True),
    _N("rate_em", "Tasa E.M.", "Tasa EM", "pct", "Rentabilidad", 0.6),
    _N("holding_irr", "TIR de tenencia", "TIR", "pct", "Rentabilidad", 0.6),
    _N("sale_rate", "Tasa de venta", "Tasa venta", "pct", "Rentabilidad", 0.6),
    _N("rent_period", "Rentabilidad del periodo", "Rent. periodo", "pct", "Rentabilidad", 0.8),
    _N("rent_ea", "Rentabilidad E.A.", "Rent. E.A.", "pct", "Rentabilidad", 0.8, default=True),
    _N("benchmark_rule", "Benchmark aplicable", "Benchmark", "text", "Rentabilidad", 0.7),
    _N("benchmark_ea", "Benchmark E.A.", "Bench. E.A.", "pct", "Rentabilidad", 0.8, default=True),
    _N("diff_vs_benchmark", "Diferencia vs benchmark (pp E.A.)", "Dif. vs bench.", "pct", "Rentabilidad", 0.8),
    _N("discount", "Descuento (castigo)", "Descuento", "pct", "Rentabilidad", 0.7),
    _N("cal", "CAL (anualizado)", "CAL", "pct", "Rentabilidad", 0.6),
    _N("low_liquidity", "Baja liquidez", "Baja liq.", "text", "Riesgo", 0.6),
    _N("classification", "Clasificación de alerta", "Alerta", "text", "Riesgo", 1.0, default=True),
    _N("observation", "Observación", "Observación", "text", "Riesgo", 2.2),
]
NATIONAL_DEFAULT_COLUMNS = [c.key for c in NATIONAL_REPORT_COLUMNS if c.default]
