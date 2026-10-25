import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
import pytest
from app.settings import allowed_hosts,secure_cookies


def test_production_settings_fail_closed(monkeypatch,tmp_path):
    monkeypatch.setenv('FASONCEP_ENV','production')
    monkeypatch.delenv('FASONCEP_ALLOWED_HOSTS',raising=False)
    with pytest.raises(RuntimeError):allowed_hosts()
    monkeypatch.setenv('FASONCEP_ALLOWED_HOSTS','*')
    with pytest.raises(RuntimeError):allowed_hosts()
    monkeypatch.setenv('FASONCEP_ALLOWED_HOSTS','app.example.com')
    monkeypatch.setenv('FASONCEP_DATA_DIR','relative')
    with pytest.raises(RuntimeError):allowed_hosts()
    monkeypatch.setenv('FASONCEP_DATA_DIR',str(tmp_path))
    assert allowed_hosts()==['app.example.com']
    assert secure_cookies(SimpleNamespace(url=SimpleNamespace(scheme='http')))


def test_production_boot_static_routes_and_security(tmp_path):
    frontend=tmp_path/'frontend';(frontend/'assets').mkdir(parents=True)
    (frontend/'index.html').write_text('<html>FasonCep release smoke test</html>')
    (frontend/'assets'/'test.css').write_text('body{color:navy}')
    env={**os.environ,'FASONCEP_ENV':'production','FASONCEP_ALLOWED_HOSTS':'app.example.test,127.0.0.1',
         'FASONCEP_PUBLIC_URL':'https://app.example.test','FASONCEP_DATA_DIR':str(tmp_path/'data'),'FASONCEP_FRONTEND_DIR':str(frontend)}
    code='''
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app,base_url='https://app.example.test') as c:
 for path in ['/','/giris','/kayit','/uygulama']:
  r=c.get(path); assert r.status_code==200 and 'FasonCep release smoke test' in r.text
 assert c.get('/assets/test.css').status_code==200
 assert c.get('/api/openapi.json').status_code==404
 assert c.get('/api/not-found').status_code==404
 assert c.get('/api/health').json()['mode']=='production'
 assert c.get('/api/health').headers['X-Robots-Tag']=='noindex, nofollow'
 assert c.get('/giris').headers['X-Robots-Tag']=='noindex, nofollow'
 assert 'https://app.example.test/sitemap.xml' in c.get('/robots.txt').text
 assert '<loc>https://app.example.test/</loc>' in c.get('/sitemap.xml').text
 assert c.get('/unknown-page').status_code==404
 assert c.get('/api/workshops').status_code==401
 assert c.get('/api/health',headers={'Host':'evil.example'}).status_code==400
'''
    result=subprocess.run([sys.executable,'-c',code],env=env,capture_output=True,text=True)
    assert result.returncode==0,result.stderr
