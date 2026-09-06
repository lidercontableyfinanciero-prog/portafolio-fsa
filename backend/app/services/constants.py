"""Constantes y catálogos de la lógica financiera FSA (ver docs/FINANCIAL_LOGIC.md)."""

from __future__ import annotations

MONTHS_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
MONTH_INDEX: dict[str, int] = {m.lower(): i + 1 for i, m in enumerate(MONTHS_ES)}
MONTH_ABBR_ES = ["ene", "feb", "mar", "abr", "may", "jun",
                 "jul", "ago", "sep", "oct", "nov", "dic"]

# --- Grado crediticio (columnas AI / AJ del Excel) ---
MOODYS_INVESTMENT_GRADE = {
    "Aaa", "Aa1", "Aa2", "Aa3", "A1", "A2", "A3", "Baa1", "Baa2", "Baa3",
}
SP_INVESTMENT_GRADE = {
    "AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BBB-",
}
GRADE_INVESTMENT = "Grado de Inversión"
GRADE_SPECULATIVE = "Grado Especulativo"

# --- Indicador Stop-Loss (columna AH) ---
STOP_LOSS_STABLE = "Inversión Estable / Pérdida tolerable"
STOP_LOSS_MONITOR = "Monitoreo"
STOP_LOSS_EVALUATE = "Evaluar Venta"
STOP_LOSS_EXECUTE = "Ejecutar Venta - Previa Revisión"

# --- Reglas de alerta (hoja Parametros) ---
CONCENTRATION_LIMIT_USD = 500_000.0        # por activo / emisor / grupo económico
FIXED_INCOME_MAX_WEIGHT = 0.70             # tope Renta Fija
EQUITY_MAX_WEIGHT = 0.30                   # tope Renta Variable
BOND_MAX_TERM_YEARS = 15
BOND_MIN_RATING = "BBB"
CASH_LIMIT_LOW = 150_000.0
CASH_LIMIT_HIGH = 200_000.0

# --- Escenarios de venta (hoja Escenarios) ---
BROKER_COMMISSION_RATE = 0.011            # 1,1 % sobre valor bruto
TRANSACTION_FEE_USD = 3.0

# Días base usados en las hojas
DAYS_YEAR_TERM = 365                      # Plazo Inicial de Compra
DAYS_YEAR_HOLDING = 360                   # Plazo al Vencimiento / t de escenarios


def month_name_to_index(name: str) -> int:
    return MONTH_INDEX.get((name or "").strip().lower(), 0)


def month_index_to_name(idx: int) -> str:
    return MONTHS_ES[idx - 1] if 1 <= idx <= 12 else ""


def report_label(year: int, month_idx: int) -> str:
    """'ago 2026' como la columna 'Fecha Informe'."""
    abbr = MONTH_ABBR_ES[month_idx - 1] if 1 <= month_idx <= 12 else "?"
    return f"{abbr} {year}"
