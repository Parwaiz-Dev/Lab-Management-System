# Python Analytics & Reporting Module

A standalone Python analytics module for the Lab Management System.  Reads from the
existing SQLite database and generates Excel reports and PNG charts.

## Requirements

- Python 3.9+
- pip packages listed in `requirements.txt`

### Install Dependencies

```bash
cd python_analytics
pip install -r requirements.txt
```

## Database Connection

The module reads from the same SQLite database used by the Tauri desktop application.
It resolves the database path automatically:

1. `DB_PATH` environment variable (custom path)
2. Default OS data directory:
   - **Windows:** `%APPDATA%/lab-management-system/lab_data.db`
   - **Linux:** `~/.local/share/lab-management-system/lab_data.db`

To use a custom path:

```bash
# Windows (cmd)
set DB_PATH=C:\Users\YourName\AppData\Roaming\lab-management-system\lab_data.db

# Linux / macOS
export DB_PATH=/home/yourname/.local/share/lab-management-system/lab_data.db
```

> **Important:** The database must be initialized by running the Tauri application at
> least once before using this module.

## Usage

### Run Everything (Summary + Excel + Charts)

```bash
cd python_analytics
python main.py
```

### Console Summary Only

```bash
python main.py --summary
```

### Excel Report Only

```bash
python main.py --excel
```

### Charts Only

```bash
python main.py --charts
```

### Custom Output Directory

```bash
python main.py --output D:\Reports
```

## Output Files

| File | Description |
|------|-------------|
| `output/Revenue_Report.xlsx` | Excel workbook with 6 sheets |
| `output/daily_revenue.png` | Bar chart of daily revenue (30 days) |
| `output/monthly_revenue.png` | Bar chart of monthly revenue (12 months) |
| `output/top_tests.png` | Horizontal bar of top 10 tests |
| `output/doctor_revenue.png` | Horizontal bar of top 10 doctors |
| `output/patient_growth.png` | Line chart of monthly patient registrations |

### Excel Workbook Sheets

| Sheet | Content |
|-------|---------|
| **Summary** | Overall revenue, patient count, test count, doctor count, YoY growth |
| **Patients** | Monthly new patient registrations with cumulative totals |
| **Orders** | Daily revenue breakdown (total, paid, pending) |
| **Payments** | Monthly payment summary with collection percentage |
| **Doctor Revenue** | Doctor-wise revenue ranking (patients, orders, revenue) |
| **Top Tests** | Most-ordered tests with revenue and active status |

## Project Structure

```
python_analytics/
├── main.py                          # Entry point — CLI runner
├── requirements.txt                 # Python dependencies
├── README.md                        # This file
├── analytics/
│   ├── __init__.py                  # DB connection + paise→rupees helper
│   ├── revenue_analysis.py          # Daily, weekly, monthly, yearly revenue
│   ├── patient_analysis.py          # Patient stats, registrations, demographics
│   ├── test_analysis.py             # Top tests, order counts
│   └── doctor_analysis.py           # Doctor-wise revenue and patient count
├── exports/
│   ├── __init__.py
│   └── excel_export.py              # Excel report generation (OpenPyXL)
├── charts/
│   ├── __init__.py
│   └── chart_generator.py           # PNG chart generation (Matplotlib)
├── tests/
│   ├── __init__.py
│   ├── test_revenue.py              # Tests for revenue calculations
│   ├── test_excel.py                # Tests for Excel export
│   └── test_charts.py               # Tests for chart generation
└── output/                          # Generated reports and charts
    ├── Revenue_Report.xlsx
    ├── daily_revenue.png
    ├── monthly_revenue.png
    ├── top_tests.png
    ├── doctor_revenue.png
    └── patient_growth.png
```

## Running Tests

```bash
cd python_analytics
pytest tests/ -v
```

## Notes

- **Read-only:** The module only reads from the database. It never modifies data.
- **Money handling:** All amounts in the database are stored in *paise* (integer,
  1/100th of a rupee). The `paise_to_rupees()` helper converts to rupees (float).
- **Error handling:** Returns zero/empty results for missing data instead of crashing.
- **No backend changes:** This module is completely independent of the Rust/Tauri
  backend and React frontend. No existing code is modified.