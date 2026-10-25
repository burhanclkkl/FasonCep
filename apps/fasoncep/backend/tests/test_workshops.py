from auth_helpers import test_user
import os
import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi import HTTPException
from app.database import initialize_db, connection
from app.main import create_workshop, list_workshops, update_workshop
from app.schemas import WorkshopInput


class WorkshopTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.env = patch.dict(os.environ, {"FASONCEP_DATA_DIR": self.temp.name})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def test_profiles_are_separate(self):
        initialize_db()
        self.user=test_user()
        self.assertEqual(list_workshops(self.user), [])
        first = create_workshop(WorkshopInput(name="Birinci Atölye", work_types=["Dikim"]), self.user)
        second = create_workshop(WorkshopInput(name="İkinci Atölye", work_types=["Kesim"]), self.user)
        self.assertNotEqual(first.id, second.id)
        update_workshop(second.id, WorkshopInput(name="Yeni İsim", work_types=["Ütü / Paket"]), self.user)
        self.assertEqual([p.name for p in list_workshops(self.user)], ["Birinci Atölye", "Yeni İsim"])
        self.assertEqual(list_workshops(self.user)[0].name, "Birinci Atölye")
        with self.assertRaises(HTTPException) as error:
            update_workshop(9999, WorkshopInput(name="Yok", work_types=["Dikim"]), self.user)
        self.assertEqual(error.exception.status_code, 404)
        initialize_db()
        self.user=test_user()
        self.assertEqual(len(list_workshops(self.user)), 2)

    def test_legacy_migration(self):
        with sqlite3.connect(Path(self.temp.name, "fasoncep.db")) as db:
            db.execute('''CREATE TABLE workshops (
                id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL,
                work_types_json TEXT NOT NULL, employee_band TEXT, phone TEXT, email TEXT,
                address TEXT, description TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')))''')
            db.execute('''INSERT INTO workshops VALUES
                (1, 'Eski Atölye', '["Dikim"]', '6-10', '05551234567', 'info@firma.com',
                'İstanbul', 'Açıklama', '2026-01-01', '2026-01-02')''')
        initialize_db()
        self.user=test_user()
        self.assertEqual(list_workshops(self.user), [])
        # Legacy records survive migration but require explicit ownership assignment.
        with connection() as db:
            db.execute('UPDATE workshops SET owner_id=? WHERE id=1',(self.user['id'],))
        profile = list_workshops(self.user)[0]
        self.assertEqual(profile.model_dump(), dict(id=1, name='Eski Atölye', work_types=['Dikim'],
            employee_band='6-10', phone='05551234567', email='info@firma.com', address='İstanbul',
            description='Açıklama', created_at='2026-01-01', updated_at='2026-01-02'))
        second = create_workshop(WorkshopInput(name="Yeni Atölye", work_types=["Kesim"]), self.user)
        self.assertEqual(second.id, 2)
        initialize_db()
        self.user=test_user()
        self.assertEqual(len(list_workshops(self.user)), 2)
