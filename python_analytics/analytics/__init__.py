"""Shared database connection utility for the Python Analytics module.

Reads from the existing SQLite database used by the Tauri backend.
Uses read-only queries only — never modifies the database.
"""

import os
import sqlite3
from pathlib import Path
from typing import Optional


def _resolve_db_path() -> Path:
    """Resolve the path to the SQLite database file.

    Priority:
    1. DB_PATH environment variable (custom path)
    2. Default OS data directory (same as Tauri's connection.rs)
    """
    env_path = os.environ.get("DB_PATH")
    if env_path:
        return Path(env_path)

    # Resolve default OS data directory (mirrors Rust's dirs::data_dir)
    if os.name == "nt":
        # Windows: %APPDATA%/lab-management-system
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            return Path(appdata) / "lab-management-system" / "lab_data.db"
    else:
        # Linux: ~/.local/share/lab-management-system
        data_home = os.environ.get("XDG_DATA_HOME", "")
        if not data_home:
            data_home = str(Path.home() / ".local" / "share")
        return Path(data_home) / "lab-management-system" / "lab_data.db"

    # Fallback: check common locations
    fallback = Path.home() / ".local" / "share" / "lab-management-system" / "lab_data.db"
    if fallback.exists():
        return fallback

    raise FileNotFoundError(
        "Could not locate the database file. "
        "Set the DB_PATH environment variable to the full path of lab_data.db."
    )


def get_connection(readonly: bool = True) -> sqlite3.Connection:
    """Get a read-only connection to the lab management database.

    Args:
        readonly: If True (default), opens in read-only mode with URI.

    Returns:
        A sqlite3.Connection object.

    Raises:
        FileNotFoundError: If the database file cannot be located.
        sqlite3.Error: If the connection cannot be opened.
    """
    db_path = _resolve_db_path()

    if not db_path.exists():
        raise FileNotFoundError(
            f"Database file not found at: {db_path}\n"
            "Please ensure the database has been initialized by the Tauri application."
        )

    if readonly:
        uri = f"file:{db_path}?mode=ro"
        conn = sqlite3.connect(uri, uri=True)
    else:
        conn = sqlite3.connect(str(db_path))

    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")

    return conn


def paise_to_rupees(paise: Optional[int]) -> float:
    """Convert paise (integer) to rupees (float).

    Args:
        paise: Amount in paise (1/100th of a rupee).

    Returns:
        Amount in rupees, rounded to 2 decimal places.
    """
    if paise is None:
        return 0.0
    return round(paise / 100.0, 2)