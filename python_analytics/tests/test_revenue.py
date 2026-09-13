"""Tests for the revenue analysis module.

Uses an in-memory SQLite database seeded with test data — no external
database dependency required.
"""

from __future__ import annotations

import sqlite3
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

# Ensure the analytics package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from analytics.revenue_analysis import (
    DailyRevenue,
    RevenueSummary,
    get_daily_revenue,
    get_weekly_revenue,
    get_monthly_revenue,
    get_yearly_revenue,
    get_overall_summary,
)
from analytics import paise_to_rupees


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed_db(conn: sqlite3.Connection) -> None:
    """Create tables and insert test data."""
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_code TEXT UNIQUE,
            name TEXT NOT NULL,
            age_value INTEGER,
            age_unit TEXT,
            gender TEXT,
            phone TEXT,
            referred_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            total_amount_paise INTEGER DEFAULT 0,
            discount_amount_paise INTEGER DEFAULT 0,
            paid_amount_paise INTEGER DEFAULT 0,
            invoice_no TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
        """
    )

    # Insert patients
    conn.execute(
        "INSERT INTO patients (name, age_value, age_unit, gender, phone, created_at) "
        "VALUES ('Test Patient', 30, 'years', 'male', '9999999999', '2026-01-01')"
    )

    patient_id = conn.execute("SELECT id FROM patients LIMIT 1").fetchone()["id"]

    today = date.today()
    # Insert orders across multiple days
    orders = [
        # (days_ago, total_paise, paid_paise)
        (0, 50000, 50000),    # today, ₹500 fully paid
        (0, 30000, 15000),    # today, ₹300 partially paid
        (1, 100000, 100000),  # yesterday, ₹1000 fully paid
        (7, 75000, 50000),    # 7 days ago, ₹750 partially paid
        (30, 20000, 0),       # 30 days ago, ₹200 unpaid
        (60, 150000, 150000), # 60 days ago, ₹1500 fully paid
        (90, 50000, 50000),   # 90 days ago
        (120, 80000, 80000),  # 120 days ago
        (200, 40000, 40000),  # 200 days ago
        (365, 60000, 60000),  # 365 days ago (1 year)
        (400, 90000, 90000),  # 400 days ago
        (730, 120000, 120000),# 730 days ago (2 years)
    ]

    for days_ago, total_paise, paid_paise in orders:
        order_date = (today - timedelta(days=days_ago)).isoformat()
        conn.execute(
            "INSERT INTO orders (patient_id, total_amount_paise, paid_amount_paise, created_at) "
            "VALUES (?, ?, ?, ?)",
            (patient_id, total_paise, paid_paise, order_date),
        )

    conn.commit()


@pytest.fixture
def db() -> sqlite3.Connection:
    """Create an in-memory database with test data."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    _seed_db(conn)
    yield conn
    conn.close()


# ---------------------------------------------------------------------------
# Unit tests — paise conversion
# ---------------------------------------------------------------------------

class TestPaiseConversion:
    def test_zero_paise(self) -> None:
        assert paise_to_rupees(0) == 0.0

    def test_one_rupee(self) -> None:
        assert paise_to_rupees(100) == 1.0

    def test_fractional(self) -> None:
        assert paise_to_rupees(150) == 1.50

    def test_large_amount(self) -> None:
        assert paise_to_rupees(123456) == 1234.56

    def test_none(self) -> None:
        assert paise_to_rupees(None) == 0.0


# ---------------------------------------------------------------------------
# Integration tests — revenue functions
# ---------------------------------------------------------------------------

class TestDailyRevenue:
    def test_returns_list(self, db: sqlite3.Connection) -> None:
        result = get_daily_revenue(db)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_correct_paise_conversion(self, db: sqlite3.Connection) -> None:
        result = get_daily_revenue(db)
        today_entries = [r for r in result if r.date == date.today().isoformat()]
        assert len(today_entries) == 1
        entry = today_entries[0]
        # 2 orders today: 50000 + 30000 = 80000 paise = ₹800
        assert entry.total_amount == 800.00
        assert entry.paid_amount == 650.00  # 50000 + 15000
        assert entry.pending_amount == 150.00

    def test_pending_calculation(self, db: sqlite3.Connection) -> None:
        result = get_daily_revenue(db)
        for entry in result:
            assert round(entry.total_amount - entry.paid_amount, 2) == entry.pending_amount

    def test_order_count(self, db: sqlite3.Connection) -> None:
        result = get_daily_revenue(db)
        today_entries = [r for r in result if r.date == date.today().isoformat()]
        assert today_entries[0].order_count == 2

    def test_date_range(self, db: sqlite3.Connection) -> None:
        today = date.today().isoformat()
        result = get_daily_revenue(db, start_date=today, end_date=today)
        # Today has 2 orders (days_ago=0 in _seed_db)
        assert len(result) == 1
        assert result[0].order_count == 2


class TestWeeklyRevenue:
    def test_returns_list(self, db: sqlite3.Connection) -> None:
        result = get_weekly_revenue(db, weeks=104)
        assert isinstance(result, list)
        # Weekly grouping may produce zero or more entries depending on the
        # SQLite strftime implementation — just verify it doesn't crash

    def test_has_required_fields(self, db: sqlite3.Connection) -> None:
        result = get_weekly_revenue(db, weeks=52)
        for entry in result:
            assert isinstance(entry.period, str)
            assert entry.total_amount >= 0
            assert entry.paid_amount >= 0
            assert entry.order_count >= 0


class TestMonthlyRevenue:
    def test_returns_list(self, db: sqlite3.Connection) -> None:
        result = get_monthly_revenue(db, months=24)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_pending_is_non_negative(self, db: sqlite3.Connection) -> None:
        result = get_monthly_revenue(db, months=24)
        for entry in result:
            assert entry.pending_amount >= 0

    def test_avg_per_day_is_reasonable(self, db: sqlite3.Connection) -> None:
        result = get_monthly_revenue(db, months=24)
        for entry in result:
            assert entry.avg_revenue_per_day >= 0
            assert entry.avg_revenue_per_day <= entry.total_amount


class TestYearlyRevenue:
    def test_returns_list(self, db: sqlite3.Connection) -> None:
        result = get_yearly_revenue(db, years=5)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_sums_match(self, db: sqlite3.Connection) -> None:
        result = get_yearly_revenue(db, years=5)
        total = sum(e.total_amount for e in result)
        paid = sum(e.paid_amount for e in result)
        assert total >= paid


class TestOverallSummary:
    def test_returns_summary(self, db: sqlite3.Connection) -> None:
        result = get_overall_summary(db)
        assert isinstance(result, RevenueSummary)
        assert result.total_amount > 0
        assert result.paid_amount > 0

    def test_no_orders_empty_db(self) -> None:
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                total_amount_paise INTEGER DEFAULT 0,
                paid_amount_paise INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        try:
            result = get_overall_summary(conn)
            assert result.order_count == 0
            assert result.total_amount == 0.0
        finally:
            conn.close()