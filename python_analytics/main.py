"""Main entry point for the Python Analytics & Reporting Module.

Usage:
    python main.py                    # Run all analytics, generate Excel + charts
    python main.py --excel            # Generate Excel report only
    python main.py --charts           # Generate charts only
    python main.py --summary          # Print console summary only
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date
from pathlib import Path

# Ensure the project root is on sys.path so `analytics` imports work
sys.path.insert(0, str(Path(__file__).resolve().parent))

from analytics import get_connection, paise_to_rupees
from analytics.revenue_analysis import (
    get_daily_revenue,
    get_monthly_revenue,
    get_yearly_revenue,
    get_overall_summary,
)
from analytics.patient_analysis import (
    get_patient_stats,
    get_monthly_registrations,
    get_age_distribution,
    get_gender_distribution,
)
from analytics.test_analysis import get_all_time_top_tests, get_total_tests_count
from analytics.doctor_analysis import get_all_time_doctor_revenue, get_total_doctors_count
from exports.excel_export import generate_excel_report
from charts.chart_generator import generate_all_charts


def print_separator(char: str = "=", width: int = 60) -> None:
    print(char * width)


def print_with_currency(label: str, value: float) -> None:
    print(f"  {label:<30} Rs. {value:>11,.2f}")


def print_summary() -> None:
    """Print a comprehensive console summary."""
    today = date.today().strftime("%d %B %Y")
    print_separator()
    print(f"  LAB MANAGEMENT SYSTEM -- ANALYTICS REPORT")
    print(f"  Generated: {today}")
    print_separator()

    # Overall Revenue
    overall = get_overall_summary()
    print()
    print("  REVENUE SUMMARY")
    print_separator("-")
    print(f"  Period: {overall.period_start} -> {overall.period_end}")
    print(f"  Total Orders: {overall.order_count:,}")
    print_with_currency("Total Revenue", overall.total_amount)
    print_with_currency("Paid Amount", overall.paid_amount)
    print_with_currency("Pending Amount", overall.pending_amount)
    print_with_currency("Avg Revenue / Day", overall.avg_revenue_per_day)

    # Patient Stats
    patients = get_patient_stats()
    print()
    print("  PATIENT STATISTICS")
    print_separator("-")
    print(f"  Total Patients:            {patients.total_patients:>12,}")
    print(f"  New This Month:            {patients.new_this_month:>12,}")
    print(f"  New This Year:             {patients.new_this_year:>12,}")
    print(f"  Avg New / Month:           {patients.avg_new_per_month:>12.1f}")
    print(f"  YoY Growth:                {patients.growth_percent:>+11.1f}%")

    # Test Stats
    total_tests = get_total_tests_count()
    print()
    print("  TEST CATALOG")
    print_separator("-")
    print(f"  Active Tests:              {total_tests:>12,}")

    # Doctor Stats
    total_doctors = get_total_doctors_count()
    print(f"  Referring Doctors:         {total_doctors:>12,}")

    # Top Tests
    print()
    print("  TOP 10 TESTS (All Time)")
    print_separator("-")
    top_tests = get_all_time_top_tests(limit=10)
    if top_tests:
        print(f"  {'Test Name':<35} {'Orders':>8}  {'Revenue':>12}")
        print(f"  {'-'*35} {'-'*8}  {'-'*12}")
        for t in top_tests:
            status = "[OK]" if t.is_active else "[--]"
            print(f"  {t.test_name[:34]:<35} {t.order_count:>8,}  Rs. {t.total_revenue:>9,.2f}  {status}")
    else:
        print("  No test data available.")

    # Top Doctors
    print()
    print("  TOP 10 DOCTORS (All Time)")
    print_separator("-")
    top_doctors = get_all_time_doctor_revenue(limit=10)
    if top_doctors:
        print(f"  {'Doctor Name':<30} {'Patients':>8} {'Orders':>8}  {'Revenue':>12}")
        print(f"  {'-'*30} {'-'*8} {'-'*8}  {'-'*12}")
        for d in top_doctors:
            print(f"  {d.doctor_name[:29]:<30} {d.patient_count:>8,} {d.order_count:>8,}  Rs. {d.total_revenue:>9,.2f}")
    else:
        print("  No doctor data available.")

    # Monthly Revenue
    print()
    print("  MONTHLY REVENUE (Last 12 Months)")
    print_separator("-")
    monthly = get_monthly_revenue(months=12)
    if monthly:
        print(f"  {'Month':<10} {'Orders':>8}  {'Total':>12}  {'Paid':>12}  {'Pending':>12}")
        print(f"  {'-'*10} {'-'*8}  {'-'*12}  {'-'*12}  {'-'*12}")
        for m in monthly:
            print(f"  {m.period:<10} {m.order_count:>8,}  Rs. {m.total_amount:>9,.2f}  Rs. {m.paid_amount:>9,.2f}  Rs. {m.pending_amount:>9,.2f}")
    else:
        print("  No monthly data available.")

    # Age Distribution
    print()
    print("  AGE DISTRIBUTION")
    print_separator("-")
    age_dist = get_age_distribution()
    for group, count in age_dist.items():
        bar = "#" * max(1, count // max(1, max(age_dist.values()) // 40))
        print(f"  {group:<8} {count:>6,}  {bar}")

    # Gender Distribution
    print()
    print("  GENDER DISTRIBUTION")
    print_separator("-")
    gender_dist = get_gender_distribution()
    total = sum(gender_dist.values()) or 1
    for g, count in sorted(gender_dist.items(), key=lambda x: -x[1]):
        pct = (count / total) * 100
        print(f"  {g:<15} {count:>6,}  ({pct:>5.1f}%)")

    print()
    print_separator()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Lab Management System -- Analytics & Reporting Module"
    )
    parser.add_argument(
        "--excel",
        action="store_true",
        help="Generate Excel report only (Revenue_Report.xlsx)",
    )
    parser.add_argument(
        "--charts",
        action="store_true",
        help="Generate PNG charts only",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print console summary only",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output directory for Excel and charts (default: python_analytics/output/)",
    )

    args = parser.parse_args()

    # If no flags given, run everything
    run_all = not (args.excel or args.charts or args.summary)

    try:
        # Test database connectivity
        conn = get_connection()
        conn.close()
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        print()
        print("The database file was not found. Make sure:")
        print("  1. The Tauri application has been run at least once to create the database.")
        print("  2. Set the DB_PATH environment variable to the full path of lab_data.db.")
        print()
        print("  Example: set DB_PATH=C:\\Users\\...\\lab_data.db")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Could not connect to the database: {e}")
        sys.exit(1)

    if run_all or args.summary:
        print_summary()

    if run_all or args.excel:
        print("Generating Excel report...")
        try:
            path = generate_excel_report(args.output)
            print(f"  [OK] Excel report saved to: {path}")
        except Exception as e:
            print(f"  [FAIL] Failed to generate Excel report: {e}")

    if run_all or args.charts:
        print("Generating charts...")
        try:
            charts = generate_all_charts(args.output)
            for name, path in charts.items():
                print(f"  [OK] {name}.png saved to: {path}")
        except Exception as e:
            print(f"  [FAIL] Failed to generate charts: {e}")

    print()
    print("Done.")


if __name__ == "__main__":
    main()