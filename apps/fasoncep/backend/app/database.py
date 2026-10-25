"""SQLite persistence for one application instance and a persistent data volume."""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from collections.abc import Iterator
from pathlib import Path

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def db_path() -> Path:
    data_dir = Path(os.getenv("FASONCEP_DATA_DIR", str(DEFAULT_DATA_DIR)))
    data_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name != "nt":
        data_dir.chmod(0o700)
    return data_dir / "fasoncep.db"


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    path = db_path()
    conn = sqlite3.connect(path, timeout=10)
    if os.name != "nt":
        path.chmod(0o600)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def initialize_db() -> None:
    with connection() as db:
        # Migrate the original single-workshop table atomically, preserving its profile.
        existing = db.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='workshops'").fetchone()
        legacy = existing is not None and "CHECK" in existing["sql"].upper()
        if legacy:
            db.execute("BEGIN IMMEDIATE")
            db.execute("ALTER TABLE workshops RENAME TO workshops_single_backup")
        db.execute("""
            CREATE TABLE IF NOT EXISTS workshops (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                work_types_json TEXT NOT NULL,
                employee_band TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                description TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

        if legacy:
            db.execute("INSERT INTO workshops SELECT * FROM workshops_single_backup")
            db.execute("DROP TABLE workshops_single_backup")
        from .auth import initialize_auth
        initialize_auth(db)
        from .operations import initialize_tables
        initialize_tables(db)
        db.execute("PRAGMA user_version=5")
