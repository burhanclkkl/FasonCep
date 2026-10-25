"""Public marketing metadata. Never derive canonical URLs from an untrusted Host header."""
import html
import json
import os
import re
from urllib.parse import urlsplit
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, Response, FileResponse
from .settings import is_production, frontend_directory

TITLE = 'Fason Atölye Takip Programı | FasonCep'
DESCRIPTION = 'FasonCep ile fason atölyenin sipariş, üretim, teslimat ve müşteri alacaklarını tek yerden takip et. Teslim takvimi, renk/beden dağılımı ve Excel raporları.'
router = APIRouter()


def public_url():
    raw = os.getenv('FASONCEP_PUBLIC_URL', '').strip().rstrip('/')
    if not raw:
        return None
    parsed = urlsplit(raw)
    hosts = [h.strip() for h in os.getenv('FASONCEP_ALLOWED_HOSTS', '').split(',')]
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password
            or parsed.path or parsed.query or parsed.fragment or parsed.netloc not in hosts):
        raise RuntimeError('FASONCEP_PUBLIC_URL izin verilen alan adıyla, yol içermeyen bir HTTPS adresi olmalı.')
    return raw


def indexable():
    return is_production() and public_url() is not None


def public_head():
    origin = public_url()
    if not origin:
        return ''
    url = origin + '/'
    graph = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Organization', '@id': origin+'/#organization', 'name': 'FasonCep', 'url': url,
         'logo': origin+'/favicon.svg'},
        {'@type': 'WebSite', '@id': origin+'/#website', 'name': 'FasonCep', 'url': url,
         'inLanguage': 'tr-TR', 'publisher': {'@id': origin+'/#organization'}},
        {'@type': 'WebPage', '@id': origin+'/#webpage', 'url': url, 'name': TITLE,
         'description': DESCRIPTION, 'inLanguage': 'tr-TR', 'isPartOf': {'@id': origin+'/#website'},
         'about': {'@id': origin+'/#software'}},
        {'@type': 'SoftwareApplication', '@id': origin+'/#software', 'name': 'FasonCep',
         'url': url, 'applicationCategory': 'BusinessApplication', 'operatingSystem': 'Web',
         'inLanguage': 'tr-TR', 'description': DESCRIPTION,
         'featureList': ['Sipariş takibi', 'Üretim ve kısmi teslimat takibi', 'Teslim takvimi',
                         'Müşteri alacak ve tahsilat takibi', 'Birden fazla atölye', 'Excel raporları'],
         'publisher': {'@id': origin+'/#organization'}}]}
    escape = lambda value: html.escape(value, quote=True)
    tags = [f'<link data-public-seo rel="canonical" href="{escape(url)}">']
    for key, value in {'og:type':'website', 'og:locale':'tr_TR', 'og:site_name':'FasonCep',
                       'og:title':TITLE, 'og:description':DESCRIPTION, 'og:url':url,
                       'og:image':origin+'/social-card.png', 'og:image:width':'1200',
                       'og:image:height':'630', 'og:image:alt':'FasonCep — sipariş, üretim, teslimat ve alacak takibi',
                       'twitter:card':'summary_large_image', 'twitter:title':TITLE,
                       'twitter:description':DESCRIPTION, 'twitter:image':origin+'/social-card.png',
                       'twitter:image:alt':'FasonCep — atölyenin dijital iş defteri'}.items():
        attr = 'property' if key.startswith('og:') else 'name'
        tags.append(f'<meta data-public-seo {attr}="{key}" content="{escape(value)}">')
    data = json.dumps(graph, ensure_ascii=False).replace('<', '\\u003c')
    tags.append(f'<script data-public-seo type="application/ld+json">{data}</script>')
    return '\n'.join(tags)


def render_page(path):
    markup = (frontend_directory()/'index.html').read_text(encoding='utf-8')
    markup = re.sub(r'<meta name="robots"[^>]*>', '', markup)
    from .demo_requests import public_config
    config = public_config()
    config_json = json.dumps(config, ensure_ascii=False).replace("<", "\\u003c")
    markup = markup.replace("</head>", f'<script id="public-config" type="application/json">{config_json}</script></head>')
    if config["mode"] == "application":
        markup = re.sub(r'<!-- LANDING_START -->.*?<!-- LANDING_END -->', '', markup, flags=re.S)
    home = path == '/'
    policy = 'index, follow, max-image-preview:large' if indexable() else 'noindex, nofollow'
    metadata = f'<meta name="robots" data-public-policy="{policy}" content="{policy if home else "noindex, nofollow"}">'
    if home:
        metadata += public_head()
    else:
        markup = re.sub(r'<!-- LANDING_START -->.*?<!-- LANDING_END -->', '', markup, flags=re.S)
        title = {'/giris':'Giriş yap · FasonCep', '/kayit':'Hesap oluştur · FasonCep', '/uygulama':'Çalışma alanı · FasonCep', '/demo':'Örnek demo · FasonCep', '/demo-talebi':'Demo talebi · FasonCep', '/aydinlatma':'Aydınlatma · FasonCep'}[path]
        markup = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', markup, flags=re.S)
        description = 'FasonCep’i örnek verilerle incele ve demo talebi hakkında bilgi al.' if path in ('/demo','/demo-talebi','/aydinlatma') else 'FasonCep hesabını yönet.'
        markup = re.sub(r'<meta name="description"[^>]*>', f'<meta name="description" content="{description}">', markup)
    markup = markup.replace('</head>', metadata+'\n</head>')
    return HTMLResponse(markup, headers={'Cache-Control':'no-cache', **({} if home and indexable() else {'X-Robots-Tag':'noindex, nofollow'})})


@router.get('/robots.txt', include_in_schema=False)
def robots():
    # Keep auth routes crawlable so crawlers can see their noindex directive.
    text = 'User-agent: *\nAllow: /\nDisallow: /api/\n' if indexable() else 'User-agent: *\nDisallow: /\n'
    if indexable():
        text += f'\nSitemap: {public_url()}/sitemap.xml\n'
    return PlainTextResponse(text, headers={'Cache-Control':'public, max-age=3600'})


@router.get('/sitemap.xml', include_in_schema=False)
def sitemap():
    entry = f'<url><loc>{html.escape(public_url()+"/")}</loc></url>' if indexable() else ''
    return Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entry+'</urlset>',
                    media_type='application/xml', headers={'Cache-Control':'public, max-age=3600'})


@router.get('/favicon.svg', include_in_schema=False)
@router.get('/social-card.png', include_in_schema=False)
def public_asset(request: Request):
    path = frontend_directory()/request.url.path.lstrip('/')
    if not path.is_file():
        return Response(status_code=404)
    return FileResponse(path, headers={'Cache-Control':'public, max-age=86400'})
