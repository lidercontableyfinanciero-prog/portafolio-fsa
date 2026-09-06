"""Fixtures de integración: API FastAPI sobre SQLite en memoria, sembrada desde
el Excel real de `Referencias/` (o saltada si no está disponible)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture(scope="session")
def _engine():
    return create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )


@pytest.fixture(scope="session")
def seeded_db(_engine):
    import hashlib

    from app.core.database import Base
    from app.core.security import hash_password
    from app.db.rating_scale_data import PARAMETERS, RATING_SCALE
    from app.models.ingestion_log import IngestionLog, IngestionStatus
    from app.models.parameter import Parameter, RatingScale
    from app.models.user import User, UserRole
    from app.services import portfolio_repo as repo
    from app.services.etl import parse_upload
    from app.core.config import settings

    Base.metadata.create_all(bind=_engine)
    Session = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)

    xlsx = settings.seed_dir_path / settings.seed_informe_file
    if not xlsx.exists():
        pytest.skip(f"Excel de siembra no encontrado: {xlsx}")

    with Session() as db:
        db.add(User(email="admin@fundacionsanantonio.org", hashed_password=hash_password("admin123"),
                    full_name="Admin", role=UserRole.admin, is_active=True))
        db.add(User(email="lector@fundacionsanantonio.org", hashed_password=hash_password("lector123"),
                    full_name="Lector", role=UserRole.lector, is_active=True))
        db.add_all(Parameter(**p) for p in PARAMETERS)
        db.add_all(RatingScale(**r) for r in RATING_SCALE)
        raw = xlsx.read_bytes()
        parsed = parse_upload(raw, xlsx.name)
        counts = repo.upsert_parsed_rows(db, parsed.rows)
        repo.recompute_monthly_returns(db)
        db.add(
            IngestionLog(
                filename=xlsx.name,
                content_sha256=hashlib.sha256(raw).hexdigest(),
                uploaded_by_email="seed",
                status=IngestionStatus.success,
                total_rows=parsed.total_rows,
                valid_rows=parsed.ok_rows,
                instruments_upserted=counts["instruments"],
                snapshots_inserted=counts["snapshots_inserted"],
                periods=parsed.period_labels,
                message="Carga inicial (seed).",
            )
        )
        db.commit()
    return Session


@pytest.fixture()
def client(_engine, seeded_db):
    from app.core.database import get_db
    from app.main import app

    def _override():
        db = seeded_db()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_token(client) -> str:
    r = client.post(
        "/api/auth/login",
        data={"username": "admin@fundacionsanantonio.org", "password": "admin123"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture()
def lector_token(client) -> str:
    r = client.post(
        "/api/auth/login",
        data={"username": "lector@fundacionsanantonio.org", "password": "lector123"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
