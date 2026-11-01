"""Add primary reservation category and independent PwD status, without backfill."""

import sqlalchemy as sa

from alembic import op

revision = "0014_reservation_categories"
down_revision = "0013_cross_reconcile"
branch_labels = None
depends_on = None

LEGACY = "'REGULAR','SUPERNUMERARY','NRI','OCI','FOREIGN_NATIONAL'"
NEW = "'GENERAL_OPEN','SC_ST','NT','OBC','PWD'"


def upgrade() -> None:
    op.add_column(
        "student_record_versions",
        sa.Column("reservation_category", sa.Text(), nullable=True),
    )
    op.add_column(
        "student_record_versions", sa.Column("is_pwd", sa.Boolean(), nullable=True)
    )
    op.drop_constraint("admission_category", "intake_rules", type_="check")
    op.create_check_constraint(
        "admission_category", "intake_rules", f"category IN ({LEGACY},{NEW})"
    )


def downgrade() -> None:
    connection = op.get_bind()
    used = connection.execute(
        sa.text(
            "SELECT EXISTS(SELECT 1 FROM student_record_versions WHERE "
            "reservation_category IS NOT NULL OR is_pwd IS NOT NULL) OR "
            f"EXISTS(SELECT 1 FROM intake_rules WHERE category IN ({NEW}))"
        )
    ).scalar()
    if used:
        raise RuntimeError("Cannot downgrade: reservation data must remain auditable")
    op.drop_constraint("admission_category", "intake_rules", type_="check")
    op.create_check_constraint(
        "admission_category", "intake_rules", f"category IN ({LEGACY})"
    )
    op.drop_column("student_record_versions", "is_pwd")
    op.drop_column("student_record_versions", "reservation_category")
