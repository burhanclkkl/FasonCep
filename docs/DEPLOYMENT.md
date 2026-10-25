# Canlı dağıtım

Bu dosya dağıtım tarifidir; gerçek sunucu, alan adı ve TLS doğrulaması yerine geçmez.

## Hazırlık

- Docker Engine ve Docker Compose eklentisi olan bir Linux sunucu.
- Sunucuya yönlendirilmiş gerçek bir alan adı; A ve varsa AAAA kayıtları doğru olmalı.
- İnternetten açık 80/TCP ve 443/TCP; HTTP/3 istenirse 443/UDP.
- Kalıcı disk, disk izleme ve sunucu dışı yedekleme planı.

Vite geliştirme sunucusunu canlıya açmayın. Üretim komutu `--reload` kullanmaz. Tek API örneği çalıştırılır.

## Kurulum

Sunucuda depo kökünde:

```bash
cp .env.production.example .env.production
```

Dosyadaki `DOMAIN` ve `ACME_EMAIL` değerlerini değiştirin. Alan adı şema, port veya yol içermez: `app.example.com` biçimindedir. Gerçek `.env.production` dosyası Git'e eklenmez.

```bash
docker compose --env-file .env.production config
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

Tarayıcıda `https://ALAN_ADINIZ` adresini açın. Caddy sertifika almayı ve yenilemeyi yönetir; bu işlem DNS ve ağ erişiminin doğru olmasına bağlıdır. [Caddy HTTPS davranışı](https://caddyserver.com/docs/automatic-https).

## Yapılandırma

| Değer | İşlev |
| --- | --- |
| `FASONCEP_ENV=production` | Üretim kontrolleri, Secure çerez ve şemanın kapatılması |
| `FASONCEP_DATA_DIR=/data` | Kalıcı SQLite alanı; üretimde mutlak yol zorunlu |
| `FASONCEP_ALLOWED_HOSTS` | Açık alan adları; üretimde boş/wildcard kabul edilmez |
| `FASONCEP_FRONTEND_DIR` | Derlenmiş arayüz dizini; Docker imajında ayarlıdır |
| `FASONCEP_SECURE_COOKIES=1` | HTTPS çerezi; üretimde ayrıca otomatik zorunludur |
| `FORWARDED_ALLOW_IPS` | Güvenilen ters proxy adresleri |

Compose içinde API'nin host portu yoktur; yalnızca Caddy'nin eriştiği özel ağdadır. Bu sınırlı ağda iletilen protokol başlıkları güvenilir kabul edilir. Bu yüzden `FORWARDED_ALLOW_IPS=*` yalnızca sağlanan izole yapı için uygundur; API portunu doğrudan yayınlamayın. Farklı topolojide yalnızca gerçek proxy adreslerini güvenilir yapın.

Caddy varsayılan olarak Host'u korur ve iletilen protokol bilgilerini kendisi ayarlar. Bu davranış, Origin ve güvenli çerez kontrolleri için önemlidir. [Proxy başlıkları](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults).

## Kalıcı veriler

`app_data` kullanıcıları, atölyeleri, oturumları ve iş kayıtlarını saklar. `caddy_data` TLS verisini tutar. Güncellemelerde volume'leri koruyun. `docker compose down -v` veri siler; rutin güncellemede kullanılmaz.

API container'ı root olmayan kullanıcıyla, salt okunur kök dosya sistemiyle çalışır; `/data` ve geçici `/tmp` yazılabilir. Docker build context'ine veritabanı, yedek veya `.env` dosyaları alınmaz.

## Doğrulama ve sınırlar

Yayın sonrası [kontrol listesini](RELEASE_CHECKLIST.md) tamamlayın. Docker olmayan bir makinede test/derleme başarılı olması Docker imajının veya gerçek HTTPS kurulumunun doğrulandığı anlamına gelmez.

Mevcut backend ağı internete çıkmaz. Gelecekte yönetici e-postası/SMTP eklenecekse kontrollü dış bağlantı ve sır yönetimi ayrıca planlanmalıdır; bu sürüm mail göndermez.

## Arama motorları

Compose ana adresi `DOMAIN` üzerinden `FASONCEP_PUBLIC_URL` olarak aktarır. Bu ayar yoksa site indeks dışı kalır. Canonical, sitemap, Search Console ve yayın sonrası kontroller: [SEO.md](SEO.md).
