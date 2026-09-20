"""Autenticación por nombre de usuario + permiso de carga (users)

Revision ID: 0003_username_auth
Revises: 0002_ingestion_logs
Create Date: 2026-09-20

El login deja de basarse en correo electrónico ("admin@fundacionsanantonio.org")
y pasa a usar un nombre de usuario propio ("ADMIN_FSA", "LECTOR1_FSA",
"LECTOR2_FSA"), y se agrega `can_upload` para permisos de carga por usuario.

Las cuentas existentes son credenciales de arranque (seed), no datos de
negocio de la fundación, así que se recrea la tabla completa con el nuevo
esquema en vez de intentar un backfill email->username: el próximo arranque
(`init_db` / `seed.main()`) vuelve a poblarla con las cuentas canónicas.
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

from app.models.user import User

revision: str = "0003_username_auth"
down_revision: str | None = "0002_ingestion_logs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    # `ingestion_logs.uploaded_by_id` referencia `users.id` -> se limpia y se
    # reconstruye la FK después de recrear `users` con el nuevo esquema.
    op.execute("UPDATE ingestion_logs SET uploaded_by_id = NULL")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    User.__table__.create(bind=bind, checkfirst=True)
    op.create_foreign_key(
        "ingestion_logs_uploaded_by_id_fkey",
        "ingestion_logs", "users",
        ["uploaded_by_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # No hay forma segura de reconstruir el esquema por email desde aquí;
    # bajar de versión igualmente deja la tabla vacía para resembrar.
    bind = op.get_bind()
    op.drop_constraint("ingestion_logs_uploaded_by_id_fkey", "ingestion_logs", type_="foreignkey")
    op.execute("UPDATE ingestion_logs SET uploaded_by_id = NULL")
    User.__table__.drop(bind=bind, checkfirst=True)
