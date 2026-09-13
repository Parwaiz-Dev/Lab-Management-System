"""Patient statistics — total patients, registrations per month, growth trends."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from . import get_connection


@dataclass
class PatientStats:
    """Aggregated patient statistics."""

    total_patients: int
    new_this_month: int
    new_this_year: int
    avg_new_per_month: float
    growth_percent: float


@dataclass
class MonthlyRegistration:
    """New patient registrations for a single month."""

    month: str
    new_patients: int
    cumulative_total: int


def get_total_patients(conn: Optional[sqlite3.Connection] = None) -> int:
    """Return the total number of patients in the database."""
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        row = conn.execute("SELECT COUNT(*) AS cnt FROM patients").fetchone()
        return row["cnt"] if row else 0
    finally:
        if close_conn:
            conn.close()


def get_patient_stats(conn: Optional[sqlite3.Connection] = None) -> PatientStats:
    """Return comprehensive patient statistics.

    Includes total patients, new registrations this month / year,
    average new per month, and year-over-year growth percentage.
    """
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        today = date.today()
        month_start = today.replace(day=1).isoformat()
        year_start = today.replace(month=1, day=1).isoformat()

        total = conn.execute("SELECT COUNT(*) AS cnt FROM patients").fetchone()["cnt"]

        new_this_month = conn.execute(
            "SELECT COUNT(*) AS cnt FROM patients WHERE DATE(created_at) >= ?",
            (month_start,),
        ).fetchone()["cnt"]

        new_this_year = conn.execute(
            "SELECT COUNT(*) AS cnt FROM patients WHERE DATE(created_at) >= ?",
            (year_start,),
        ).fetchone()["cnt"]

        # Average new per month over the last 12 months
        months_active = conn.execute(
            """
            SELECT COUNT(DISTINCT strftime('%Y-%m', created_at)) AS m
            FROM patients
            WHERE created_at >= DATE('now', '-12 months')
            """
        ).fetchone()["m"]
        months_active = max(1, months_active)

        # Patients created in the last 12 months
        recent = conn.execute(
            "SELECT COUNT(*) AS cnt FROM patients WHERE created_at >= DATE('now', '-12 months')"
        ).fetchone()["cnt"]

        # Year-over-year growth: compare patients this year vs last year same period
        ly_start = today.replace(year=today.year - 1, month=1, day=1).isoformat()
        ly_end = today.replace(year=today.year - 1).isoformat()
        ly_count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM patients WHERE DATE(created_at) BETWEEN ? AND ?",
            (ly_start, ly_end),
        ).fetchone()["cnt"]

        if ly_count > 0:
            growth = round(((new_this_year - ly_count) / ly_count) * 100, 1)
        else:
            growth = 100.0 if new_this_year > 0 else 0.0

        return PatientStats(
            total_patients=total,
            new_this_month=new_this_month,
            new_this_year=new_this_year,
            avg_new_per_month=round(recent / months_active, 1),
            growth_percent=growth,
        )
    finally:
        if close_conn:
            conn.close()


def get_monthly_registrations(
    conn: Optional[sqlite3.Connection] = None,
    months: int = 12,
) -> list[MonthlyRegistration]:
    """Return new patient registrations per month for the last *months* months."""
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                strftime('%Y-%m', created_at) AS month,
                COUNT(*) AS new_patients
            FROM patients
            WHERE created_at >= DATE('now', ?)
            GROUP BY month
            ORDER BY month
            """,
            (f"-{months} months",),
        ).fetchall()

        cumulative = 0
        result: list[MonthlyRegistration] = []
        for row in rows:
            cumulative += row["new_patients"]
            result.append(
                MonthlyRegistration(
                    month=row["month"],
                    new_patients=row["new_patients"],
                    cumulative_total=cumulative,
                )
            )
        return result
    finally:
        if close_conn:
            conn.close()


def get_age_distribution(
    conn: Optional[sqlite3.Connection] = None,
) -> dict[str, int]:
    """Return age-group distribution of all patients.

    Buckets: 0-12, 13-18, 19-35, 36-50, 51-65, 66+
    """
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        # Only count patients with age_value AND age_unit = 'years'
        rows = conn.execute(
            """
            SELECT
                CASE
                    WHEN age_value BETWEEN 0 AND 12 THEN '0-12'
                    WHEN age_value BETWEEN 13 AND 18 THEN '13-18'
                    WHEN age_value BETWEEN 19 AND 35 THEN '19-35'
                    WHEN age_value BETWEEN 36 AND 50 THEN '36-50'
                    WHEN age_value BETWEEN 51 AND 65 THEN '51-65'
                    WHEN age_value >= 66 THEN '66+'
                END AS age_group,
                COUNT(*) AS cnt
            FROM patients
            WHERE age_value IS NOT NULL AND LOWER(age_unit) = 'years'
            GROUP BY age_group
            ORDER BY age_group
            """
        ).fetchall()

        distribution: dict[str, int] = {
            "0-12": 0,
            "13-18": 0,
            "19-35": 0,
            "36-50": 0,
            "51-65": 0,
            "66+": 0,
        }
        for row in rows:
            if row["age_group"]:
                distribution[row["age_group"]] = row["cnt"]
        return distribution
    finally:
        if close_conn:
            conn.close()


def get_gender_distribution(
    conn: Optional[sqlite3.Connection] = None,
) -> dict[str, int]:
    """Return gender-wise count of all patients."""
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        rows = conn.execute(
            "SELECT LOWER(IFNULL(gender, 'unspecified')) AS g, COUNT(*) AS cnt "
            "FROM patients GROUP BY g"
        ).fetchall()

        return {row["g"]: row["cnt"] for row in rows}
    finally:
        if close_conn:
            conn.close()