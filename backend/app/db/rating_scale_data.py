"""Tabla de referencia de calificación crediticia (hoja `Parametros`, B44:G61)."""

INV = "GRADO DE INVERSIÓN"
SPEC = "GRADO ESPECULATIVO"

RATING_SCALE: list[dict] = [
    {"fitch": "AAA",  "sp": "AAA",  "moodys": "Aaa",  "grade": INV,  "description": "Mínimo riesgo crediticio",      "scale_1_7": 1},
    {"fitch": "AA+",  "sp": "AA+",  "moodys": "Aa1",  "grade": INV,  "description": "Riesgo crediticio muy bajo",     "scale_1_7": 2},
    {"fitch": "AA",   "sp": "AA",   "moodys": "Aa2",  "grade": INV,  "description": "Riesgo crediticio muy bajo",     "scale_1_7": 2},
    {"fitch": "AA-",  "sp": "AA-",  "moodys": "Aa3",  "grade": INV,  "description": "Riesgo crediticio muy bajo",     "scale_1_7": 2},
    {"fitch": "A+",   "sp": "A+",   "moodys": "A1",   "grade": INV,  "description": "Bajo riesgo crediticio",         "scale_1_7": 3},
    {"fitch": "A",    "sp": "A",    "moodys": "A2",   "grade": INV,  "description": "Bajo riesgo crediticio",         "scale_1_7": 3},
    {"fitch": "A-",   "sp": "A-",   "moodys": "A3",   "grade": INV,  "description": "Bajo riesgo crediticio",         "scale_1_7": 3},
    {"fitch": "BBB+", "sp": "BBB+", "moodys": "Baa1", "grade": INV,  "description": "Riesgo crediticio moderado",     "scale_1_7": 4},
    {"fitch": "BBB",  "sp": "BBB",  "moodys": "Baa2", "grade": INV,  "description": "Riesgo crediticio moderado",     "scale_1_7": 4},
    {"fitch": "BBB-", "sp": "BBB-", "moodys": "Baa3", "grade": INV,  "description": "Riesgo crediticio moderado",     "scale_1_7": 4},
    {"fitch": "BB+",  "sp": "BB+",  "moodys": "Ba1",  "grade": SPEC, "description": "Riesgo considerable",            "scale_1_7": 5},
    {"fitch": "BB",   "sp": "BB",   "moodys": "Ba2",  "grade": SPEC, "description": "Riesgo considerable",            "scale_1_7": 5},
    {"fitch": "BB-",  "sp": "BB-",  "moodys": "Ba3",  "grade": SPEC, "description": "Riesgo considerable",            "scale_1_7": 5},
    {"fitch": "B+",   "sp": "B+",   "moodys": "B1",   "grade": SPEC, "description": "Riesgo crediticio alto",         "scale_1_7": 6},
    {"fitch": "B",    "sp": "B",    "moodys": "B2",   "grade": SPEC, "description": "Riesgo crediticio alto",         "scale_1_7": 6},
    {"fitch": "B-",   "sp": "B-",   "moodys": "B3",   "grade": SPEC, "description": "Riesgo crediticio alto",         "scale_1_7": 6},
    {"fitch": "CCC+", "sp": "CCC+", "moodys": "Caa1", "grade": SPEC, "description": "Riesgo crediticio muy alto",     "scale_1_7": 7},
]

PARAMETERS: list[dict] = [
    {"key": "concentracion_limite_activo",   "value_numeric": 500000, "description": "Límite de concentración por valor o activo invertido (USD)"},
    {"key": "concentracion_limite_emisor",   "value_numeric": 500000, "description": "Límite de concentración por emisor (USD)"},
    {"key": "concentracion_limite_grupo",    "value_numeric": 500000, "description": "Límite de concentración por grupo económico (USD)"},
    {"key": "peso_max_renta_fija",           "value_numeric": 0.70,   "description": "Participación máxima de Renta Fija"},
    {"key": "peso_max_renta_variable",       "value_numeric": 0.30,   "description": "Participación máxima de Renta Variable"},
    {"key": "bono_plazo_max_anios",          "value_numeric": 15,     "description": "Plazo máximo de bonos en moneda extranjera (años)"},
    {"key": "bono_calificacion_minima",      "value_text": ">=BBB",   "description": "Calificación crediticia mínima para bonos"},
    {"key": "cash_limite_bajo",              "value_numeric": 150000, "description": "Límite inferior de caja (USD)"},
    {"key": "cash_limite_alto",              "value_numeric": 200000, "description": "Límite superior de caja (USD)"},
    {"key": "comision_broker",               "value_numeric": 0.011,  "description": "Comisión de broker sobre valor bruto de venta"},
    {"key": "fee_transaccion_usd",           "value_numeric": 3,      "description": "Fee fijo por transacción (USD)"},
    {"key": "benchmark_compuesto_anual",     "value_numeric": 0.06793,"description": "Benchmark compuesto (tasa anual, editable)"},
    {"key": "benchmark_institucional_anual", "value_numeric": 0.082,  "description": "Benchmark institucional (tasa anual, editable)"},
]
