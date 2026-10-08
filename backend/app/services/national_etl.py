"""ETL de la base "Base de Datos Portafolio Inversiones Nacionales" (hoja `Data_Nal`).

Lee el libro (o CSV), valida estructura y tipos, y devuelve `Movement`s limpios.
Las columnas calculadas del Excel (Valor Depurado, 20% Renta, Años Rest., CAL,
Indicador…) se ignoran: el sistema las recalcula en `services/national.py`.

Política de errores: si falta una columna obligatoria, el archivo está vacío o
alguna fila tiene datos inválidos, la importación se rechaza completa y se
informa cada inconsistencia (el saldo de un fondo depende de todos sus
movimientos del mes: cargar parcialmente produciría cifras erróneas).
"""

from __future__ import annotations

import io
import math
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime

import pandas as pd

from app.services.constants import month_name_to_index
from app.services.national import KNOWN_CONCEPTS, Movement, norm, normalize_type


def _key(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace("\n", " ").split())


# encabezado normalizado -> (campo, obligatorio)
COLUMNS: dict[str, tuple[str, bool]] = {
    "ano": ("year", True),
    "mes": ("month", True),
    "entidad": ("entity", True),
    "tipo de inversion": ("investment_type", True),
    "nombre de la inversion": ("name", True),
    "concepto del movimiento": ("concept", True),
    "valor": ("value", True),
    "tipo de movimiento": ("movement_type", False),
    "valor nominal": ("nominal_value", False),
    "valor de compra": ("purchase_value", False),
    "tasa cupon": ("coupon_rate", False),
    "tasa em": ("rate_em", False),
    "fecha de emision": ("issue_date", False),
    "fecha de compra": ("purchase_date", False),
    "fecha de vencimiento": ("maturity_date", False),
    "estado": ("status", False),
    "giro de venta": ("sale_value", False),
    "p&g": ("pnl", False),
    "tir tenencia": ("holding_irr", False),
    "tasa de venta": ("sale_rate", False),
    "nemo": ("nemo", False),
    "ref": ("ref", False),
    "per": ("per", False),
}
REQUIRED_LABELS = {
    "year": "Año", "month": "Mes", "entity": "Entidad",
    "investment_type": "Tipo de Inversión", "name": "Nombre de la Inversión",
    "concept": "Concepto del Movimiento", "value": "Valor",
}
NUMERIC = {"value", "nominal_value", "purchase_value", "coupon_rate", "rate_em",
           "sale_value", "pnl", "holding_irr", "sale_rate"}
DATES = {"issue_date", "purchase_date", "maturity_date"}
TEXT = {"entity", "investment_type", "name", "concept", "movement_type", "status",
        "nemo", "ref", "per"}
# Conceptos sin monto (solo describen la composición del título)
_NO_VALUE_CONCEPTS = {"composición de portafolio"}


@dataclass(slots=True)
class ParseResult:
    movements: list[Movement] = field(default_factory=list)
    total_rows: int = 0
    errors: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    missing_columns: list[str] = field(default_factory=list)
    detected_columns: dict[str, str] = field(default_factory=dict)
    ignored_columns: list[str] = field(default_factory=list)
    sheet: str | None = None

    @property
    def ok(self) -> bool:
        return not self.missing_columns and not self.errors and bool(self.movements)

    @property
    def periods(self) -> list[tuple[int, int]]:
        return sorted({(m.year, m.month) for m in self.movements})


def _empty(v) -> bool:
    return v is None or (isinstance(v, float) and math.isnan(v)) or (
        isinstance(v, str) and not v.strip()
    )


def _num(v):
    if _empty(v):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("$", "").replace(" ", "")
    pct = s.endswith("%")
    s = s.rstrip("%")
    if "," in s and "." in s:          # 1.234.567,89 -> 1234567.89
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    f = float(s)                       # ValueError -> fila inválida
    return f / 100 if pct else f


def _date(v):
    if _empty(v):
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, pd.Timestamp):
        return v.date()
    if isinstance(v, (int, float)):    # serial de Excel
        return (pd.Timestamp("1899-12-30") + pd.Timedelta(days=float(v))).date()
    s = str(v).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    raise ValueError(f"fecha no reconocida: {s!r}")


def _read_frame(content: bytes, filename: str) -> tuple[pd.DataFrame, str | None]:
    name = (filename or "").lower()
    if name.endswith(".csv"):
        return pd.read_csv(io.BytesIO(content), dtype=object), None
    sheets = pd.read_excel(io.BytesIO(content), sheet_name=None, dtype=object)
    if not sheets:
        raise ValueError("El libro no tiene hojas.")
    # Hoja `Data_Nal` si existe; si no, la primera que tenga los encabezados obligatorios.
    for title, df in sheets.items():
        if _key(title) == "data_nal":
            return df, title
    for title, df in sheets.items():
        keys = {_key(c) for c in df.columns}
        if {"nombre de la inversion", "concepto del movimiento"} <= keys:
            return df, title
    title = next(iter(sheets))
    return sheets[title], title


def parse_national(content: bytes, filename: str) -> ParseResult:
    res = ParseResult()
    if not content:
        res.errors.append({"row": None, "error": "El archivo está vacío."})
        return res
    try:
        df, res.sheet = _read_frame(content, filename)
    except Exception as exc:  # noqa: BLE001
        res.errors.append({"row": None, "error": f"No se pudo leer el archivo: {exc}"})
        return res

    colmap: dict[str, str] = {}
    for col in df.columns:
        k = _key(col)
        if k in COLUMNS:
            field_name = COLUMNS[k][0]
            if field_name not in colmap.values():
                colmap[col] = field_name
                res.detected_columns[str(col)] = field_name
                continue
        res.ignored_columns.append(str(col))
    present = set(colmap.values())
    res.missing_columns = [lbl for f, lbl in REQUIRED_LABELS.items() if f not in present]
    if res.missing_columns:
        return res

    df = df.rename(columns=colmap)[list(colmap.values())]
    df = df.dropna(how="all")
    res.total_rows = len(df)
    if not res.total_rows:
        res.errors.append({"row": None, "error": "El archivo no contiene registros."})
        return res

    unknown_concepts: set[str] = set()
    unknown_types: set[str] = set()
    no_value_rows: list[int] = []
    for i, rec in enumerate(df.to_dict(orient="records")):
        row_no = int(df.index[i]) + 2  # +1 encabezado, +1 base 1 (fila de Excel)
        problems: list[str] = []
        data: dict = {}
        for f in TEXT:
            if f in rec:
                v = rec[f]
                data[f] = None if _empty(v) else str(v).strip()
        for f in NUMERIC:
            if f in rec:
                try:
                    data[f] = _num(rec[f])
                except (ValueError, TypeError):
                    problems.append(f"valor no numérico en «{f}»: {rec[f]!r}")
        for f in DATES:
            if f in rec:
                try:
                    data[f] = _date(rec[f])
                except (ValueError, TypeError, OverflowError) as exc:
                    problems.append(f"fecha inválida en «{f}» ({exc})")
        try:
            year = int(float(str(rec.get("year")).strip()))
            if not 2000 <= year <= 2100:
                raise ValueError
        except (ValueError, TypeError):
            problems.append(f"Año inválido: {rec.get('year')!r}")
            year = 0
        month = month_name_to_index(str(rec.get("month") or ""))
        if not month:
            problems.append(f"Mes inválido: {rec.get('month')!r}")
        for f in ("entity", "investment_type", "name", "concept"):
            if not data.get(f):
                problems.append(f"falta «{REQUIRED_LABELS[f]}»")
        concept = norm(data.get("concept"))
        if concept and concept not in _NO_VALUE_CONCEPTS and data.get("value") is None \
                and concept in KNOWN_CONCEPTS - {"composición de portafolio"}:
            no_value_rows.append(row_no)  # sin valor: se toma como 0 y se advierte
        if concept and concept not in KNOWN_CONCEPTS:
            unknown_concepts.add(data.get("concept") or "")
        if data.get("investment_type") and not normalize_type(data["investment_type"]):
            unknown_types.add(data["investment_type"])

        if problems:
            res.errors.append({
                "row": row_no, "name": data.get("name"), "error": "; ".join(problems),
            })
            continue
        res.movements.append(Movement(year=year, month=month, **data))

    if no_value_rows:
        sample = ", ".join(str(r) for r in no_value_rows[:12])
        more = "…" if len(no_value_rows) > 12 else ""
        res.warnings.append(
            f"{len(no_value_rows)} movimientos sin «Valor» se toman como 0 "
            f"(filas {sample}{more})."
        )
    for c in sorted(unknown_concepts):
        res.warnings.append(
            f"Concepto no reconocido «{c}»: se guarda pero no interviene en los cálculos."
        )
    for t in sorted(unknown_types):
        res.warnings.append(
            f"Tipo de inversión no reconocido «{t}»: se trata como FIC y queda para revisión."
        )
    return res
