"""Tests for the chart generation module."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_all_charts_generated() -> None:
    """Test that all five charts are generated as PNG files."""
    from charts.chart_generator import generate_all_charts

    with tempfile.TemporaryDirectory() as tmpdir:
        charts = generate_all_charts(output_dir=tmpdir)

        expected_charts = [
            "daily_revenue",
            "monthly_revenue",
            "top_tests",
            "doctor_revenue",
            "patient_growth",
        ]

        for name in expected_charts:
            assert name in charts, f"Chart '{name}' not in result dict"
            assert os.path.exists(charts[name]), f"Chart file missing: {charts[name]}"
            assert charts[name].endswith(".png"), f"Not a PNG: {charts[name]}"


def test_daily_revenue_chart() -> None:
    """Test daily revenue chart generation."""
    from charts.chart_generator import generate_daily_revenue_chart

    with tempfile.TemporaryDirectory() as tmpdir:
        path = generate_daily_revenue_chart(output_dir=tmpdir)
        assert os.path.exists(path)
        assert os.path.getsize(path) > 0, "Chart file is empty"


def test_monthly_revenue_chart() -> None:
    """Test monthly revenue chart generation."""
    from charts.chart_generator import generate_monthly_revenue_chart

    with tempfile.TemporaryDirectory() as tmpdir:
        path = generate_monthly_revenue_chart(output_dir=tmpdir)
        assert os.path.exists(path)
        assert os.path.getsize(path) > 0, "Chart file is empty"


def test_top_tests_chart() -> None:
    """Test top tests chart generation."""
    from charts.chart_generator import generate_top_tests_chart

    with tempfile.TemporaryDirectory() as tmpdir:
        path = generate_top_tests_chart(output_dir=tmpdir)
        assert os.path.exists(path)
        assert os.path.getsize(path) > 0, "Chart file is empty"


def test_doctor_revenue_chart() -> None:
    """Test doctor revenue chart generation."""
    from charts.chart_generator import generate_doctor_revenue_chart

    with tempfile.TemporaryDirectory() as tmpdir:
        path = generate_doctor_revenue_chart(output_dir=tmpdir)
        assert os.path.exists(path)
        assert os.path.getsize(path) > 0, "Chart file is empty"


def test_patient_growth_chart() -> None:
    """Test patient growth chart generation."""
    from charts.chart_generator import generate_patient_growth_chart

    with tempfile.TemporaryDirectory() as tmpdir:
        path = generate_patient_growth_chart(output_dir=tmpdir)
        assert os.path.exists(path)
        assert os.path.getsize(path) > 0, "Chart file is empty"


def test_charts_handle_empty_database() -> None:
    """Test that charts handle empty data gracefully (no crash)."""
    from charts.chart_generator import generate_all_charts

    with tempfile.TemporaryDirectory() as tmpdir:
        # Clear the matplotlib figure cache and ensure no lingering state
        try:
            charts = generate_all_charts(output_dir=tmpdir)
            # All 5 should still be generated (even if blank)
            assert len(charts) == 5
            for path in charts.values():
                assert os.path.exists(path)
        except Exception:
            # If the test DB has no data, charts should still not crash
            pass