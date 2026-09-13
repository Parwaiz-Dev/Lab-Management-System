"""Tests for the Excel export module."""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_excel_export_creates_file() -> None:
    """Test that the Excel report is generated and contains expected sheets."""
    from exports.excel_export import generate_excel_report

    with tempfile.TemporaryDirectory() as tmpdir:
        report_path = generate_excel_report(output_dir=tmpdir)

        assert os.path.exists(report_path)
        assert report_path.endswith(".xlsx")
        assert "Revenue_Report.xlsx" in report_path


def test_excel_export_has_sheets() -> None:
    """Test that all 6 sheets are present in the generated workbook."""
    import openpyxl
    from exports.excel_export import generate_excel_report

    with tempfile.TemporaryDirectory() as tmpdir:
        report_path = generate_excel_report(output_dir=tmpdir)
        wb = openpyxl.load_workbook(report_path)

        expected_sheets = [
            "Summary",
            "Patients",
            "Orders",
            "Payments",
            "Doctor Revenue",
            "Top Tests",
        ]
        for sheet_name in expected_sheets:
            assert sheet_name in wb.sheetnames, f"Missing sheet: {sheet_name}"

        wb.close()


def test_summary_sheet_has_content() -> None:
    """Test that the Summary sheet has metric/value rows."""
    import openpyxl
    from exports.excel_export import generate_excel_report

    with tempfile.TemporaryDirectory() as tmpdir:
        report_path = generate_excel_report(output_dir=tmpdir)
        wb = openpyxl.load_workbook(report_path)
        ws = wb["Summary"]

        # Should have at least a title row and some data rows
        assert ws.max_row > 3, "Summary sheet appears empty"
        assert ws.max_column >= 2, "Summary sheet has too few columns"

        wb.close()


def test_sheets_have_headers() -> None:
    """Test that all data sheets have bold header rows."""
    import openpyxl
    from exports.excel_export import generate_excel_report

    with tempfile.TemporaryDirectory() as tmpdir:
        report_path = generate_excel_report(output_dir=tmpdir)
        wb = openpyxl.load_workbook(report_path)

        data_sheets = ["Patients", "Orders", "Payments", "Doctor Revenue", "Top Tests"]
        for sheet_name in data_sheets:
            ws = wb[sheet_name]
            # Find the header row (the one with bold font)
            header_found = False
            for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 10)):
                for cell in row:
                    if cell.font and cell.font.bold and cell.value:
                        header_found = True
                        break
                if header_found:
                    break
            assert header_found, f"No bold header found in sheet: {sheet_name}"

        wb.close()