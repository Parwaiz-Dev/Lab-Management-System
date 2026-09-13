"""Revenue analytics — daily, weekly, monthly, and yearly revenue reports.

All monetary values are stored in paise (integer) in the database and
converted to rupees (float) using the shared paise_to_rupees() helper.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from . import get_connection, paise_to_rupees


@dataclass
class RevenueSummary:
    """Aggregated revenue for a given period."""

    period: str
    period_start: str
    period_end: str
    total_amount: float
    paid_amount: float
    pending_amount: float
    order_count: int
    avg_revenue_per_day: float = 0.0


@dataclass
class DailyRevenue:
    """Single-day revenue breakdown."""

    date: str
    total_amount: float
    paid_amount: float
    pending_amount: float
    order_count: int


def get_daily_revenue(
    conn: Optional[sqlite3.Connection] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[DailyRevenue]:
    """Return daily revenue for every day in the given date range.

    Args:
        conn: Optional existing connection.  Created if None.
        start_date: Inclusive start date as 'YYYY-MM-DD'.  Defaults to 30 days ago.
        end_date: Inclusive end date as 'YYYY-MM-DD'.  Defaults to today.

    Returns:
        List of DailyRevenue, one entry per day with at least one order.
    """
    if end_date is None:
        end_date = date.today().isoformat()
    if start_date is None:
        start_date = (date.today() - timedelta(days=30)).isoformat()

    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                DATE(created_at) AS order_date,
                COUNT(*) AS order_count,
                SUM(total_amount_paise) AS total_paise,
                SUM(paid_amount_paise) AS paid_paise
            FROM orders
            WHERE DATE(created_at) BETWEEN ? AND ?
            GROUP BY order_date
            ORDER BY order_date
            """,
            (start_date, end_date),
        ).fetchall()

        result: list[DailyRevenue] = []
        for row in rows:
            total = paise_to_rupees(row["total_paise"])
            paid = paise_to_rupees(row["paid_paise"])
            result.append(
                DailyRevenue(
                    date=row["order_date"],
                    total_amount=total,
                    paid_amount=paid,
                    pending_amount=round(total - paid, 2),
                    order_count=row["order_count"],
                )
            )
        return result
    finally:
        if close_conn:
            conn.close()


def get_weekly_revenue(
    conn: Optional[sqlite3.Connection] = None,
    weeks: int = 12,
) -> list[RevenueSummary]:
    """Return weekly revenue for the most recent *weeks*.

    Weeks are ISO year-week (e.g. '2026-W24').
    """
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                strftime('%Y-W%W', created_at) AS week,
                MIN(DATE(created_at)) AS week_start,
                MAX(DATE(created_at)) AS week_end,
                COUNT(*) AS order_count,
                SUM(total_amount_paise) AS total_paise,
                SUM(paid_amount_paise) AS paid_paise
            FROM orders
            WHERE created_at >= DATE('now', ?)
            GROUP BY week
            ORDER BY week
            """,
            (f"-{weeks} weeks",),
        ).fetchall()

        result: list[RevenueSummary] = []
        for row in rows:
            total = paise_to_rupees(row["total_paise"])
            paid = paise_to_rupees(row["paid_paise"])
            count = row["order_count"]
            # Estimate number of active days in the week
            days = max(1, (date.today() - date.today().replace(weekday=0)).days) if count else 7
            result.append(
                RevenueSummary(
                    period=row["week"],
                    period_start=row["week_start"],
                    period_end=row["week_end"],
                    total_amount=total,
                    paid_amount=paid,
                    pending_amount=round(total - paid, 2),
                    order_count=count,
                    avg_revenue_per_day=round(total / max(1, 7), 2),
                )
            )
        return result
    finally:
        if close_conn:
            conn.close()


def get_monthly_revenue(
    conn: Optional[sqlite3.Connection] = None,
    months: int = 12,
) -> list[RevenueSummary]:
    """Return monthly revenue for the most recent *months*."""
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                strftime('%Y-%m', created_at) AS month,
                MIN(DATE(created_at)) AS month_start,
                MAX(DATE(created_at)) AS month_end,
                COUNT(*) AS order_count,
                SUM(total_amount_paise) AS total_paise,
                SUM(paid_amount_paise) AS paid_paise
            FROM orders
            WHERE created_at >= DATE('now', ?)
            GROUP BY month
            ORDER BY month
            """,
            (f"-{months} months",),
        ).fetchall()

        result: list[RevenueSummary] = []
        for row in rows:
            total = paise_to_rupees(row["total_paise"])
            paid = paise_to_rupees(row["paid_paise"])
            # Parse month to get number of days
            try:
                ym = datetime.strptime(row["month"], "%Y-%m")
                days_in_month = (
                    (ym.replace(month=ym.month % 12 + 1, day=1) - timedelta(days=1)).day
                    if ym.month < 12
                    else 31
                )
            except (ValueError, TypeError):
                days_in_month = 30
            result.append(
                RevenueSummary(
                    period=row["month"],
                    period_start=row["month_start"],
                    period_end=row["month_end"],
                    total_amount=total,
                    paid_amount=paid,
                    pending_amount=round(total - paid, 2),
                    order_count=row["order_count"],
                    avg_revenue_per_day=round(total / max(1, days_in_month), 2),
                )
            )
        return result
    finally:
        if close_conn:
            conn.close()


def get_yearly_revenue(
    conn: Optional[sqlite3.Connection] = None,
    years: int = 5,
) -> list[RevenueSummary]:
    """Return yearly revenue for the most recent *years*."""
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        rows = conn.execute(
            """
            SELECT
                strftime('%Y', created_at) AS year,
                MIN(DATE(created_at)) AS year_start,
                MAX(DATE(created_at)) AS year_end,
                COUNT(*) AS order_count,
                SUM(total_amount_paise) AS total_paise,
                SUM(paid_amount_paise) AS paid_paise
            FROM orders
            WHERE created_at >= DATE('now', ?)
            GROUP BY year
            ORDER BY year
            """,
            (f"-{years} years",),
        ).fetchall()

        result: list[RevenueSummary] = []
        for row in rows:
            total = paise_to_rupees(row["total_paise"])
            paid = paise_to_rupees(row["paid_paise"])
            result.append(
                RevenueSummary(
                    period=row["year"],
                    period_start=row["year_start"],
                    period_end=row["year_end"],
                    total_amount=total,
                    paid_amount=paid,
                    pending_amount=round(total - paid, 2),
                    order_count=row["order_count"],
                    avg_revenue_per_day=round(total / max(1, 365), 2),
                )
            )
        return result
    finally:
        if close_conn:
            conn.close()


def get_overall_summary(
    conn: Optional[sqlite3.Connection] = None,
) -> RevenueSummary:
    """Return a single aggregated summary of all-time revenue."""
    close_conn = conn is None
    if close_conn:
        conn = get_connection()

    try:
        row = conn.execute(
            """
            SELECT
                MIN(DATE(created_at)) AS first_order,
                MAX(DATE(created_at)) AS last_order,
                COUNT(*) AS order_count,
                SUM(total_amount_paise) AS total_paise,
                SUM(paid_amount_paise) AS paid_paise
            FROM orders
            """
        ).fetchone()

        if row is None or row["order_count"] == 0:
            return RevenueSummary(
                period="ALL",
                period_start="N/A",
                period_end="N/A",
                total_amount=0.0,
                paid_amount=0.0,
                pending_amount=0.0,
                order_count=0,
                avg_revenue_per_day=0.0,
            )

        total = paise_to_rupees(row["total_paise"])
        paid = paise_to_rupees(row["paid_paise"])
        total_days = max(1, (date.today() - date.today()).days)  # fallback = 1
        if row["first_order"] and row["last_order"]:
            try:
                first = datetime.strptime(row["first_order"], "%Y-%m-%d").date()
                last = datetime.strptime(row["last_order"], "%Y-%m-%d").date()
                total_days = max(1, (last - first).days + 1)
            except (ValueError, TypeError):
                pass

        return RevenueSummary(
            period="ALL",
            period_start=row["first_order"] or "N/A",
            period_end=row["last_order"] or "N/A",
            total_amount=total,
            paid_amount=paid,
            pending_amount=round(total - paid, 2),
            order_count=row["order_count"],
            avg_revenue_per_day=round(total / total_days, 2),
        )
    finally:
        if close_conn:
            conn.close()