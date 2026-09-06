"""Seed inicial: usuarios, parámetros PIF, tabla de rating, benchmarks y datos
de los Excel de `Referencias/`.

Uso:  python -m app.db.seed
Idempotente: se puede ejecutar varias veces.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import select

from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.db.rating_scale_data import PARAMETERS, RATING_SCALE
from app.models.benchmark import Benchmark
from app.models.parameter import Parameter, RatingScale
from app.models.snapshot import PositionSnapshot
from app.models.user import User, UserRole
from app.services import portfolio_repo as repo
from app.services.constants import month_name_to_index
from app.services.etl import parse_upload
from app.core.security import hash_password


def _seed_users(db) -> None:
    wanted = [
        (settings.seed_admin_email, settings.seed_admin_password, "Administrador FSA", UserRole.admin),
        (settings.seed_lector_email, settings.seed_lector_password, "Lector FSA", UserRole.lector),
    ]
    for email, password, name, role in wanted:
        if db.query(User).filter(User.email == email).first():
            continue
        db.add(
            User(
                email=email,
                hashed_password=hash_password(password),
                full_name=name,
                role=role,
                is_active=True,
            )
        )
    db.commit()
    print(f"  usuarios: {settings.seed_admin_email} / {settings.seed_lector_email}")


def _seed_parameters(db) -> None:
    for row in PARAMETERS:
        p = db.get(Parameter, row["key"])
        if p is None:
            db.add(Parameter(**row))
    if not db.execute(select(RatingScale)).first():
        db.add_all(RatingScale(**r) for r in RATING_SCALE)
    db.commit()
    print(f"  parámetros: {len(PARAMETERS)} · escala de rating: {len(RATING_SCALE)}")


def _seed_data_from_excel(db) -> None:
    path = settings.seed_dir_path / settings.seed_informe_file
    if not path.exists():
        # tolerar ruta montada en Docker
        alt = Path("/app/seed_data") / settings.seed_informe_file
        path = alt if alt.exists() else path
    if not path.exists():
        print(f"  (!) No se encontró el Excel de siembra en {path} — se omite la carga de datos.")
        return

    if db.execute(select(PositionSnapshot).limit(1)).first():
        print("  datos: ya existen snapshots — se omite la recarga.")
        return

    import hashlib

    from app.models.ingestion_log import IngestionLog, IngestionStatus

    raw = path.read_bytes()
    parsed = parse_upload(raw, path.name)
    counts = repo.upsert_parsed_rows(db, parsed.rows)
    db.add(
        IngestionLog(
            filename=path.name,
            content_sha256=hashlib.sha256(raw).hexdigest(),
            uploaded_by_email="seed",
            status=IngestionStatus.partial if parsed.errors else IngestionStatus.success,
            total_rows=parsed.total_rows,
            valid_rows=parsed.ok_rows,
            error_count=len(parsed.errors),
            instruments_upserted=counts["instruments"],
            snapshots_inserted=counts["snapshots_inserted"],
            snapshots_updated=counts["snapshots_updated"],
            periods=parsed.period_labels,
            message="Carga inicial (seed).",
        )
    )
    db.commit()
    print(
        f"  datos: {parsed.ok_rows} filas OK / {len(parsed.errors)} errores · "
        f"{counts['instruments']} instrumentos · {counts['snapshots_inserted']} snapshots"
    )


def _seed_benchmarks(db) -> None:
    if db.execute(select(Benchmark).limit(1)).first():
        return
    periods = {(s.statement_year, month_name_to_index(s.statement_month))
               for s in db.execute(select(PositionSnapshot)).scalars()}
    for year, month in sorted(p for p in periods if p[1]):
        db.add(
            Benchmark(
                period_year=year,
                period_month=month,
                composite_rate=0.06793,
                institutional_rate=0.082,
            )
        )
    db.commit()
    print(f"  benchmarks: {len(periods)} meses (tasas anuales por defecto, editables)")


def main() -> None:
    print("Sembrando base de datos…")
    Base.metadata.create_all(bind=engine, checkfirst=True)
    with SessionLocal() as db:
        _seed_users(db)
        _seed_parameters(db)
        _seed_data_from_excel(db)
        _seed_benchmarks(db)
        n = repo.recompute_monthly_returns(db)
        db.commit()
        print(f"  rentabilidades mensuales (Dietz) calculadas: {n}")
    print("Listo.")


if __name__ == "__main__":
    main()
