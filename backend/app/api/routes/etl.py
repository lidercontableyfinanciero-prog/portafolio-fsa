from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.models.ingestion_log import IngestionLog, IngestionStatus
from app.models.user import User
from app.services import portfolio_repo as repo
from app.services.etl import parse_upload

router = APIRouter(prefix="/etl", tags=["etl"])

_MAX_BYTES = 25 * 1024 * 1024


def _log(db: Session, **kw) -> IngestionLog:
    entry = IngestionLog(**kw)
    db.add(entry)
    db.flush()
    return entry


def _serialize(log: IngestionLog) -> dict:
    return {
        "id": log.id,
        "uploaded_at": log.created_at,
        "filename": log.filename,
        "uploaded_by": log.uploaded_by_email,
        "status": log.status.value,
        "dry_run": log.dry_run,
        "replace_mode": log.replace_mode,
        "total_rows": log.total_rows,
        "valid_rows": log.valid_rows,
        "error_count": log.error_count,
        "instruments_upserted": log.instruments_upserted,
        "snapshots_inserted": log.snapshots_inserted,
        "snapshots_updated": log.snapshots_updated,
        "snapshots_deleted": log.snapshots_deleted,
        "periods": log.periods,
        "message": log.message,
        "content_sha256": log.content_sha256,
    }


@router.post("/upload", dependencies=[Depends(require_admin)])
async def upload(
    file: UploadFile = File(...),
    dry_run: bool = Query(False, description="Solo previsualiza, no escribe."),
    replace: bool = Query(
        False, description="Sobrescribe los meses que ya estuvieran cargados."
    ),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith(
        (".csv", ".xlsx", ".xlsm", ".xls")
    ):
        raise HTTPException(status_code=400, detail="Formato no soportado. Use CSV o Excel.")
    content = await file.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (máx. 25 MB).")

    sha = hashlib.sha256(content).hexdigest()
    base_log = dict(
        filename=file.filename,
        content_sha256=sha,
        uploaded_by_id=admin.id,
        uploaded_by_email=admin.email,
        dry_run=dry_run,
        replace_mode=replace,
    )

    # --- 1. Parseo ---
    try:
        parsed = parse_upload(content, file.filename)
    except Exception as exc:  # noqa: BLE001
        _log(db, status=IngestionStatus.error, message=f"No se pudo leer el archivo: {exc}",
             **base_log)
        db.commit()
        raise HTTPException(status_code=422, detail=f"No se pudo leer el archivo: {exc}") from exc

    incoming = parsed.periods
    existing = repo.periods_with_data(db, incoming)  # {(year, month): count}

    # ¿archivo idéntico ya cargado con éxito?
    prior_same = db.execute(
        select(IngestionLog)
        .where(
            IngestionLog.content_sha256 == sha,
            IngestionLog.status.in_([IngestionStatus.success, IngestionStatus.partial]),
        )
        .order_by(IngestionLog.created_at.desc())
    ).scalars().first()

    summary = {
        "filename": file.filename,
        "content_sha256": sha,
        "total_rows": parsed.total_rows,
        "valid_rows": parsed.ok_rows,
        "errors": parsed.errors[:200],
        "error_count": len(parsed.errors),
        "detected_columns": parsed.detected_columns,
        "ignored_columns": parsed.ignored_columns,
        "periods": parsed.period_labels,
        "existing_periods": [
            {"year": y, "month": m, "rows": cnt} for (y, m), cnt in existing.items()
        ],
        "identical_file_loaded_at": (
            prior_same.created_at.isoformat() if prior_same else None
        ),
        "dry_run": dry_run,
        "replace": replace,
    }

    # --- 2. Previsualización ---
    if dry_run:
        _log(db, status=IngestionStatus.dry_run,
             total_rows=parsed.total_rows, valid_rows=parsed.ok_rows,
             error_count=len(parsed.errors), periods=parsed.period_labels,
             message="Previsualización.", **base_log)
        db.commit()
        return summary

    if not parsed.rows:
        _log(db, status=IngestionStatus.error, message="El archivo no contiene filas válidas.",
             total_rows=parsed.total_rows, error_count=len(parsed.errors), **base_log)
        db.commit()
        raise HTTPException(status_code=422, detail="El archivo no contiene filas válidas.")

    # --- 3. Regla anti-duplicado por mes ---
    if existing and not replace:
        detalle = ", ".join(f"{m} {y} ({cnt} registros)" for (y, m), cnt in existing.items())
        msg = (
            f"El extracto de {detalle} ya fue cargado anteriormente. "
            f"Vuelva a intentarlo marcando «reemplazar» para sobrescribir esos meses."
        )
        _log(db, status=IngestionStatus.conflict, message=msg,
             total_rows=parsed.total_rows, valid_rows=parsed.ok_rows,
             error_count=len(parsed.errors), periods=parsed.period_labels, **base_log)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": msg, "existing_periods": summary["existing_periods"]},
        )

    # --- 4. Escritura ---
    deleted = 0
    if replace and existing:
        deleted = repo.delete_snapshots_for_periods(db, list(existing.keys()))
    counts = repo.upsert_parsed_rows(db, parsed.rows)
    repo.recompute_monthly_returns(db)

    st = IngestionStatus.partial if parsed.errors else IngestionStatus.success
    parts = [
        f"{counts['snapshots_inserted']} nuevos",
        f"{counts['snapshots_updated']} actualizados",
    ]
    if deleted:
        parts.append(f"{deleted} reemplazados")
    if parsed.errors:
        parts.append(f"{len(parsed.errors)} con error")
    log = _log(
        db, status=st, message=" · ".join(parts),
        total_rows=parsed.total_rows, valid_rows=parsed.ok_rows,
        error_count=len(parsed.errors),
        instruments_upserted=counts["instruments"],
        snapshots_inserted=counts["snapshots_inserted"],
        snapshots_updated=counts["snapshots_updated"],
        snapshots_deleted=deleted,
        periods=parsed.period_labels,
        **base_log,
    )
    db.commit()

    summary.update(counts)
    summary["snapshots_deleted"] = deleted
    summary["status"] = st.value
    summary["log_id"] = log.id
    return summary


@router.get("/history", dependencies=[Depends(require_admin)])
def history(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    include_dry_run: bool = Query(False),
):
    stmt = select(IngestionLog).order_by(IngestionLog.created_at.desc())
    if not include_dry_run:
        stmt = stmt.where(IngestionLog.status != IngestionStatus.dry_run)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    logs = db.execute(stmt.limit(limit).offset(offset)).scalars().all()
    return {
        "total": total or 0,
        "limit": limit,
        "offset": offset,
        "items": [_serialize(x) for x in logs],
    }
