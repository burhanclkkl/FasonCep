import json
import re
import xml.etree.ElementTree as ET
import pytest
from app.seo import public_url, public_head, render_page, robots, sitemap


@pytest.fixture
def published(monkeypatch, tmp_path):
    monkeypatch.setenv('FASONCEP_ENV', 'production')
    monkeypatch.setenv('FASONCEP_SITE_MODE', 'marketing')
    monkeypatch.setenv('FASONCEP_ALLOWED_HOSTS', 'fason.example,127.0.0.1')
    monkeypatch.setenv('FASONCEP_PUBLIC_URL', 'https://fason.example')
    monkeypatch.setenv('FASONCEP_FRONTEND_DIR', str(tmp_path))
    (tmp_path/'index.html').write_text('<html><head><title>Public</title><meta name="description" content="Public"></head><body><div id="root"><!-- LANDING_START --><h1>Public landing</h1><!-- LANDING_END --></div></body></html>')


def test_public_metadata_and_schema(published):
    page=render_page('/').body.decode()
    assert 'https://fason.example/' in page
    assert 'rel="canonical"' in page
    assert 'index, follow, max-image-preview:large' in page
    assert '<h1>Public landing</h1>' in page
    data=json.loads(re.search(r'type="application/ld\+json">(.*?)</script>', page).group(1))
    assert {entry['@type'] for entry in data['@graph']} == {'Organization','WebSite','WebPage','SoftwareApplication'}
    assert all('offers' not in entry and 'aggregateRating' not in entry for entry in data['@graph'])
    assert 'og:image' in page and 'twitter:card' in page


@pytest.mark.parametrize('path', ['/giris','/kayit','/uygulama'])
def test_private_routes_have_no_public_content_or_metadata(published,path):
    response=render_page(path)
    page=response.body.decode()
    assert response.headers['X-Robots-Tag']=='noindex, nofollow'
    assert '<h1>Public landing</h1>' not in page
    assert 'application/ld+json' not in page and 'rel="canonical"' not in page
    assert 'content="noindex, nofollow"' in page


def test_sitemap_only_contains_public_home(published):
    xml=ET.fromstring(sitemap().body.decode())
    assert [node.text for node in xml.findall('.//{*}loc')]==['https://fason.example/']
    text=robots().body.decode()
    assert 'Sitemap: https://fason.example/sitemap.xml' in text
    assert 'Disallow: /api/' in text
    assert 'Disallow: /giris' not in text  # noindex must remain crawlable


def test_unconfigured_origin_never_publishes_fake_canonicals(published,monkeypatch):
    monkeypatch.delenv('FASONCEP_PUBLIC_URL')
    assert public_url() is None and public_head()==''
    assert 'noindex, nofollow' in render_page('/').body.decode()
    assert 'Disallow: /' in robots().body.decode()
    assert len(ET.fromstring(sitemap().body))==0


@pytest.mark.parametrize('value', ['http://fason.example','https://evil.example','https://fason.example/path', 'https://user@fason.example','https://fason.example?x=1','https://fason.example/#x'])
def test_canonical_origin_is_validated(published,monkeypatch,value):
    monkeypatch.setenv('FASONCEP_PUBLIC_URL',value)
    with pytest.raises(RuntimeError):public_url()


def test_development_is_noindex_even_with_configured_origin(published,monkeypatch):
    monkeypatch.setenv('FASONCEP_ENV','development')
    assert 'noindex, nofollow' in render_page('/').body.decode()
    assert 'Disallow: /' in robots().body.decode()
