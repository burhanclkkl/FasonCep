"""Check the built release with isolated data; never touch a developer's database."""
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
frontend = root/'apps/fasoncep/frontend/dist'
if not (frontend/'index.html').is_file():
    raise SystemExit('Önce frontend dizininde npm run build çalıştırın.')
sys.path.insert(0, str(root/'apps/fasoncep/backend'))

with tempfile.TemporaryDirectory(prefix='fasoncep-seo-') as temporary:
    os.environ.update(FASONCEP_ENV='production', FASONCEP_DATA_DIR=temporary,
                      FASONCEP_FRONTEND_DIR=str(frontend),
                      FASONCEP_PUBLIC_URL='https://fason.example',
                      FASONCEP_ALLOWED_HOSTS='fason.example')
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app, base_url='https://fason.example') as client:
        response = client.get('/?utm_source=check')
        assert response.status_code == 200
        page = response.text
        assert page.count('<h1>') == 1
        assert 'FasonCep, fason ve dikim atölyeleri' in page
        assert 'sorular' in page and 'Excel' in page
        assert page.count('name="robots"') == 1
        assert 'content="index, follow, max-image-preview:large"' in page
        assert 'rel="canonical" href="https://fason.example/"' in page
        schema = json.loads(re.search(r'type="application/ld\+json">(.*?)</script>', page).group(1))
        assert len(schema['@graph']) == 4
        for path in ['/giris', '/kayit', '/uygulama']:
            private = client.get(path)
            assert private.status_code == 200
            assert private.headers['X-Robots-Tag'] == 'noindex, nofollow'
            assert 'FasonCep, fason ve dikim atölyeleri' not in private.text
            assert 'application/ld+json' not in private.text
        assert client.get('/api/workshops').status_code == 401
        assert client.get('/api/workshops').headers['X-Robots-Tag'] == 'noindex, nofollow'
        assert client.get('/olmayan-sayfa').status_code == 404
        assert 'Sitemap: https://fason.example/sitemap.xml' in client.get('/robots.txt').text
        sitemap = ET.fromstring(client.get('/sitemap.xml').content)
        assert [node.text for node in sitemap.findall('.//{*}loc')] == ['https://fason.example/']
        png = client.get('/social-card.png')
        assert png.status_code == 200 and png.content.startswith(b'\x89PNG\r\n\x1a\n')
        assert int.from_bytes(png.content[16:20], 'big') == 1200
        assert int.from_bytes(png.content[20:24], 'big') == 630
        assert client.get('/favicon.svg').status_code == 200
print('Üretim HTML, SEO, sitemap, paylaşım görseli ve özel sayfa kontrolleri başarılı.')
