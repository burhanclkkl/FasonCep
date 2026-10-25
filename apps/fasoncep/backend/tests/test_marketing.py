import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import connection
from app.demo_requests import cleanup_requests

@pytest.fixture
def client(monkeypatch,tmp_path):
    monkeypatch.setenv('FASONCEP_SITE_MODE','marketing')
    monkeypatch.setenv('FASONCEP_DATA_DIR',str(tmp_path))
    monkeypatch.setenv('FASONCEP_DEMO_REQUESTS_ENABLED','1')
    monkeypatch.setenv('FASONCEP_OPERATOR_NAME','Test Sorumlusu')
    monkeypatch.setenv('FASONCEP_CONTACT_EMAIL','contact@example.test')
    with TestClient(app,headers={'X-FasonCep-Request':'1'}) as client:
        yield client

PAYLOAD={'name':'Örnek Kullanıcı','workshop_name':'Örnek Atölye','email':'demo@example.test'}

@pytest.mark.parametrize('path,method', [('/api/auth/register','POST'),('/api/auth/login','POST'),('/api/auth/me','GET'),('/api/workshops','GET'),('/api/workshops','POST'),('/api/workshops/1','PUT'),('/api/customers','POST'),('/api/orders','GET'),('/api/export','GET')])
def test_application_is_closed_at_server(client,path,method):
    response=client.request(method,path,json=PAYLOAD)
    assert response.status_code==404
    assert response.headers['X-Robots-Tag']=='noindex, nofollow'
    with connection() as db:
        assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM workshops').fetchone()[0]==0


def test_request_is_persisted_without_account_or_session(client):
    response=client.post('/api/demo-requests',json=PAYLOAD)
    assert response.status_code==202
    assert 'mail' not in response.json()['message']
    assert 'set-cookie' not in response.headers
    with connection() as db:
        lead=dict(db.execute('SELECT * FROM demo_requests').fetchone())
        assert lead['email']==PAYLOAD['email'] and lead['notice_version']=='demo-v1'
        assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0]==0
        assert db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]==0
    assert client.get('/api/demo-requests').status_code==405


def test_duplicate_and_honeypot_do_not_add_rows(client):
    for data in [PAYLOAD,{**PAYLOAD,'email':'DEMO@EXAMPLE.TEST'},{**PAYLOAD,'email':'bot@example.test','website':'spam'}]:
        assert client.post('/api/demo-requests',json=data).status_code==202
    with connection() as db:
        assert db.execute('SELECT COUNT(*) FROM demo_requests').fetchone()[0]==1


@pytest.mark.parametrize('changes',[{'name':'  '},{'workshop_name':'x'},{'email':'bad'},{'name':'x'*81},{'email':'a\nb@example.test'},{'password':'no passwords accepted'}])
def test_validation(client,changes):
    assert client.post('/api/demo-requests',json={**PAYLOAD,**changes}).status_code==422
    with connection() as db:
        assert db.execute('SELECT COUNT(*) FROM demo_requests').fetchone()[0]==0


@pytest.mark.parametrize('setting,value',[('FASONCEP_CONTACT_EMAIL',''),('FASONCEP_OPERATOR_NAME',''),('FASONCEP_DEMO_REQUESTS_ENABLED','0')])
def test_form_fails_closed_until_configured(client,monkeypatch,setting,value):
    monkeypatch.setenv(setting,value)
    assert client.get('/api/public-config').json()['accepting_requests'] is False
    assert client.post('/api/demo-requests',json=PAYLOAD).status_code==503


def test_abuse_limit_and_cross_origin(client):
    assert client.post('/api/demo-requests',json=PAYLOAD,headers={'Origin':'https://evil.example'}).status_code==403
    for _ in range(5):assert client.post('/api/demo-requests',json=PAYLOAD).status_code==202
    assert client.post('/api/demo-requests',json=PAYLOAD).status_code==429


def test_old_requests_are_removed(client):
    client.post('/api/demo-requests',json=PAYLOAD)
    with connection() as db:
        db.execute("UPDATE demo_requests SET created_at=datetime('now','-91 days')")
    cleanup_requests()
    with connection() as db:
        assert db.execute('SELECT COUNT(*) FROM demo_requests').fetchone()[0]==0
