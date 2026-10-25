"""Durable SMTP notifications; only the operator receives demo request emails."""
import logging
import os
import re
import smtplib
import ssl
import time
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formatdate
from .database import connection

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MailSettings:
    host: str
    port: int
    security: str
    username: str
    password: str = field(repr=False)
    sender: str
    recipient: str


def settings():
    if os.getenv('FASONCEP_MAIL_ENABLED', '0') != '1':
        return None
    get = lambda name: os.getenv('FASONCEP_'+name, '').strip()
    host, security = get('SMTP_HOST'), get('SMTP_SECURITY') or 'starttls'
    sender, recipient = get('MAIL_FROM'), get('MAIL_TO')
    valid_email = lambda value: re.fullmatch(r'[^\s@\x00-\x1f\x7f]+@[^\s@.\x00-\x1f\x7f]+(?:\.[^\s@.\x00-\x1f\x7f]+)+', value)
    try:
        port = int(get('SMTP_PORT') or ('465' if security == 'ssl' else '587'))
    except ValueError:
        raise RuntimeError('SMTP portu geçersiz.') from None
    username, password = get('SMTP_USERNAME'), os.getenv('FASONCEP_SMTP_PASSWORD', '')
    if (not host or any(char.isspace() or ord(char)<32 or ord(char)==127 for char in host) or security not in ('starttls','ssl')
            or not 1 <= port <= 65535 or not valid_email(sender) or not valid_email(recipient)
            or bool(username) != bool(password)):
        raise RuntimeError('E-posta ayarları eksik/geçersiz. SMTP, gönderici ve alıcı ayarlarını kontrol edin.')
    return MailSettings(host,port,security,username,password,sender,recipient)


def initialize_outbox(db):
    db.execute('''CREATE TABLE IF NOT EXISTS demo_mail_outbox (
        request_id INTEGER PRIMARY KEY REFERENCES demo_requests(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL UNIQUE, attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt INTEGER NOT NULL DEFAULT 0, sent_at INTEGER,
        last_error TEXT)''')


def send_notification(config, lead):
    message = EmailMessage()
    message['Subject'] = 'FasonCep — Yeni demo talebi'
    message['From'] = config.sender
    message['To'] = config.recipient
    message['Reply-To'] = lead['email']
    message['Message-ID'] = lead['message_id']
    message['Date'] = formatdate(localtime=False, usegmt=True)
    message.set_content(f"Yeni demo talebi\n\nBaşvuru no: {lead['id']}\nAd soyad: {lead['name']}\nAtölye: {lead['workshop_name']}\nE-posta: {lead['email']}\nKayıt zamanı (UTC): {lead['created_at']}\n\nBu başvuru kullanıcı hesabı oluşturmaz.")
    context = ssl.create_default_context()
    if config.security == 'ssl':
        client = smtplib.SMTP_SSL(config.host,config.port,timeout=10,context=context)
    else:
        client = smtplib.SMTP(config.host,config.port,timeout=10)
    try:
        with client:
            client.ehlo()
            if config.security == 'starttls':
                client.starttls(context=context)
                client.ehlo()
            if config.username:
                client.login(config.username,config.password)
            if client.send_message(message,from_addr=config.sender,to_addrs=[config.recipient]):
                raise smtplib.SMTPException('Recipient refused')
    except Exception:
        # Even a QUIT/disconnect error can leave delivery uncertain; retry semantics apply.
        raise


def deliver_one(now=None):
    config = settings()
    if config is None:
        return False
    now = int(time.time()) if now is None else now
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        lead = db.execute('''SELECT r.*,q.message_id,q.attempts FROM demo_mail_outbox q
            JOIN demo_requests r ON r.id=q.request_id
            WHERE q.sent_at IS NULL AND q.next_attempt<=?
            AND r.created_at >= datetime('now','-90 days')
            ORDER BY q.next_attempt,q.request_id LIMIT 1''',(now,)).fetchone()
        if lead is None:
            return False
        # Lease exceeds the bounded SMTP operation; a crash becomes retryable after five minutes.
        db.execute('UPDATE demo_mail_outbox SET next_attempt=?,attempts=attempts+1 WHERE request_id=?',(now+300,lead['id']))
    try:
        send_notification(config,dict(lead))
    except Exception as error:
        # Do not persist/log SMTP messages: providers may include credentials or personal data.
        category = type(error).__name__
        delay = min(21600,60 * 2 ** min(lead['attempts'],9))
        with connection() as db:
            db.execute('UPDATE demo_mail_outbox SET next_attempt=?,last_error=? WHERE request_id=? AND message_id=? AND attempts=? AND sent_at IS NULL',(now+delay,category,lead['id'],lead['message_id'],lead['attempts']+1))
        logger.warning('Demo notification deferred (%s).',category)
    else:
        with connection() as db:
            db.execute('UPDATE demo_mail_outbox SET sent_at=?,last_error=NULL WHERE request_id=? AND message_id=? AND attempts=? AND sent_at IS NULL',(now,lead['id'],lead['message_id'],lead['attempts']+1))
    return True
