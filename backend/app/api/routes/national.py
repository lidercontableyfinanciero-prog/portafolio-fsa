"""API del Portafolio Nacional (COP). Todas las rutas exigen el permiso del módulo.

Lectura: un único endpoint `/national/report` entrega el modelo completo
(KPIs, distribución, rentabilidad, benchmark, límites, alertas y posiciones)
calculado por `services/national.py` -> todas las pantallas leen la misma cifra.
"""

from __future__ import annotations

import hashlib
from dataclasses import asdict

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_national, require_upload_permission
from app.core.database import get_db
from app.models.ingestion_log import IngestionLog, IngestionStatus
from app.models.national import NationalAsset, NationalIpc, NationalMovement
from app.models.parameter import Parameter
from app.models.user import User
from app.services import exporters
from app.services import national_repo as repo
from app.services.national import (
    BENCH_IPC,
    BENCH_IPC_SPREAD,
    GROUPS,
    TYPE_ORDER,
    Filters,
    period_label,
)
from app.services.national_etl import parse_national
from app.services.report_columns import (
    NATIONAL_DEFAULT_COLUMNS,
    NATIONAL_REPORT_COLUMNS,
)
from app.services.report_columns import catalog as column_catalog

router = APIRouter(prefix="/national", tags=["national"], dependencies=[Depends(require_national)])

_MAX_BYTES = 25 * 1024 * 1024
_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _set(values: list[str] | None) -> set[str] | None:
    s = {v for v in values or [] if v}
    return s or None


def _filters(
    type: list[str] | None = Query(None),
    entity: list[str] | None = Query(None),
    group: list[str] | None = Query(None),
    issuer: list[str] | None = Query(None),
    status_: list[str] | None = Query(None, alias="status"),
) -> Filters:
    return Filters(
        asset_type=_set(type), entity=_set(entity), group=_set(group),
        issuer=_set(issuer), status=_set(status_),
    )


def _cut(year: int | None, month: int | None):
    return (year, month) if year and month else None


def _report(db: Session, year, month, flt: Filters | None = None) -> dict:
    if not repo.has_data(db):
        raise HTTPException(
            status_code=404,
            detail="No hay información del Portafolio Nacional. Importe la base de datos.",
        )
    return repo.report(db, _cut(year, month), flt)


def _serialize(rep: dict) -> dict:
    out = dict(rep)
    out["assets"] = [asdict(a) for a in rep["assets"]]
    return out


# --------------------------------------------------------------------------- #
# Lectura
# --------------------------------------------------------------------------- #
@router.get("/status")
def data_status(db: Session = Depends(get_db)):
    has = repo.has_data(db)
    periods = []
    if has:
        rows = db.execute(
            select(NationalMovement.year, NationalMovement.month, func.count(NationalMovement.id))
            .group_by(NationalMovement.year, NationalMovement.month)
            .order_by(NationalMovement.year, NationalMovement.month)
        ).all()
        periods = [
            {"year": y, "month": m, "label": period_label((y, m)), "rows": c}
            for y, m, c in rows
        ]
    pending = db.execute(
        select(NationalAsset.name).where(NationalAsset.needs_review.is_(True))
    ).scalars().all()
    return {"has_data": has, "periods": periods, "assets_needing_review": pending}


@router.get("/report")
def report(
    db: Session = Depends(get_db),
    year: int | None = None,
    month: int | None = Query(None, ge=1, le=12),
    flt: Filters = Depends(_filters),
):
    return _serialize(_report(db, year, month, flt))


@router.get("/filters")
def filter_options(db: Session = Depends(get_db)):
    assets = db.execute(select(NationalAsset)).scalars().all()
    entities = db.execute(select(NationalMovement.entity).distinct()).scalars().all()
    return {
        "types": TYPE_ORDER,
        "groups": GROUPS,
        "entities": sorted({e for e in entities if e}),
        "issuers": sorted({a.issuer for a in assets}),
        "statuses": ["Vigente", "Vendido / Vencido"],
    }


@router.get("/movements")
def movements(
    db: Session = Depends(get_db),
    name: str = Query(..., description="Nombre de la inversión"),
    year: int | None = None,
    month: int | None = Query(None, ge=1, le=12),
):
    """Movimientos de la base para una inversión (detalle de la posición)."""
    stmt = select(NationalMovement).where(NationalMovement.name == name)
    if year and month:
        stmt = stmt.where(NationalMovement.year == year, NationalMovement.month == month)
    rows = db.execute(
        stmt.order_by(NationalMovement.year, NationalMovement.month, NationalMovement.id)
    ).scalars().all()
    return [
        {
            "year": r.year, "month": r.month, "period": period_label((r.year, r.month)),
            "concept": r.concept, "movement_type": r.movement_type,
            "value": float(r.value) if r.value is not None else None,
        }
        for r in rows
    ]


# --------------------------------------------------------------------------- #
# Catálogo, IPC y parámetros (lectura: módulo; edición: admin)
# --------------------------------------------------------------------------- #
def _asset_out(a: NationalAsset) -> dict:
    return {
        "name": a.name, "asset_type": a.asset_type, "group": a.group, "issuer": a.issuer,
        "entity": a.entity, "low_liquidity": a.low_liquidity, "benchmark": a.benchmark,
        "needs_review": a.needs_review,
    }


@router.get("/catalog")
def catalog(db: Session = Depends(get_db)):
    rows = db.execute(select(NationalAsset).order_by(NationalAsset.name)).scalars().all()
    return {
        "assets": [_asset_out(a) for a in rows],
        "options": {"types": TYPE_ORDER, "groups": GROUPS,
                    "benchmarks": [BENCH_IPC, BENCH_IPC_SPREAD]},
    }


class AssetIn(BaseModel):
    asset_type: str
    group: str
    issuer: str = Field(min_length=1)
    entity: str | None = None
    low_liquidity: bool
    benchmark: str


@router.put("/catalog/{name:path}", dependencies=[Depends(require_admin)])
def update_asset(name: str, body: AssetIn, db: Session = Depends(get_db)):
    a = db.get(NationalAsset, name)
    if a is None:
        raise HTTPException(status_code=404, detail="Inversión no encontrada en el catálogo.")
    if body.asset_type not in TYPE_ORDER:
        raise HTTPException(status_code=400, detail=f"Tipo inválido: {body.asset_type}")
    if body.group not in GROUPS:
        raise HTTPException(status_code=400, detail=f"Grupo inválido: {body.group}")
    if body.benchmark not in (BENCH_IPC, BENCH_IPC_SPREAD):
        raise HTTPException(status_code=400, detail=f"Benchmark inválido: {body.benchmark}")
    a.asset_type, a.group = body.asset_type, body.group
    a.issuer, a.entity = body.issuer.strip(), (body.entity or "").strip() or None
    a.low_liquidity, a.benchmark = body.low_liquidity, body.benchmark
    a.needs_review = False
    db.commit()
    return _asset_out(a)


@router.get("/ipc")
def ipc_list(db: Session = Depends(get_db)):
    rows = db.execute(select(NationalIpc).order_by(NationalIpc.year, NationalIpc.month)).scalars()
    return [
        {"year": r.year, "month": r.month, "label": period_label((r.year, r.month)),
         "ipc_ytd": float(r.ipc_ytd) if r.ipc_ytd is not None else None,
         "ipc_12m": float(r.ipc_12m) if r.ipc_12m is not None else None,
         "source": r.source}
        for r in rows
    ]


class IpcIn(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    ipc_ytd: float | None = Field(None, ge=-1, le=1)
    ipc_12m: float | None = Field(None, ge=-1, le=1)
    source: str | None = None


@router.put("/ipc", dependencies=[Depends(require_admin)])
def ipc_upsert(body: IpcIn, db: Session = Depends(get_db)):
    row = db.execute(
        select(NationalIpc).where(NationalIpc.year == body.year, NationalIpc.month == body.month)
    ).scalar_one_or_none()
    if row is None:
        row = NationalIpc(year=body.year, month=body.month)
        db.add(row)
    row.ipc_ytd, row.ipc_12m, row.source = body.ipc_ytd, body.ipc_12m, body.source
    db.commit()
    return {"ok": True}


@router.get("/parameters")
def parameters(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Parameter).where(Parameter.key.startswith("nal_")).order_by(Parameter.key)
    ).scalars().all()
    return [
        {"key": p.key,
         "value_numeric": float(p.value_numeric) if p.value_numeric is not None else None,
         "value_text": p.value_text, "description": p.description}
        for p in rows
    ]


class ParamIn(BaseModel):
    value_numeric: float | None = None
    value_text: str | None = None


@router.put("/parameters/{key}", dependencies=[Depends(require_admin)])
def parameter_update(key: str, body: ParamIn, db: Session = Depends(get_db)):
    p = db.get(Parameter, key)
    if p is None or not key.startswith("nal_"):
        raise HTTPException(status_code=404, detail="Parámetro nacional no encontrado.")
    if p.value_text is not None:          # parámetro de texto (p. ej. "2026-07")
        p.value_text = (body.value_text or "").strip() or None
    else:
        if body.value_numeric is None:
            raise HTTPException(status_code=400, detail="Este parámetro requiere un valor numérico.")
        p.value_numeric = body.value_numeric
    db.commit()
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Importación
# --------------------------------------------------------------------------- #
def _log(db: Session, **kw) -> IngestionLog:
    entry = IngestionLog(portfolio="national", **kw)
    db.add(entry)
    db.flush()
    return entry


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    dry_run: bool = Query(False),
    replace: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(require_upload_permission),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Formato no soportado. Use Excel (.xlsx) o CSV.")
    content = await file.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (máx. 25 MB).")
    sha = hashlib.sha256(content).hexdigest()
    base_log = dict(filename=file.filename, content_sha256=sha, uploaded_by_id=user.id,
                    uploaded_by_email=user.username, dry_run=dry_run, replace_mode=replace)

    parsed = parse_national(content, file.filename)
    periods = parsed.periods
    labels = [period_label(p) for p in periods]
    existing = repo.periods_with_data(db, periods)
    summary = {
        "filename": file.filename,
        "sheet": parsed.sheet,
        "total_rows": parsed.total_rows,
        "valid_rows": len(parsed.movements),
        "errors": parsed.errors[:300],
        "error_count": len(parsed.errors),
        "missing_columns": parsed.missing_columns,
        "warnings": parsed.warnings,
        "detected_columns": parsed.detected_columns,
        "ignored_columns": parsed.ignored_columns,
        "periods": labels,
        "existing_periods": [
            {"year": y, "month": m, "label": period_label((y, m)), "rows": c}
            for (y, m), c in existing.items()
        ],
        "new_assets": sorted(
            {m.name for m in parsed.movements}
            - {n for (n,) in db.execute(select(NationalAsset.name)).all()}
        ),
        "dry_run": dry_run,
        "replace": replace,
        "ok": parsed.ok,
    }

    if not parsed.ok:
        reasons = []
        if parsed.missing_columns:
            reasons.append("Faltan columnas: " + ", ".join(parsed.missing_columns))
        if parsed.errors:
            reasons.append(f"{len(parsed.errors)} registros con datos inválidos")
        if not parsed.movements and not parsed.errors and not parsed.missing_columns:
            reasons.append("El archivo no contiene registros")
        msg = "No fue posible importar la base de datos. " + " · ".join(reasons)
        _log(db, status=IngestionStatus.error, message=msg, total_rows=parsed.total_rows,
             valid_rows=len(parsed.movements), error_count=len(parsed.errors),
             periods=labels, **base_log)
        db.commit()
        if dry_run:
            return summary
        raise HTTPException(status_code=422, detail={"message": msg, **summary})

    if dry_run:
        _log(db, status=IngestionStatus.dry_run, message="Previsualización.",
             total_rows=parsed.total_rows, valid_rows=len(parsed.movements), periods=labels,
             **base_log)
        db.commit()
        return summary

    if existing and not replace:
        detalle = ", ".join(f"{period_label(p)} ({c} registros)" for p, c in existing.items())
        msg = (f"Los meses {detalle} ya están cargados. Marque «reemplazar» para "
               "sustituirlos con este archivo.")
        _log(db, status=IngestionStatus.conflict, message=msg, total_rows=parsed.total_rows,
             valid_rows=len(parsed.movements), periods=labels, **base_log)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": msg, "existing_periods": summary["existing_periods"]},
        )

    counts = repo.replace_periods(db, parsed.movements, periods)
    parts = [f"{counts['inserted']} movimientos", f"{len(periods)} meses"]
    if counts["deleted"]:
        parts.append(f"{counts['deleted']} reemplazados")
    if counts["new_assets"]:
        parts.append(f"{len(counts['new_assets'])} inversiones nuevas (revisar catálogo)")
    log = _log(db, status=IngestionStatus.success, message=" · ".join(parts),
               total_rows=parsed.total_rows, valid_rows=len(parsed.movements),
               instruments_upserted=len(counts["new_assets"]),
               snapshots_inserted=counts["inserted"], snapshots_deleted=counts["deleted"],
               periods=labels, **base_log)
    db.commit()
    summary.update(status="success", inserted=counts["inserted"], deleted=counts["deleted"],
                   new_assets=counts["new_assets"], log_id=log.id)
    return summary


@router.get("/history", dependencies=[Depends(require_admin)])
def history(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stmt = (
        select(IngestionLog)
        .where(IngestionLog.portfolio == "national",
               IngestionLog.status != IngestionStatus.dry_run)
        .order_by(IngestionLog.created_at.desc())
    )
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    logs = db.execute(stmt.limit(limit).offset(offset)).scalars().all()
    return {
        "total": total or 0, "limit": limit, "offset": offset,
        "items": [
            {"id": x.id, "uploaded_at": x.created_at, "filename": x.filename,
             "uploaded_by": x.uploaded_by_email, "status": x.status.value,
             "replace_mode": x.replace_mode, "total_rows": x.total_rows,
             "valid_rows": x.valid_rows, "error_count": x.error_count,
             "periods": x.periods, "message": x.message}
            for x in logs
        ],
    }


# --------------------------------------------------------------------------- #
# Exportación (columnas configurables)
# --------------------------------------------------------------------------- #
@router.get("/export/columns")
def export_columns():
    return column_catalog(NATIONAL_REPORT_COLUMNS)


def _export_rows(db, year, month, flt: Filters, search: str | None):
    rep = _report(db, year, month, flt)
    rows = []
    for a in sorted(rep["assets"], key=lambda r: -r.value_cut):
        d = asdict(a)
        if search and search.lower() not in d["name"].lower():
            continue
        d["low_liquidity"] = "Sí" if d["low_liquidity"] else "No"
        rows.append(d)
    filters = {
        "tipo": ", ".join(sorted(flt.asset_type or [])),
        "entidad": ", ".join(sorted(flt.entity or [])),
        "grupo": ", ".join(sorted(flt.group or [])),
        "emisor": ", ".join(sorted(flt.issuer or [])),
        "estado": ", ".join(sorted(flt.status or [])),
        "búsqueda": search,
    }
    meta = {"period": {"month": rep["cut"]["month_name"], "year": rep["cut"]["year"]},
            "filters": filters}
    return rows, meta, rep


_NOTE = ("cifras en COP · corte al {date} · rentabilidad bruta (sin comisiones ni "
         "impuestos) · benchmark Anexo 6 del Reglamento")


@router.get("/export/positions.xlsx")
def export_xlsx(
    db: Session = Depends(get_db),
    year: int | None = None,
    month: int | None = Query(None, ge=1, le=12),
    columns: list[str] | None = Query(None),
    search: str | None = None,
    flt: Filters = Depends(_filters),
):
    rows, meta, rep = _export_rows(db, year, month, flt, search)
    data = exporters.positions_to_xlsx(
        rows, meta, columns, catalog_cols=NATIONAL_REPORT_COLUMNS,
        fallback=NATIONAL_DEFAULT_COLUMNS, title="Portafolio FSA — Inversiones Nacionales",
        note=_NOTE.format(date=rep["cut"]["date"].strftime("%d/%m/%Y")).capitalize(),
    )
    name = f"nacional_{rep['cut']['month_name']}_{rep['cut']['year']}".lower()
    return Response(data, media_type=_XLSX,
                    headers={"Content-Disposition": f'attachment; filename="{name}.xlsx"'})


@router.get("/export/positions.pdf")
def export_pdf(
    db: Session = Depends(get_db),
    year: int | None = None,
    month: int | None = Query(None, ge=1, le=12),
    columns: list[str] | None = Query(None),
    search: str | None = None,
    flt: Filters = Depends(_filters),
):
    rows, meta, rep = _export_rows(db, year, month, flt, search)
    data = exporters.positions_to_pdf(
        rows, meta, columns, catalog_cols=NATIONAL_REPORT_COLUMNS,
        fallback=NATIONAL_DEFAULT_COLUMNS, title="Portafolio FSA — Inversiones Nacionales",
        note=_NOTE.format(date=rep["cut"]["date"].strftime("%d/%m/%Y")),
    )
    name = f"nacional_{rep['cut']['month_name']}_{rep['cut']['year']}".lower()
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'})
