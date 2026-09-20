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
from app.models.parameter import Parameter, RatingScale
from app.models.snapshot import PositionSnapshot
from app.models.user import User, UserRole
from app.services import portfolio_repo as repo
from app.services.etl import parse_upload
from app.core.security import hash_password


def _seed_users(db) -> None:
    # (username, password, nombre visible inicial, rol, permiso de carga inicial)
    wanted = [
        (settings.seed_admin_username, settings.seed_admin_password,
         "Administrador FSA", UserRole.admin, True),
        (settings.seed_lector1_username, settings.seed_lector1_password,
         "Lector 1 FSA", UserRole.lector, False),
        (settings.seed_lector2_username, settings.seed_lector2_password,
         "Lector 2 FSA", UserRole.lector, False),
    ]
    for username, password, name, role, can_upload in wanted:
        if db.query(User).filter(User.username == username).first():
            continue
        db.add(
            User(
                username=username,
                hashed_password=hash_password(password),
                full_name=name,
                role=role,
                is_active=True,
                can_upload=can_upload,
            )
        )
    db.commit()
    usernames = ", ".join(u for u, *_ in wanted)
    print(f"  usuarios: {usernames}")


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
    n = repo.ensure_default_benchmarks(db)
    db.commit()
    print(f"  benchmarks: {n} meses nuevos con tasa anual por defecto (editables)")


def init_db() -> None:
    """Arranque en producción: garantiza el esquema y los usuarios/parametros base.

    Idempotente y tolerante a fallos: se invoca en cada arranque del backend
    (ver `app.main.lifespan`). Crea `admin@fundacionsanantonio.org` si no existe.
    NO carga los Excel de `Referencias/` (eso se hace desde la app, en Importar).
    """
    print("init_db: verificando esquema y usuarios base…")
    Base.metadata.create_all(bind=engine, checkfirst=True)
    with SessionLocal() as db:
        _seed_users(db)
        _seed_parameters(db)
        n = repo.ensure_default_benchmarks(db)
        if n:
            print(f"  benchmarks: {n} meses nuevos con tasa anual por defecto")
        db.commit()
    print("init_db: listo.")


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
