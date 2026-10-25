"""Consistent administrative SQLite backup: python -m app.backup [--output PATH]."""
import argparse
from contextlib import closing
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
from .database import db_path


def create_backup(output=None):
    source=db_path()
    if not source.is_file():
        raise FileNotFoundError('Yedeklenecek veritabanı bulunamadı.')
    target=Path(output) if output else source.parent/'backups'/f"fasoncep-{datetime.now(timezone.utc):%Y%m%d-%H%M%S-%f}.db"
    if target.resolve()==source.resolve():raise ValueError('Yedek kaynak dosyanın üzerine yazılamaz.')
    target.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    fd=os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    os.close(fd)
    try:
        uri='file:'+quote(str(source.resolve()),safe='/')+'?mode=ro'
        with closing(sqlite3.connect(uri,uri=True)) as incoming, closing(sqlite3.connect(target)) as outgoing:
            incoming.backup(outgoing)
            if outgoing.execute('PRAGMA integrity_check').fetchone()[0]!='ok':
                raise RuntimeError('Yedek bütünlük kontrolünü geçemedi.')
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return target


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    print(create_backup(args.output))
