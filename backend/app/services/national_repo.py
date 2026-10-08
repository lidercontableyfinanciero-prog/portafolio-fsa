"""Puente entre los modelos ORM nacionales y el motor puro `services/national.py`."""

from __future__ import annotations

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.db.national_seed_data import NATIONAL_ASSETS, NATIONAL_IPC, NATIONAL_PARAMETERS
from app.models.national import NationalAsset, NationalIpc, NationalMovement
from app.models.parameter import Parameter
from app.services.national import (
    Asset,
    Filters,
    Ipc,
    Movement,
    Params,
    Period,
    build_report,
    default_asset,
)

_MOVEMENT_FIELDS = (
    "entity", "investment_type", "name", "concept", "value", "movement_type",
    "nominal_value", "purchase_value", "coupon_rate", "rate_em", "issue_date",
    "purchase_date", "maturity_date", "status", "sale_value", "pnl", "holding_irr",
    "sale_rate", "nemo", "ref", "per",
)


def _f(v):
    return float(v) if v is not None else None


def _period(text: str | None) -> Period | None:
    """'2026-07' -> (2026, 7)."""
    try:
        y, m = (text or "").split("-")
        return int(y), int(m)
    except ValueError:
        return None


# --------------------------------------------------------------------------- #
# Lectura
# --------------------------------------------------------------------------- #
def load_movements(db: Session) -> list[Movement]:
    rows = db.execute(
        select(NationalMovement).order_by(
            NationalMovement.year, NationalMovement.month, NationalMovement.id
        )
    ).scalars().all()
    out = []
    for r in rows:
        kw = {f: getattr(r, f) for f in _MOVEMENT_FIELDS}
        for f in ("value", "nominal_value", "purchase_value", "coupon_rate", "rate_em",
                  "sale_value", "pnl", "holding_irr", "sale_rate"):
            kw[f] = _f(kw[f])
        out.append(Movement(year=r.year, month=r.month, **kw))
    return out


def load_assets(db: Session) -> dict[str, Asset]:
    return {
        a.name: Asset(
            name=a.name, asset_type=a.asset_type, group=a.group, issuer=a.issuer,
            entity=a.entity, low_liquidity=a.low_liquidity, benchmark=a.benchmark,
            needs_review=a.needs_review,
        )
        for a in db.execute(select(NationalAsset)).scalars().all()
    }


def load_ipc(db: Session) -> dict[Period, Ipc]:
    return {
        (r.year, r.month): Ipc(_f(r.ipc_ytd), _f(r.ipc_12m))
        for r in db.execute(select(NationalIpc)).scalars().all()
    }


def _param(db: Session, key: str):
    p = db.get(Parameter, key)
    if p is None:
        return None
    return float(p.value_numeric) if p.value_numeric is not None else p.value_text


def load_params(db: Session) -> Params:
    d = Params()

    def num(key, default):
        v = _param(db, key)
        return float(v) if isinstance(v, (int, float)) else default

    return Params(
        spread=num("nal_spread_benchmark", d.spread),
        limit_issuer=num("nal_limite_emisor", d.limit_issuer),
        limit_low_liquidity=num("nal_limite_baja_liquidez", d.limit_low_liquidity),
        max_term_years=num("nal_plazo_max_deuda", d.max_term_years),
        yellow=num("nal_alerta_amarilla", d.yellow),
        days_critical=num("nal_dias_critico", d.days_critical),
        days_attention=num("nal_dias_atencion", d.days_attention),
        stop_loss=num("nal_stop_loss", d.stop_loss),
        top_margin=num("nal_margen_sobresaliente", d.top_margin),
        coupons_as_returns_from=_period(_param(db, "nal_cupon_rendimientos_desde")),
        split_parent=_param(db, "nal_reparto_matriz") or None,
        split_child=_param(db, "nal_reparto_hijo") or None,
        split_until=_period(_param(db, "nal_reparto_hasta")),
    )


def has_data(db: Session) -> bool:
    return db.execute(select(NationalMovement.id).limit(1)).first() is not None


def report(db: Session, cut: Period | None = None, filters: Filters | None = None) -> dict:
    return build_report(
        load_movements(db), load_assets(db), load_ipc(db), load_params(db), cut, filters
    )


# --------------------------------------------------------------------------- #
# Escritura
# --------------------------------------------------------------------------- #
def seed_reference_data(db: Session) -> dict:
    """Catálogo de activos, IPC y parámetros del informe nacional (idempotente:
    nunca sobrescribe lo que el administrador ya editó)."""
    n_assets = n_ipc = n_params = 0
    for name, t, g, issuer, entity, low, bench in NATIONAL_ASSETS:
        if db.get(NationalAsset, name) is None:
            db.add(NationalAsset(name=name, asset_type=t, group=g, issuer=issuer,
                                 entity=entity, low_liquidity=low, benchmark=bench))
            n_assets += 1
    existing = {(r.year, r.month) for r in db.execute(select(NationalIpc)).scalars()}
    for y, m, ytd, m12, src in NATIONAL_IPC:
        if (y, m) not in existing:
            db.add(NationalIpc(year=y, month=m, ipc_ytd=ytd, ipc_12m=m12, source=src))
            n_ipc += 1
    for row in NATIONAL_PARAMETERS:
        if db.get(Parameter, row["key"]) is None:
            db.add(Parameter(**row))
            n_params += 1
    db.flush()
    return {"assets": n_assets, "ipc": n_ipc, "parameters": n_params}


def periods_with_data(db: Session, periods: list[Period]) -> dict[Period, int]:
    if not periods:
        return {}
    clauses = [
        (NationalMovement.year == y) & (NationalMovement.month == m) for y, m in periods
    ]
    rows = db.execute(
        select(NationalMovement.year, NationalMovement.month, func.count(NationalMovement.id))
        .where(or_(*clauses))
        .group_by(NationalMovement.year, NationalMovement.month)
    ).all()
    return {(y, m): c for y, m, c in rows}


def replace_periods(db: Session, movements: list[Movement], periods: list[Period]) -> dict:
    """Borra los meses presentes en el archivo y los vuelve a insertar.
    Crea en el catálogo las inversiones nuevas con atributos deducidos
    (marcadas para revisión)."""
    deleted = 0
    if periods:
        clauses = [
            (NationalMovement.year == y) & (NationalMovement.month == m) for y, m in periods
        ]
        res = db.execute(
            delete(NationalMovement).where(or_(*clauses)).execution_options(
                synchronize_session=False
            )
        )
        deleted = res.rowcount or 0
    for i, mv in enumerate(movements, start=1):
        db.add(NationalMovement(
            year=mv.year, month=mv.month, row_number=i,
            **{f: getattr(mv, f) for f in _MOVEMENT_FIELDS},
        ))
    new_assets = []
    known = {n for (n,) in db.execute(select(NationalAsset.name)).all()}
    for mv in movements:
        if mv.name in known:
            continue
        a = default_asset(mv.name, mv.investment_type, mv.entity)
        db.add(NationalAsset(
            name=a.name, asset_type=a.asset_type, group=a.group, issuer=a.issuer,
            entity=a.entity, low_liquidity=a.low_liquidity, benchmark=a.benchmark,
            needs_review=True,
        ))
        known.add(mv.name)
        new_assets.append(mv.name)
    db.flush()
    return {"inserted": len(movements), "deleted": deleted, "new_assets": new_assets}
