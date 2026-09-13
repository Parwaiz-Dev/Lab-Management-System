"""Chart generator — produces PNG charts for the analytics module.

Charts generated:
  daily_revenue.png   — bar chart of daily revenue
  monthly_revenue.png — bar chart of monthly revenue
  top_tests.png       — horizontal bar of top 10 tests
  doctor_revenue.png  — horizontal bar of top 10 doctors
  patient_growth.png  — line chart of monthly patient registrations
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import matplotlib
matplotlib.use("Agg")  # non-interactive backend

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

from analytics.revenue_analysis import (
    get_daily_revenue,
    get_monthly_revenue,
    get_overall_summary,
)
from analytics.patient_analysis import get_monthly_registrations
from analytics.test_analysis import get_all_time_top_tests
from analytics.doctor_analysis import get_all_time_doctor_revenue

# ---------------------------------------------------------------------------
# Style constants
# ---------------------------------------------------------------------------
PRIMARY = "#3B82F6"       # Blue
SUCCESS = "#10B981"       # Green
WARNING = "#F59E0B"       # Amber
DANGER = "#EF4444"        # Red
PURPLE = "#8B5CF6"        # Violet
DARK = "#1F2937"          # Dark gray
GREY = "#6B7280"          # Medium gray
LIGHT = "#F3F4F6"         # Light gray

plt.rcParams.update(
    {
        "font.family": "sans-serif",
        "font.sans-serif": ["Calibri", "DejaVu Sans", "Arial"],
        "font.size": 10,
        "axes.titlesize": 14,
        "axes.labelsize": 11,
        "axes.edgecolor": DARK,
        "axes.grid": True,
        "axes.grid.axis": "y",
        "grid.alpha": 0.15,
        "grid.color": DARK,
        "xtick.color": DARK,
        "ytick.color": DARK,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
    }
)


def _ensure_output_dir(output_dir: Optional[str] = None) -> str:
    if output_dir is None:
        output_dir = str(Path(__file__).resolve().parent.parent / "output")
    os.makedirs(output_dir, exist_ok=True)
    return output_dir


def _save_and_close(output_dir: str, filename: str) -> str:
    path = os.path.join(output_dir, filename)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close()
    return os.path.abspath(path)


# ---------------------------------------------------------------------------
# Individual charts
# ---------------------------------------------------------------------------

def generate_daily_revenue_chart(output_dir: Optional[str] = None) -> str:
    """Bar chart of daily revenue (last 30 days)."""
    output_dir = _ensure_output_dir(output_dir)
    daily = get_daily_revenue()

    if not daily:
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.text(0.5, 0.5, "No data available", transform=ax.transAxes,
                ha="center", va="center", fontsize=14, color=GREY)
        return _save_and_close(output_dir, "daily_revenue.png")

    dates = [d.date for d in daily]
    totals = [d.total_amount for d in daily]
    paid = [d.paid_amount for d in daily]

    fig, ax = plt.subplots(figsize=(12, 5))
    x = np.arange(len(dates))
    width = 0.38

    bars1 = ax.bar(x - width / 2, totals, width, label="Total Revenue", color=PRIMARY, alpha=0.9)
    bars2 = ax.bar(x + width / 2, paid, width, label="Paid", color=SUCCESS, alpha=0.9)

    ax.set_xlabel("Date")
    ax.set_ylabel("Revenue (₹)")
    ax.set_title("Daily Revenue")
    ax.set_xticks(x)
    ax.set_xticklabels(dates, rotation=45, ha="right", fontsize=8)
    ax.legend(loc="upper right")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"₹{v:,.0f}"))

    # Only show every Nth label to avoid crowding
    step = max(1, len(dates) // 12)
    for i, label in enumerate(ax.get_xticklabels()):
        if i % step != 0:
            label.set_visible(False)

    return _save_and_close(output_dir, "daily_revenue.png")


def generate_monthly_revenue_chart(output_dir: Optional[str] = None) -> str:
    """Bar chart of monthly revenue (last 12 months)."""
    output_dir = _ensure_output_dir(output_dir)
    monthly = get_monthly_revenue(months=12)

    if not monthly:
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.text(0.5, 0.5, "No data available", transform=ax.transAxes,
                ha="center", va="center", fontsize=14, color=GREY)
        return _save_and_close(output_dir, "monthly_revenue.png")

    months = [m.period for m in monthly]
    totals = [m.total_amount for m in monthly]
    paid = [m.paid_amount for m in monthly]
    pending = [m.pending_amount for m in monthly]

    fig, ax = plt.subplots(figsize=(12, 5))
    x = np.arange(len(months))
    width = 0.25

    ax.bar(x - width, totals, width, label="Total", color=PRIMARY, alpha=0.9)
    ax.bar(x, paid, width, label="Paid", color=SUCCESS, alpha=0.9)
    ax.bar(x + width, pending, width, label="Pending", color=WARNING, alpha=0.9)

    ax.set_xlabel("Month")
    ax.set_ylabel("Revenue (₹)")
    ax.set_title("Monthly Revenue")
    ax.set_xticks(x)
    ax.set_xticklabels(months, rotation=45, ha="right", fontsize=9)
    ax.legend(loc="upper right")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"₹{v:,.0f}"))

    return _save_and_close(output_dir, "monthly_revenue.png")


def generate_top_tests_chart(output_dir: Optional[str] = None) -> str:
    """Horizontal bar chart of top 10 tests."""
    output_dir = _ensure_output_dir(output_dir)
    tests = get_all_time_top_tests(limit=10)

    if not tests:
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.text(0.5, 0.5, "No data available", transform=ax.transAxes,
                ha="center", va="center", fontsize=14, color=GREY)
        return _save_and_close(output_dir, "top_tests.png")

    tests = tests[::-1]  # reverse so highest is at the top
    names = [t.test_name for t in tests]
    counts = [t.order_count for t in tests]

    fig, ax = plt.subplots(figsize=(10, 5))
    colors = [PRIMARY if t.is_active else GREY for t in tests]
    bars = ax.barh(names, counts, color=colors, alpha=0.9)

    ax.set_xlabel("Number of Orders")
    ax.set_title("Top 10 Tests by Order Count")
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))

    # Add value labels
    for bar, count in zip(bars, counts):
        ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height() / 2,
                str(count), va="center", fontsize=9, color=DARK)

    return _save_and_close(output_dir, "top_tests.png")


def generate_doctor_revenue_chart(output_dir: Optional[str] = None) -> str:
    """Horizontal bar chart of top 10 doctors by revenue."""
    output_dir = _ensure_output_dir(output_dir)
    doctors = get_all_time_doctor_revenue(limit=10)

    if not doctors:
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.text(0.5, 0.5, "No data available", transform=ax.transAxes,
                ha="center", va="center", fontsize=14, color=GREY)
        return _save_and_close(output_dir, "doctor_revenue.png")

    doctors = doctors[::-1]
    names = [d.doctor_name for d in doctors]
    revenues = [d.total_revenue for d in doctors]

    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.barh(names, revenues, color=PURPLE, alpha=0.9)

    ax.set_xlabel("Revenue (₹)")
    ax.set_title("Top 10 Doctors by Revenue")
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"₹{v:,.0f}"))

    for bar, rev in zip(bars, revenues):
        ax.text(bar.get_width() + 100, bar.get_y() + bar.get_height() / 2,
                f"₹{rev:,.0f}", va="center", fontsize=9, color=DARK)

    return _save_and_close(output_dir, "doctor_revenue.png")


def generate_patient_growth_chart(output_dir: Optional[str] = None) -> str:
    """Line chart of monthly new patient registrations."""
    output_dir = _ensure_output_dir(output_dir)
    monthly = get_monthly_registrations(months=12)

    if not monthly:
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.text(0.5, 0.5, "No data available", transform=ax.transAxes,
                ha="center", va="center", fontsize=14, color=GREY)
        return _save_and_close(output_dir, "patient_growth.png")

    months = [m.month for m in monthly]
    new_patients = [m.new_patients for m in monthly]
    cumulative = [m.cumulative_total for m in monthly]

    fig, ax1 = plt.subplots(figsize=(12, 5))

    # Bar for new registrations
    ax1.bar(months, new_patients, color=PRIMARY, alpha=0.7, label="New Patients")
    ax1.set_xlabel("Month")
    ax1.set_ylabel("New Patients", color=PRIMARY)
    ax1.tick_params(axis="y", labelcolor=PRIMARY)
    ax1.set_xticks(range(len(months)))
    ax1.set_xticklabels(months, rotation=45, ha="right", fontsize=9)
    ax1.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))

    # Line for cumulative total
    ax2 = ax1.twinx()
    ax2.plot(months, cumulative, color=DANGER, marker="o", linewidth=2, markersize=6, label="Cumulative")
    ax2.set_ylabel("Cumulative Total", color=DANGER)
    ax2.tick_params(axis="y", labelcolor=DANGER)
    ax2.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{v:,.0f}"))

    ax1.set_title("Patient Growth — Monthly Registrations")

    # Combined legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left")

    return _save_and_close(output_dir, "patient_growth.png")


# ---------------------------------------------------------------------------
# Batch generation
# ---------------------------------------------------------------------------

def generate_all_charts(output_dir: Optional[str] = None) -> dict[str, str]:
    """Generate all five charts and return a dict of chart_name → file_path."""
    return {
        "daily_revenue": generate_daily_revenue_chart(output_dir),
        "monthly_revenue": generate_monthly_revenue_chart(output_dir),
        "top_tests": generate_top_tests_chart(output_dir),
        "doctor_revenue": generate_doctor_revenue_chart(output_dir),
        "patient_growth": generate_patient_growth_chart(output_dir),
    }