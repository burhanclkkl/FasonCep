import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import connection
from app.auth import COOKIE,digest,HASHER
PASSWORD='Uzun ve guvenli parola 123!'

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('FASONCEP_DATA_DIR',str(tmp_path))
    with TestClient(app,headers={'X-FasonCep-Request':'1'}) as c:yield c

def register(c,email='owner@example.com',password=PASSWORD):
    return c.post('/api/auth/register',json={'name':'Atölye Sahibi','email':email,'password':password})

def test_hash_cookie_logout_and_revocation(client):
    c=client
    assert c.get('/api/workshops').status_code==401
    response=register(c)
    assert response.status_code==201,response.text
    assert set(response.json())=={'id','email','name'}
    cookie=response.headers['set-cookie'].lower()
    assert 'httponly' in cookie and 'samesite=strict' in cookie and 'max-age=43200' in cookie
    token=c.cookies.get(COOKIE)
    with connection() as db:
        user=db.execute('SELECT * FROM users').fetchone();session=db.execute('SELECT * FROM sessions').fetchone()
        assert user['password_hash'].startswith('$argon2id$') and user['password_hash']!=PASSWORD
        assert HASHER.verify(user['password_hash'],PASSWORD)
        assert session['token_hash']==digest(token) and session['token_hash']!=token
    assert c.get('/api/auth/me').json()['email']=='owner@example.com'
    assert c.get('/api/auth/me').headers['cache-control']=='no-store'
    assert c.post('/api/auth/logout',json={}).status_code==200
    assert c.get('/api/auth/me').status_code==401
    c.cookies.set(COOKIE,token)
    assert c.get('/api/workshops').status_code==401

def test_login_normalization_generic_errors_and_rotation(client):
    c=client;register(c,email='  Owner@Example.COM  ');old=c.cookies.get(COOKIE)
    for email in ['owner@example.com','nobody@example.com']:
        r=c.post('/api/auth/login',json={'email':email,'password':'yanlis'})
        assert r.status_code==401 and r.json()['detail']=='E-posta veya şifre hatalı.'
    assert c.post('/api/auth/login',json={'email':'OWNER@EXAMPLE.COM','password':PASSWORD}).status_code==200
    assert c.cookies.get(COOKIE)!=old
    with connection() as db:assert not db.execute('SELECT 1 FROM sessions WHERE token_hash=?',(digest(old),)).fetchone()
    assert register(c,email='owner@example.com').status_code==409

def test_accounts_are_isolated(client):
    c=client;register(c)
    ws=c.post('/api/workshops',json={'name':'Gizli Atölye','work_types':['Dikim']}).json()['id']
    customer=c.post(f'/api/workshops/{ws}/operations/customers',json={'name':'Gizli Firma'}).json()['customers'][0]
    register(c,email='second@example.com')
    assert c.get('/api/workshops').json()==[]
    for endpoint in ['operations','export.xlsx']:assert c.get(f'/api/workshops/{ws}/{endpoint}').status_code==404
    assert c.put(f'/api/workshops/{ws}',json={'name':'Ele geçirme','work_types':['Kesim']}).status_code==404
    assert c.post(f'/api/workshops/{ws}/operations/customers',json={'name':'Yetkisiz'}).status_code==404
    assert c.delete(f"/api/workshops/{ws}/operations/customers/{customer['id']}").status_code==404
    with connection() as db:
        hashes=[r[0] for r in db.execute('SELECT password_hash FROM users')];assert hashes[0]!=hashes[1]

def test_signup_never_claims_orphaned_legacy_data(client):
    with connection() as db:ws=db.execute("INSERT INTO workshops(name,work_types_json) VALUES ('Eski Atölye','[\"Dikim\"]')").lastrowid
    register(client)
    assert client.get('/api/workshops').json()==[]
    assert client.get(f'/api/workshops/{ws}/operations').status_code==404
    register(client,email='second@example.com')
    assert client.get('/api/workshops').json()==[]

def test_expired_and_forged_sessions(client):
    register(client)
    with connection() as db:db.execute('UPDATE sessions SET expires_at=?',(int(time.time())-1,))
    assert client.get('/api/auth/me').status_code==401
    client.cookies.clear();client.cookies.set(COOKIE,'a'*43)
    assert client.get('/api/workshops').status_code==401

@pytest.mark.parametrize('patch',[{'email':'bad@'},{'password':'123'},{'password':' '*12},{'name':' '},{'password':'x'*129}])
def test_registration_validation(client,patch):
    assert client.post('/api/auth/register',json={'name':'Test','email':'a@example.com','password':PASSWORD,**patch}).status_code==422
    with connection() as db:assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0]==0

def test_csrf_origin_and_form_protection(client):
    assert client.post('/api/auth/register',json={'name':'Test','email':'a@example.com','password':PASSWORD},headers={'Origin':'https://evil.example'}).status_code==403
    client.headers.pop('X-FasonCep-Request')
    assert client.post('/api/auth/login',data={'email':'a@example.com','password':PASSWORD}).status_code==403
    assert client.post('/api/auth/register',json={'name':'Test','email':'a@example.com','password':PASSWORD},headers={'Origin':'http://testserver'}).status_code==201

def test_login_rate_limit(client):
    for _ in range(10):assert client.post('/api/auth/login',json={'email':'a@example.com','password':'wrong'}).status_code==401
    assert client.post('/api/auth/login',json={'email':'a@example.com','password':'wrong'}).status_code==429

def test_https_cookie(tmp_path,monkeypatch):
    monkeypatch.setenv('FASONCEP_DATA_DIR',str(tmp_path))
    with TestClient(app,base_url='https://testserver') as c:
        assert 'secure' in register(c).headers['set-cookie'].lower()
        assert c.get('/api/auth/me').status_code==200


def test_validation_response_does_not_echo_password(client):
    password='secret'
    response=register(client,password=password)
    assert response.status_code==422
    assert password not in response.text


def test_anonymous_cannot_access_mutating_or_export_routes(client):
    payload={'name':'Atölye','work_types':['Dikim']}
    assert client.post('/api/workshops',json=payload).status_code==401
    assert client.get('/api/workshops/1/operations').status_code==401
    assert client.get('/api/workshops/1/export.xlsx').status_code==401
    assert client.post('/api/workshops/1/operations/customers',json={'name':'Firma'}).status_code==401
    assert client.put('/api/workshops/1',json=payload).status_code==401
    assert client.delete('/api/workshops/1/operations/customers/id').status_code==401
