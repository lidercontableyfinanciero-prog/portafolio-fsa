from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.services import portfolio_repo as repo
from app.services.etl import parse_upload

router = APIRouter(prefix="/etl", tags=["etl"])

_MAX_BYTES = 25 * 1024 * 1024


@router.post("/upload", dependencies=[Depends(require_admin)])
async def upload(
    file: UploadFile = File(...),
    dry_run: bool = False,
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(
        (".csv", ".xlsx", ".xlsm", ".xls")
    ):
        raise HTTPException(status_code=400, detail="Formato no soportado. Use CSV o Excel.")
    content = await file.read()
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (máx. 25 MB).")

    try:
        parsed = parse_upload(content, file.filename)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"No se pudo leer el archivo: {exc}") from exc

    summary = {
        "filename": file.filename,
        "total_rows": parsed.total_rows,
        "valid_rows": parsed.ok_rows,
        "errors": parsed.errors[:200],
        "error_count": len(parsed.errors),
        "detected_columns": parsed.detected_columns,
        "ignored_columns": parsed.ignored_columns,
        "dry_run": dry_run,
    }
    if dry_run or not parsed.rows:
        return summary

    counts = repo.upsert_parsed_rows(db, parsed.rows)
    repo.recompute_monthly_returns(db)
    db.commit()
    summary.update(counts)
    return summary
