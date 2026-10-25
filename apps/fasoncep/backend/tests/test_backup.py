import sqlite3
import pytest
from app.backup import create_backup
from app.database import initialize_db,connection


def test_consistent_backup_does_not_overwrite_source_or_existing_files(tmp_path,monkeypatch):
    monkeypatch.setenv('FASONCEP_DATA_DIR',str(tmp_path/'data'))
    initialize_db()
    with connection() as db:db.execute("INSERT INTO workshops(name,work_types_json) VALUES ('Örnek','[\"Dikim\"]')")
    backup=create_backup()
    with sqlite3.connect(backup) as db:assert db.execute('SELECT name FROM workshops').fetchone()[0]=='Örnek'
    with pytest.raises(FileExistsError):create_backup(backup)
    with pytest.raises(ValueError):create_backup(tmp_path/'data'/'fasoncep.db')
