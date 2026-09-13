"""Doctor analytics — doctor-wise revenue, patient count, top referring doctors."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Optional

from . import get_connection, paise_to_rupees


@dataclass
class DoctorStat:
    """Revenue and patient statistics for a single doctor."""

    doctor_name: str
    patient_count: int
    order_count: int
    total_revenue: float
    paid_revenue: float
    pending_revenue: float


def get_doctor_revenue(
    conn: Optional[sqlite3.Connection] = None,
    months: int = 12,
    limit: int = 20,
) -> list[DoctorStat]:
    """Return doctor-wise revenue for the last *months* months.

    Joins patients.referred_by → orders → revenue.
    """
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                IFNULL(p.referred_by, 'Self/Unknown') AS doctor_name,
                COUNT(DISTINCT p.id) AS patient_count,
                COUNT(DISTINCT o.id) AS order_count,
                SUM(o.total_amount_paise) AS total_paise,
                SUM(o.paid_amount_paise) AS paid_paise
            FROM patients p
            JOIN orders o ON o.patient_id = p.id
            WHERE o.created_at >= DATE('now', ?)
            GROUP BY p.referred_by
            ORDER BY total_paise DESC
            LIMIT ?
            """,
            (f"-{months} months", limit),
        ).fetchall()

        return [
            DoctorStat(
                doctor_name=row["doctor_name"],
                patient_count=row["patient_count"],
                order_count=row["order_count"],
                total_revenue=paise_to_rupees(row["total_paise"]),
                paid_revenue=paise_to_rupees(row["paid_paise"]),
                pending_revenue=round(
                    paise_to_rupees(row["total_paise"])
                    - paise_to_rupees(row["paid_paise"]),
                    2,
                ),
            )
            for row in rows
        ]
    finally:
        if close_conn:
            conn.close()


def get_all_time_doctor_revenue(
    conn: Optional[sqlite3.Connection] = None,
    limit: int = 20,
) -> list[DoctorStat]:
    """Return all-time doctor-wise revenue."""
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                IFNULL(p.referred_by, 'Self/Unknown') AS doctor_name,
                COUNT(DISTINCT p.id) AS patient_count,
                COUNT(DISTINCT o.id) AS order_count,
                SUM(o.total_amount_paise) AS total_paise,
                SUM(o.paid_amount_paise) AS paid_paise
            FROM patients p
            JOIN orders o ON o.patient_id = p.id
            GROUP BY p.referred_by
            ORDER BY total_paise DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

        return [
            DoctorStat(
                doctor_name=row["doctor_name"],
                patient_count=row["patient_count"],
                order_count=row["order_count"],
                total_revenue=paise_to_rupees(row["total_paise"]),
                paid_revenue=paise_to_rupees(row["paid_paise"]),
                pending_revenue=round(
                    paise_to_rupees(row["total_paise"])
                    - paise_to_rupees(row["paid_paise"]),
                    2,
                ),
            )
            for row in rows
        ]
    finally:
        if close_conn:
            conn.close()


def get_total_doctors_count(conn: Optional[sqlite3.Connection] = None) -> int:
    """Return the total number of doctors in the doctors table."""
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        row = conn.execute("SELECT COUNT(*) AS cnt FROM doctors").fetchone()
        return row["cnt"] if row else 0
    finally:
        if close_conn:
            conn.close()