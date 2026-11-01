"""Add scoped, auditable transfer review for potential cross-institution matches."""

import sqlalchemy as sa

from alembic import op

revision = "0013_cross_reconcile"
down_revision = "0012_verification_credentials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cross_institution_reconciliations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "finding_id",
            sa.Uuid(),
            sa.ForeignKey("validation_findings.id"),
            nullable=False,
        ),
        sa.Column("left_record_version_id", sa.Uuid(), nullable=False),
        sa.Column("left_batch_id", sa.Uuid(), nullable=False),
        sa.Column("right_record_version_id", sa.Uuid(), nullable=False),
        sa.Column("right_batch_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="OPEN"),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_to", sa.Uuid(), sa.ForeignKey("users.id")),
        sa.Column(
            "requested_institution_id", sa.Uuid(), sa.ForeignKey("institutions.id")
        ),
        sa.Column("resolution_reason", sa.Text()),
        sa.Column(
            "opened_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["left_record_version_id", "left_batch_id"],
            ["student_record_versions.id", "student_record_versions.batch_id"],
            name="fk_reconciliation_left_record",
        ),
        sa.ForeignKeyConstraint(
            ["right_record_version_id", "right_batch_id"],
            ["student_record_versions.id", "student_record_versions.batch_id"],
            name="fk_reconciliation_right_record",
        ),
        sa.UniqueConstraint(
            "left_record_version_id",
            "right_record_version_id",
            name="uq_reconciliation_record_pair",
        ),
        sa.CheckConstraint(
            "status IN ('OPEN', 'UNDER_REVIEW', 'AWAITING_INSTITUTION', "
            "'TRANSFER_SUPPORTED', 'UNRESOLVED_OVERLAP', 'DISMISSED')",
            name="ck_reconciliation_status",
        ),
        sa.CheckConstraint(
            "left_record_version_id <> right_record_version_id",
            name="ck_reconciliation_distinct_records",
        ),
        sa.CheckConstraint(
            "resolution_reason IS NULL OR "
            "char_length(resolution_reason) BETWEEN 3 AND 2000",
            name="ck_reconciliation_resolution_reason",
        ),
    )
    op.create_index(
        "ix_reconciliation_status_opened",
        "cross_institution_reconciliations",
        ["status", "opened_at", "id"],
    )
    op.create_index(
        "ix_reconciliation_left",
        "cross_institution_reconciliations",
        ["left_record_version_id"],
    )
    op.create_index(
        "ix_reconciliation_right",
        "cross_institution_reconciliations",
        ["right_record_version_id"],
    )
    op.create_index(
        "ix_cross_institution_reconciliations_finding_id",
        "cross_institution_reconciliations",
        ["finding_id"],
    )

    op.create_table(
        "reconciliation_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "reconciliation_id",
            sa.Uuid(),
            sa.ForeignKey("cross_institution_reconciliations.id"),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("institution_id", sa.Uuid(), sa.ForeignKey("institutions.id")),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("status_after", sa.String(32), nullable=False),
        sa.Column("comment", sa.Text()),
        sa.Column("evidence_type", sa.String(32)),
        sa.Column("transfer_date", sa.Date()),
        sa.Column("withdrawal_date", sa.Date()),
        sa.Column("evidence_reference", sa.String(120)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.CheckConstraint(
            "action IN ('OPENED', 'ASSIGN', 'START_REVIEW', 'REQUEST_EVIDENCE', "
            "'TRANSFER_EVIDENCE_SUBMITTED', 'DECIDE_TRANSFER', "
            "'DECIDE_OVERLAP', 'DISMISS')",
            name="ck_reconciliation_event_action",
        ),
        sa.CheckConstraint(
            "status_after IN ('OPEN', 'UNDER_REVIEW', 'AWAITING_INSTITUTION', "
            "'TRANSFER_SUPPORTED', 'UNRESOLVED_OVERLAP', 'DISMISSED')",
            name="ck_reconciliation_event_status",
        ),
        sa.CheckConstraint(
            "evidence_type IS NULL OR evidence_type IN "
            "('TRANSFER_RECORD', 'WITHDRAWAL_RECORD', 'OTHER')",
            name="ck_reconciliation_evidence_type",
        ),
        sa.CheckConstraint(
            "comment IS NULL OR char_length(comment) BETWEEN 1 AND 2000",
            name="ck_reconciliation_event_comment",
        ),
        sa.CheckConstraint(
            "evidence_reference IS NULL OR "
            "char_length(evidence_reference) BETWEEN 1 AND 120",
            name="ck_reconciliation_evidence_reference",
        ),
    )
    op.create_index(
        "ix_reconciliation_event_timeline",
        "reconciliation_events",
        ["reconciliation_id", "created_at", "id"],
    )
    op.execute(
        "CREATE TRIGGER reconciliation_events_immutable "
        "BEFORE UPDATE OR DELETE ON reconciliation_events "
        "FOR EACH ROW EXECUTE FUNCTION prevent_intake_history_mutation()"
    )


def downgrade() -> None:
    if (
        op.get_bind()
        .execute(sa.text("SELECT 1 FROM cross_institution_reconciliations LIMIT 1"))
        .first()
    ):
        raise RuntimeError(
            "Cannot downgrade: cross-institution reconciliation history exists"
        )
    op.drop_table("reconciliation_events")
    op.drop_table("cross_institution_reconciliations")
