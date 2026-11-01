"""Explicit category schemes; PwD overlaps the four primary groups."""

from enum import StrEnum
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from app.modules.submissions.models import StudentRecordVersion

CategoryScheme = Literal["LEGACY", "RESERVATION"]
LEGACY_CATEGORIES = ("REGULAR", "SUPERNUMERARY", "NRI", "OCI", "FOREIGN_NATIONAL")


class ReservationCategory(StrEnum):
    GENERAL_OPEN = "GENERAL_OPEN"
    SC_ST = "SC_ST"
    NT = "NT"
    OBC = "OBC"


RESERVATION_CATEGORIES = tuple(category.value for category in ReservationCategory)
RESERVATION_GROUPS = (*RESERVATION_CATEGORIES, "PWD")
RESERVATION_RULE_VERSION = "DEMO-RESERVATION-v1"
RESERVATION_POOLING_NOTE = (
    "General/Open, SC/ST, NT and OBC are primary categories. PwD overlaps these "
    "categories and must not be added to the student headcount. Limits are DEMO "
    "configuration, not official reservation entitlements."
)


def reservation_coverage(rows: list["StudentRecordVersion"]) -> dict[str, int]:
    return {
        "records_missing_main_category": sum(
            row.reservation_category not in RESERVATION_CATEGORIES for row in rows
        ),
        "active_missing_main_category": sum(
            row.enrollment_status == "ACTIVE"
            and row.reservation_category not in RESERVATION_CATEGORIES
            for row in rows
        ),
        "records_missing_pwd_status": sum(row.is_pwd is None for row in rows),
        "active_missing_pwd_status": sum(
            row.enrollment_status == "ACTIVE" and row.is_pwd is None for row in rows
        ),
    }


def reservation_category_counts(
    rows: list["StudentRecordVersion"],
) -> dict[str, dict[str, int | None]]:
    coverage = reservation_coverage(rows)
    result: dict[str, dict[str, int | None]] = {}
    for category in RESERVATION_GROUPS:
        selected = [
            row
            for row in rows
            if (
                row.is_pwd is True
                if category == "PWD"
                else row.reservation_category == category
            )
        ]
        unknown = coverage[
            "records_missing_pwd_status"
            if category == "PWD"
            else "records_missing_main_category"
        ]
        active_unknown = coverage[
            "active_missing_pwd_status"
            if category == "PWD"
            else "active_missing_main_category"
        ]
        result[category] = {
            "declared_records": None if unknown else len(selected),
            "demo_active_records": None
            if active_unknown
            else sum(row.enrollment_status == "ACTIVE" for row in selected),
        }
    return result
