"""ETL de carga: CSV / XLSX del extracto → registros limpios (instrumento + snapshot).

- Descarta columnas sin encabezado, `Unnamed:*` y columnas 100 % vacías.
- Mapea encabezados bilingües ("Total Cost Basis /\\nBase de Costo Total").
- Normaliza fechas, montos y porcentajes.

Ver docs/DATA_DICTIONARY.md.
"""

from __future__ import annotations

import io
import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime

import pandas as pd
from dateutil import parser as dateparser

from app.services.constants import month_index_to_name, month_name_to_index

# --------------------------------------------------------------------------- #
# Mapeo de encabezados
# --------------------------------------------------------------------------- #
# (substring en minúsculas sin acentos, campo canónico). Primer match gana.
_HEADER_PATTERNS: list[tuple[str, str]] = [
    ("statement year", "statement_year"),
    ("ano del extracto", "statement_year"),
    ("statement month", "statement_month"),
    ("mes del extracto", "statement_month"),
    ("classification", "classification"),
    ("clasificacion", "classification"),
    ("description", "description"),
    ("descripcion", "description"),
    ("sector", "sector"),
    ("acquired date", "acquired_date"),
    ("fecha de compra", "acquired_date"),
    ("total cost basis", "total_cost_basis"),
    ("base de costo total", "total_cost_basis"),
    ("market price", "market_price"),
    ("precio de mercado", "market_price"),
    ("estimated market value", "estimated_market_value"),
    ("valor de mercado estimado", "estimated_market_value"),
    ("unrealized gain", "unrealized_gain_loss"),
    ("no realizada", "unrealized_gain_loss"),
    ("estimated accrued interest", "accrued_interest"),
    ("interes acumulado estimado", "accrued_interest"),
    ("estimated annual income", "annual_income"),
    ("ingreso anual estimado", "annual_income"),
    ("current yield", "current_yield"),
    ("rendimiento actual", "current_yield"),
    ("moody", "moodys_rating"),
    ("s&p rating", "sp_rating"),
    ("calificacion s&p", "sp_rating"),
    ("coupon rate", "coupon_rate"),
    ("tasa de cupon", "coupon_rate"),
    ("maturity date", "maturity_date"),
    ("fecha de vencimiento", "maturity_date"),
    ("call date", "call_date"),
    ("identifier", "identifier"),
    ("identificador", "identifier"),
    ("cusip", "identifier"),
    ("intereses/dividendos pagados", "dividends_paid"),
    ("dividendos pagados", "dividends_paid"),
    ("impuesto", "tax"),
    ("quantity", "quantity"),
    ("cantidad", "quantity"),
    ("type", "type"),
    ("tipo", "type"),
]

_NUMERIC_FIELDS = {
    "quantity", "total_cost_basis", "market_price", "estimated_market_value",
    "unrealized_gain_loss", "accrued_interest", "annual_income",
    "dividends_paid", "tax",
}
_PERCENT_FIELDS = {"current_yield", "coupon_rate"}
_DATE_FIELDS = {"acquired_date", "maturity_date", "call_date"}

_INSTRUMENT_FIELDS = {
    "identifier", "description", "classification", "type", "sector",
    "moodys_rating", "sp_rating", "coupon_rate", "maturity_date", "call_date",
}
_SNAPSHOT_FIELDS = {
    "statement_year", "statement_month", "acquired_date", "quantity",
    "total_cost_basis", "market_price", "estimated_market_value",
    "unrealized_gain_loss", "accrued_interest", "annual_income",
    "current_yield", "dividends_paid", "tax",
}

_ACCENTS = str.maketrans("áéíóúñ", "aeioun")


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", str(text)).strip().lower().translate(_ACCENTS)


def map_headers(columns: list[str]) -> dict[str, str]:
    """{nombre_columna_original: campo_canónico}. Cada campo se asigna una sola vez."""
    mapping: dict[str, str] = {}
    used: set[str] = set()
    for col in columns:
        raw = str(col)
        if not raw or raw.lower().startswith("unnamed"):
            continue
        left = _norm(raw.split("/")[0]) if "/" in raw else _norm(raw)
        whole = _norm(raw)
        for pattern, target in _HEADER_PATTERNS:
            if target in used:
                continue
            if pattern in left or pattern in whole:
                mapping[col] = target
                used.add(target)
                break
    return mapping


# --------------------------------------------------------------------------- #
# Parsers de valores
# --------------------------------------------------------------------------- #
def _is_blank(v) -> bool:
    if v is None:
        return True
    if isinstance(v, float) and math.isnan(v):
        return True
    return str(v).strip() in ("", "-", "N/A", "n/a", "NULL", "None", "#N/A")


def parse_number(v) -> float | None:
    if _is_blank(v):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("$", "").replace("%", "").replace(" ", "")
    s = s.replace("(", "-").replace(")", "")
    if s.count(",") and s.count("."):
        s = s.replace(",", "")           # 1,234.56
    elif s.count(",") and not s.count("."):
        s = s.replace(",", ".")          # 1234,56
    try:
        return float(s)
    except ValueError:
        return None


def parse_percent(v) -> float | None:
    n = parse_number(v)
    if n is None:
        return None
    # el Excel guarda fracciones (0.095). Si viene como 9.5 (con %), normalizar.
    if isinstance(v, str) and "%" in v:
        return n / 100.0
    return n / 100.0 if abs(n) > 1.5 else n


def parse_date(v) -> date | None:
    if _is_blank(v):
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)):
        # serial de Excel
        try:
            return (pd.Timestamp("1899-12-30") + pd.to_timedelta(int(v), unit="D")).date()
        except (ValueError, OverflowError):
            return None
    try:
        return dateparser.parse(str(v), dayfirst=False).date()
    except (ValueError, OverflowError, TypeError):
        try:
            return dateparser.parse(str(v), dayfirst=True).date()
        except (ValueError, OverflowError, TypeError):
            return None


# --------------------------------------------------------------------------- #
# Resultado
# --------------------------------------------------------------------------- #
@dataclass
class ParsedRow:
    instrument: dict
    snapshot: dict


@dataclass
class EtlResult:
    rows: list[ParsedRow] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    detected_columns: dict[str, str] = field(default_factory=dict)
    ignored_columns: list[str] = field(default_factory=list)
    total_rows: int = 0

    @property
    def ok_rows(self) -> int:
        return len(self.rows)


# Nombres de hoja de datos aceptados, en orden de preferencia. NO se usa "Hoja2"
# (es la fuente interna de las tablas dinámicas, con columnas y filas basura).
_DATA_SHEET_PRIORITY = ["base de datos", "base datos"]


def _load_dataframe(content: bytes, filename: str) -> pd.DataFrame:
    name = filename.lower()
    if name.endswith((".xlsx", ".xlsm", ".xls")):
        xls = pd.ExcelFile(io.BytesIO(content))
        norm_to_name = {_norm(s): s for s in xls.sheet_names}
        sheet = next(
            (norm_to_name[p] for p in _DATA_SHEET_PRIORITY if p in norm_to_name),
            None,
        )
        if sheet is None:
            # cualquier hoja que contenga "base" y "datos", si no la primera
            sheet = next(
                (s for s in xls.sheet_names if "base" in _norm(s) and "dato" in _norm(s)),
                xls.sheet_names[0],
            )
        return xls.parse(sheet, dtype=object)
    return pd.read_csv(io.BytesIO(content), dtype=object, sep=None, engine="python")


def parse_upload(content: bytes, filename: str) -> EtlResult:
    df = _load_dataframe(content, filename)

    # 1. columnas a ignorar: sin encabezado / Unnamed / 100 % vacías
    ignored: list[str] = []
    keep_cols: list[str] = []
    for col in df.columns:
        blank_header = (not str(col).strip()) or str(col).lower().startswith("unnamed")
        all_empty = df[col].map(_is_blank).all()
        if blank_header or all_empty:
            ignored.append(str(col))
        else:
            keep_cols.append(col)
    df = df[keep_cols]

    header_map = map_headers(list(df.columns))
    result = EtlResult(
        detected_columns={str(k): v for k, v in header_map.items()},
        ignored_columns=ignored,
        total_rows=int(len(df)),
    )
    if "identifier" not in header_map.values():
        result.errors.append({"row": None, "error": "No se encontró la columna Identifier (CUSIP/CINS)."})
        return result

    for idx, raw in df.iterrows():
        rec: dict = {}
        for col, target in header_map.items():
            val = raw[col]
            if target in _DATE_FIELDS:
                rec[target] = parse_date(val)
            elif target in _PERCENT_FIELDS:
                rec[target] = parse_percent(val)
            elif target in _NUMERIC_FIELDS:
                rec[target] = parse_number(val)
            elif target == "statement_year":
                n = parse_number(val)
                rec[target] = int(n) if n is not None else None
            elif target == "statement_month":
                s = str(val).strip()
                rec[target] = month_index_to_name(int(float(s))) if s.replace(".", "").isdigit() else s
            else:
                rec[target] = None if _is_blank(val) else str(val).strip()

        row_num = int(idx) + 2  # +1 header, +1 base-1

        # Identificador: los extractos traen CUSIP/CINS salvo en Efectivo
        # (Money Accounts / Cash), que se agrega en una sola línea por mes.
        identifier = rec.get("identifier")
        if _is_blank(identifier):
            desc = rec.get("description")
            cls = rec.get("classification")
            typ = rec.get("type")
            if not _is_blank(desc):
                identifier = str(desc).strip()
            elif not _is_blank(cls) or not _is_blank(typ):
                identifier = f"{cls or 'SIN-CLASE'} · {typ or 'SIN-TIPO'}"
            else:
                continue  # fila totalmente vacía: se omite
            if _is_blank(rec.get("description")):
                rec["description"] = str(identifier)

        if not rec.get("statement_year") or not rec.get("statement_month"):
            result.errors.append(
                {"row": row_num, "error": "Falta año o mes del extracto.", "identifier": identifier}
            )
            continue
        if month_name_to_index(rec["statement_month"]) == 0:
            result.errors.append(
                {"row": row_num, "error": f"Mes no reconocido: {rec['statement_month']!r}",
                 "identifier": identifier}
            )
            continue

        instrument = {k: rec.get(k) for k in _INSTRUMENT_FIELDS if k in rec}
        instrument["identifier"] = str(identifier).strip()
        snapshot = {k: rec.get(k) for k in _SNAPSHOT_FIELDS if k in rec}

        # Mark-to-Market autoritativo
        mv = snapshot.get("estimated_market_value")
        cb = snapshot.get("total_cost_basis")
        if mv is not None and cb is not None:
            snapshot["unrealized_gain_loss"] = mv - cb

        mi = month_name_to_index(rec["statement_month"])
        snapshot["report_date"] = date(int(rec["statement_year"]), mi, 1)

        result.rows.append(ParsedRow(instrument=instrument, snapshot=snapshot))

    return result
