"""Lead collection only. No accounts, passwords or email delivery are created."""
import os
import re
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from .database import connection
from .auth import rate_limit, digest
from .settings import site_mode
router = APIRouter()


def public_config():
    name = os.getenv('FASONCEP_OPERATOR_NAME', '').strip()
    email = os.getenv('FASONCEP_CONTACT_EMAIL', '').strip()
    ready = os.getenv('FASONCEP_DEMO_REQUESTS_ENABLED', '0') == '1' and bool(name and re.fullmatch(r'[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+', email))
    return {'mode': site_mode(), 'operator_name': name, 'contact_email': email,
            'accepting_requests': ready, 'retention_days': 90}


def cleanup_requests():
    with connection() as db:
        purge_requests(db)


def initialize_requests():
    with connection() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS demo_requests (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, workshop_name TEXT NOT NULL,
            email TEXT NOT NULL, notice_version TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')))''')
        purge_requests(db)


def purge_requests(db):
    db.execute("DELETE FROM demo_requests WHERE created_at < datetime('now','-90 days')")


class DemoRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=80)
    workshop_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    website: str = Field(default='', max_length=200)  # Honeypot, never persisted.

    @field_validator('name', 'workshop_name')
    @classmethod
    def plain_text(cls, value):
        if any(ord(char) < 32 for char in value):
            raise ValueError('Kontrol karakterleri kullanılamaz.')
        return value

    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        if not re.fullmatch(r'[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+', value):
            raise ValueError('Geçerli bir e-posta adresi girin.')
        return value.casefold()


@router.get('/api/public-config')
def config():
    return public_config()


@router.post('/api/demo-requests', status_code=202)
def request_demo(payload: DemoRequest, request: Request):
    if not public_config()['accepting_requests']:
        raise HTTPException(503, 'Demo talepleri henüz açılmadı. Lütfen daha sonra tekrar deneyin.')
    ip = request.client.host if request.client else 'unknown'
    rate_limit([(f'demo:{digest(ip)}', 5, 3600)])
    # Same response for duplicate requests and bot submissions; no address enumeration.
    if not payload.website:
        with connection() as db:
            db.execute('BEGIN IMMEDIATE')
            purge_requests(db)
            exists = db.execute("SELECT 1 FROM demo_requests WHERE email=? AND created_at >= datetime('now','-1 day')", (payload.email,)).fetchone()
            if not exists:
                db.execute('INSERT INTO demo_requests(name,workshop_name,email,notice_version) VALUES (?,?,?,?)',
                           (payload.name,payload.workshop_name,payload.email,'demo-v1'))
    return {'message': 'Talebin alındı. Demo için seninle iletişime geçeceğiz.'}
