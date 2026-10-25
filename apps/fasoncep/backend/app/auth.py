"""Password hashing, opaque cookie sessions, and workshop ownership."""
import hashlib
import re
import secrets
import time
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from argon2 import PasswordHasher
from argon2.low_level import Type
from argon2.exceptions import VerificationError, InvalidHashError
from .database import connection
from .settings import secure_cookies

router = APIRouter(prefix='/api/auth')
HASHER = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1, hash_len=32, salt_len=16, type=Type.ID)
DUMMY_HASH = HASHER.hash(secrets.token_urlsafe(32))
COOKIE = 'fasoncep_session'
SESSION_SECONDS = 12 * 60 * 60


def initialize_auth(db):
    db.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL, password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')))''')
    db.execute('''CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL)''')
    db.execute('CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)')
    db.execute('''CREATE TABLE IF NOT EXISTS auth_attempts (
        id INTEGER PRIMARY KEY, scope TEXT NOT NULL, attempted_at INTEGER NOT NULL)''')
    db.execute('CREATE INDEX IF NOT EXISTS auth_attempts_scope ON auth_attempts(scope,attempted_at)')
    columns = {r['name'] for r in db.execute('PRAGMA table_info(workshops)')}
    if 'owner_id' not in columns:
        db.execute('ALTER TABLE workshops ADD COLUMN owner_id INTEGER REFERENCES users(id)')
    db.execute('CREATE INDEX IF NOT EXISTS workshops_owner ON workshops(owner_id)')


class LoginInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        value = value.strip().casefold()
        if not re.fullmatch(r'[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+', value):
            raise ValueError('Geçerli bir e-posta adresi girin.')
        return value


class RegisterInput(LoginInput):
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=12, max_length=128)

    @field_validator('name')
    @classmethod
    def valid_name(cls, value):
        value = value.strip()
        if len(value) < 2: raise ValueError('Adınız en az 2 karakter olmalı.')
        return value

    @field_validator('password')
    @classmethod
    def valid_password(cls, value):
        if len(value.strip()) < 12: raise ValueError('Şifre en az 12 karakter olmalı; yalnızca boşluk olamaz.')
        return value


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def current_user(request: Request):
    token = request.cookies.get(COOKIE, '')
    if not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
        raise HTTPException(401, 'Devam etmek için giriş yapın.')
    with connection() as db:
        user = db.execute('''SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id
                             WHERE s.token_hash=? AND s.expires_at>?''', (digest(token), int(time.time()))).fetchone()
    if user is None: raise HTTPException(401, 'Oturumunuz sona erdi. Yeniden giriş yapın.')
    return dict(user)


def assert_owner(db, workshop_id, user_id):
    if not db.execute('SELECT id FROM workshops WHERE id=? AND owner_id=?', (workshop_id,user_id)).fetchone():
        raise HTTPException(404, 'Atölye bulunamadı.')


def rate_limit(scopes):
    now = int(time.time())
    limited = False
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM auth_attempts WHERE attempted_at<?', (now-3600,))
        for scope, limit, window in scopes:
            count = db.execute('SELECT COUNT(*) FROM auth_attempts WHERE scope=? AND attempted_at>?', (scope,now-window)).fetchone()[0]
            if count >= limit: limited = True
        if not limited:
            for scope, _, _ in scopes: db.execute('INSERT INTO auth_attempts(scope,attempted_at) VALUES (?,?)',(scope,now))
    if limited: raise HTTPException(429, 'Çok fazla deneme yaptınız. Bir süre sonra tekrar deneyin.', headers={'Retry-After':'900'})


def start_session(db, response, request, user_id):
    old = request.cookies.get(COOKIE,'')
    if old: db.execute('DELETE FROM sessions WHERE token_hash=?',(digest(old),))
    token = secrets.token_urlsafe(32)
    db.execute('DELETE FROM sessions WHERE expires_at<=?',(int(time.time()),))
    db.execute('INSERT INTO sessions VALUES (?,?,?)',(digest(token),user_id,int(time.time())+SESSION_SECONDS))
    response.set_cookie(COOKIE,token,max_age=SESSION_SECONDS,httponly=True,samesite='strict',
                        secure=secure_cookies(request),path='/')
    response.headers['Cache-Control']='no-store'


@router.post('/register',status_code=201)
def register(payload:RegisterInput,request:Request,response:Response):
    ip = request.client.host if request.client else 'unknown'
    rate_limit([(f'register:{ip}',10,3600)])
    hashed = HASHER.hash(payload.password)
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        if db.execute('SELECT id FROM users WHERE email=?',(payload.email,)).fetchone():
            raise HTTPException(409,'Bu e-posta adresiyle bir hesap zaten var. Giriş yapabilirsiniz.')
        user_id = db.execute('INSERT INTO users(email,name,password_hash) VALUES (?,?,?)',(payload.email,payload.name,hashed)).lastrowid
        start_session(db,response,request,user_id)
    return dict(id=user_id,email=payload.email,name=payload.name)


@router.post('/login')
def login(payload:LoginInput,request:Request,response:Response):
    ip = request.client.host if request.client else 'unknown'
    rate_limit([(f'login-ip:{ip}',60,900),(f'login-email:{payload.email}',10,900)])
    with connection() as db:
        row=db.execute('SELECT * FROM users WHERE email=?',(payload.email,)).fetchone()
    try:
        verified = HASHER.verify(row['password_hash'] if row else DUMMY_HASH,payload.password)
    except (VerificationError,InvalidHashError):
        verified=False
    if not row or not verified: raise HTTPException(401,'E-posta veya şifre hatalı.')
    with connection() as db:
        if HASHER.check_needs_rehash(row['password_hash']):
            db.execute('UPDATE users SET password_hash=? WHERE id=?',(HASHER.hash(payload.password),row['id']))
        db.execute('DELETE FROM auth_attempts WHERE scope=?',(f'login-email:{payload.email}',))
        start_session(db,response,request,row['id'])
    return dict(id=row['id'],email=row['email'],name=row['name'])


@router.get('/me')
def me(user=Depends(current_user)):
    return user


@router.post('/logout')
def logout(request:Request,response:Response):
    token=request.cookies.get(COOKIE,'')
    if token:
        with connection() as db: db.execute('DELETE FROM sessions WHERE token_hash=?',(digest(token),))
    response.delete_cookie(COOKIE,path='/',httponly=True,samesite='strict',secure=secure_cookies(request))
    response.headers['Cache-Control']='no-store'
    return {'status':'ok'}

