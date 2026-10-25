# FasonCep

Fason atölyeleri için sade bir dijital iş defteri: müşteriler, siparişler, üretim, kısmi teslimatlar ve tahsilatlar tek çalışma alanında.

İlk yayın varsayılan olarak **tanıtım modundadır**: landing, kayıt oluşturmayan örnek demo ve gönderimi kapalı demo talep formu. Gerçek uygulama API’leri erişime kapalıdır. Yapılandırma ve kapsam: [docs/PUBLIC-LAUNCH.md](docs/PUBLIC-LAUNCH.md).

## Mevcut özellikler

- E-posta/şifre kaydı, Argon2id hash ve çerez tabanlı oturum.
- Her hesaba ait ayrı atölyeler ve veriler; kullanıcılar arası erişim kontrolü.
- Kalıcı müşteri, sipariş, üretim, teslimat ve tahsilat ekleme/düzenleme/silme.
- Fotoğraf, not ve renk/beden dağılımıyla sipariş detayı.
- Teslim takvimi, gecikme uyarıları, sayfalama ve mobil sipariş kartları.
- Seçili atölyenin tüm kayıtları için biçimlendirilmiş Excel raporu.
- Tanıtım, giriş ve kayıt sayfaları.

## Başlangıç

Node.js 24 ve Python 3.12 önerilir. İlk kurulum:

```bash
cd apps/fasoncep/backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

Yeni terminalde:

```bash
cd apps/fasoncep/frontend
npm ci
npm run dev
```

Adres: http://127.0.0.1:5173. Tek komut API'yi de başlatır; `Ctrl+C` komutun başlattığı süreçleri kapatır. Windows ve iki terminal seçenekleri: [Kurulum](docs/QUICKSTART.md).

İlk açılış boş başlar. Hazır kullanıcı, şifre, müşteri veya demo veri yoktur. Her yeni hesap yalnızca kendi oluşturduğu atölyeleri görür. E-posta doğrulama/sıfırlama ve otomatik yönetici bildirimi henüz uygulanmadı.

## Dokümantasyon

| Belge | İçerik |
| --- | --- |
| [Hızlı başlangıç](docs/QUICKSTART.md) | Kurulum, geliştirme ve temel sorun giderme |
| [Mimari](docs/ARCHITECTURE.md) | Veri modeli, iş kuralları, oturum ve API yapısı |
| [Dağıtım](docs/DEPLOYMENT.md) | Docker, alan adı, HTTPS ve kalıcı veri alanı |
| [İşletim](docs/OPERATIONS.md) | Yedekleme, geri yükleme, güncelleme ve günlükler |
| [Güvenlik](SECURITY.md) | Güvenlik sınırları ve açık kalan konular |
| [Katkı ve kontroller](CONTRIBUTING.md) | Testler, bağımlılıklar ve geliştirme kuralları |
| [Yayın kontrol listesi](docs/RELEASE_CHECKLIST.md) | Tamamlanan doğrulamalar ve yayın öncesi kalan işler |
| [Yol haritası](docs/ROADMAP.md) | MVP kapsamı ve sonraki kararlar |

## Depo düzeni

```text
apps/fasoncep/backend/   FastAPI + SQLite, testler ve Excel şablonu
apps/fasoncep/frontend/  React + TypeScript + Vite, arayüz testleri
deploy/                Caddy HTTPS yapılandırması
docs/                  Başvuru belgeleri
scripts/               Depo kontrolü
.github/workflows/     CI
```

`app/assets/export-template.xlsx` uygulamanın gerekli Excel şablonudur; silinmemelidir. Veritabanı, yedek, oturum, `.env`, bağımlılık dizinleri ve derleme çıktıları repoya eklenmez.

## Kontroller

```bash
python3 scripts/check_repository.py
```

```bash
cd apps/fasoncep/backend
.venv/bin/python -m pytest -q
```

```bash
cd apps/fasoncep/frontend
npm test
npm run build
```

## Canlı kullanım durumu

Depo, boş veriyle GitHub'a aktarılacak şekilde hazırlanmıştır. Docker/HTTPS yapılandırması sağlanmıştır; bu durum gerçek alan adı üzerinde dağıtım yapıldığı veya operasyonel güvenliğin tamamen doğrulandığı anlamına gelmez. Yayından önce [kontrol listesini](docs/RELEASE_CHECKLIST.md) tamamlayın. GitHub'a yükleme ve canlıya dağıtım bu çalışma kapsamında yapılmadı.

SEO, canonical/sitemap ayarları ve yayın sonrası doğrulama: [docs/SEO.md](docs/SEO.md).
