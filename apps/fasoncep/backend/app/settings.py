"""Deployment settings. Production fails closed when required values are missing."""
import os
from pathlib import Path


def is_production():
    value=os.getenv('FASONCEP_ENV','development')
    if value not in ('development','production'):
        raise RuntimeError('FASONCEP_ENV development veya production olmalı.')
    return value == 'production'


def allowed_hosts():
    raw=os.getenv('FASONCEP_ALLOWED_HOSTS','')
    if is_production():
        if not raw or '*' in raw:
            raise RuntimeError('Üretimde FASONCEP_ALLOWED_HOSTS açık alan adlarıyla belirtilmeli.')
        directory=os.getenv('FASONCEP_DATA_DIR','')
        if not directory or not Path(directory).is_absolute():
            raise RuntimeError('Üretimde FASONCEP_DATA_DIR kalıcı ve mutlak bir dizin olmalı.')
    return [host.strip() for host in raw.split(',') if host.strip()] or ['127.0.0.1','localhost','testserver']


def secure_cookies(request):
    return is_production() or request.url.scheme == 'https' or os.getenv('FASONCEP_SECURE_COOKIES') == '1'


def frontend_directory():
    return Path(os.getenv('FASONCEP_FRONTEND_DIR',str(Path(__file__).resolve().parents[2]/'frontend'/'dist')))


def site_mode():
    value = os.getenv('FASONCEP_SITE_MODE', 'marketing')
    if value not in ('marketing', 'application'):
        raise RuntimeError('FASONCEP_SITE_MODE marketing veya application olmalı.')
    return value
