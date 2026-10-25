import smtplib
import pytest
from starlette.requests import Request
from app.database import connection, initialize_db
from app.demo_requests import initialize_requests, request_demo, DemoRequest, cleanup_requests
from app import mail_notifications as mail

@pytest.fixture
def queue(monkeypatch,tmp_path):
    monkeypatch.setenv('FASONCEP_DATA_DIR',str(tmp_path))
    monkeypatch.setenv('FASONCEP_OPERATOR_NAME','Test Owner')
    monkeypatch.setenv('FASONCEP_CONTACT_EMAIL','contact@example.test')
    monkeypatch.setenv('FASONCEP_DEMO_REQUESTS_ENABLED','1')
    monkeypatch.setenv('FASONCEP_MAIL_ENABLED','0')
    for key,value in {'SMTP_HOST':'smtp.example.test','SMTP_PORT':'587','SMTP_SECURITY':'starttls','SMTP_USERNAME':'test-user','SMTP_PASSWORD':'test-secret','MAIL_FROM':'sender@example.test','MAIL_TO':'owner@example.test'}.items():
        monkeypatch.setenv('FASONCEP_'+key,value)
    initialize_db();initialize_requests()
    payload=DemoRequest(name='Test User',workshop_name='Test Workshop',email='lead@example.test')
    request=Request({'type':'http','client':('127.0.0.1',1234)})
    request_demo(payload,request)
    return payload,request


def state():
    with connection() as db:return dict(db.execute('SELECT * FROM demo_mail_outbox').fetchone())


def test_disabled_mail_stays_pending(queue,monkeypatch):
    monkeypatch.setattr(mail,'send_notification',lambda *_: pytest.fail('No network while disabled'))
    assert mail.deliver_one(now=100) is False
    assert state()['attempts']==0


def test_send_once_with_persistent_status_and_no_duplicate(queue,monkeypatch):
    calls=[]
    monkeypatch.setattr(mail,'send_notification',lambda config,lead:calls.append((config,lead)))
    monkeypatch.setenv('FASONCEP_MAIL_ENABLED','1')
    assert mail.deliver_one(now=100) is True
    assert state()['sent_at']==100
    assert mail.deliver_one(now=101) is False
    request_demo(*queue)
    with connection() as db:assert db.execute('SELECT COUNT(*) FROM demo_mail_outbox').fetchone()[0]==1
    assert len(calls)==1 and calls[0][0].recipient=='owner@example.test'
    assert calls[0][1]['email']=='lead@example.test'


def test_failed_send_is_retried_without_losing_lead_or_leaking_provider_error(queue,monkeypatch):
    calls=[]
    def send(config,lead):
        calls.append(lead['message_id'])
        if len(calls)==1:raise smtplib.SMTPAuthenticationError(535,b'SECRET provider data')
    monkeypatch.setattr(mail,'send_notification',send)
    monkeypatch.setenv('FASONCEP_MAIL_ENABLED','1')
    assert mail.deliver_one(now=100)
    assert state()['last_error']=='SMTPAuthenticationError'
    assert state()['sent_at'] is None
    with connection() as db:assert db.execute('SELECT COUNT(*) FROM demo_requests').fetchone()[0]==1
    assert mail.deliver_one(now=159) is False
    assert mail.deliver_one(now=160)
    assert state()['sent_at']==160 and state()['last_error'] is None
    assert calls[0]==calls[1]


def test_crashed_worker_lease_and_retention(queue,monkeypatch):
    monkeypatch.setenv('FASONCEP_MAIL_ENABLED','1')
    monkeypatch.setattr(mail,'send_notification',lambda *_: None)
    with connection() as db:db.execute('UPDATE demo_mail_outbox SET next_attempt=300')
    assert mail.deliver_one(now=299) is False
    assert mail.deliver_one(now=300)
    with connection() as db:db.execute("UPDATE demo_requests SET created_at=datetime('now','-91 days')")
    cleanup_requests()
    with connection() as db:assert db.execute('SELECT COUNT(*) FROM demo_mail_outbox').fetchone()[0]==0


@pytest.mark.parametrize('key,value',[('SMTP_SECURITY','none'),('MAIL_TO','invalid'),('MAIL_FROM','a@example.test\nBcc: x@example.test'),('SMTP_PORT','abc'),('SMTP_PORT','70000'),('SMTP_HOST',''),('SMTP_PASSWORD','')])
def test_enabled_invalid_settings_fail_closed(queue,monkeypatch,key,value):
    monkeypatch.setenv('FASONCEP_MAIL_ENABLED','1')
    monkeypatch.setenv('FASONCEP_'+key,value)
    with pytest.raises(RuntimeError):mail.settings()


@pytest.mark.parametrize('security',['starttls','ssl'])
def test_smtp_uses_tls_and_operator_recipient_only(queue,monkeypatch,security):
    monkeypatch.setenv('FASONCEP_MAIL_ENABLED','1')
    monkeypatch.setenv('FASONCEP_SMTP_SECURITY',security)
    calls=[]
    class SMTP:
        def __init__(self,*args,**kwargs):calls.append(('connect',kwargs))
        def __enter__(self):return self
        def __exit__(self,*args):return False
        def ehlo(self):calls.append(('ehlo',))
        def starttls(self,**kwargs):calls.append(('tls',kwargs))
        def login(self,*args):calls.append(('login',))
        def send_message(self,message,**kwargs):calls.append(('send',message,kwargs));return {}
    monkeypatch.setattr(mail.smtplib,'SMTP',SMTP)
    monkeypatch.setattr(mail.smtplib,'SMTP_SSL',SMTP)
    with connection() as db:
        lead=dict(db.execute('SELECT r.*,q.message_id FROM demo_requests r JOIN demo_mail_outbox q ON q.request_id=r.id').fetchone())
    mail.send_notification(mail.settings(),lead)
    sent=next(item for item in calls if item[0]=='send')
    assert sent[1]['To']=='owner@example.test'
    assert sent[1]['Reply-To']=='lead@example.test'
    assert sent[2]['to_addrs']==['owner@example.test']
    assert 'Test Workshop' in sent[1].get_content()
    if security=='starttls':assert [item[0] for item in calls]==['connect','ehlo','tls','ehlo','login','send']
    else:assert 'context' in calls[0][1]


@pytest.mark.parametrize('fails',[False,True])
def test_stale_delivery_cannot_change_replacement_request(queue,monkeypatch,fails):
    previous=state()
    def replace_during_delivery(config,lead):
        with connection() as db:
            db.execute('DELETE FROM demo_requests WHERE id=?',(lead['id'],))
            db.execute("INSERT INTO demo_requests(id,name,workshop_name,email,notice_version) VALUES (?,?,?,?,?)",(lead['id'],'New request','New workshop','new@example.test','demo-v1'))
            db.execute('INSERT INTO demo_mail_outbox(request_id,message_id) VALUES (?,?)',(lead['id'],'<replacement@example.test>'))
        if fails:raise OSError('interrupted')
    monkeypatch.setattr(mail,'send_notification',replace_during_delivery)
    monkeypatch.setenv('FASONCEP_MAIL_ENABLED','1')
    assert mail.deliver_one(now=100)
    current=state()
    assert current['request_id']==previous['request_id']
    assert current['message_id']=='<replacement@example.test>'
    assert current['sent_at'] is None and current['attempts']==0 and current['last_error'] is None
    assert current['next_attempt']==0


@pytest.mark.parametrize('key,value',[('MAIL_TO','user@exa\x00mple.test'),('SMTP_HOST','smtp.\x00example.test')])
def test_control_characters_in_smtp_settings_rejected(queue,monkeypatch,key,value):
    # Environment variables cannot contain NUL; use another control character to exercise validation.
    monkeypatch.setenv('FASONCEP_MAIL_ENABLED','1')
    monkeypatch.setenv('FASONCEP_'+key,value.replace('\x00','\x01'))
    with pytest.raises(RuntimeError):mail.settings()
