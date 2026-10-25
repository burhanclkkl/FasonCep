# Mimari ve davranışlar

## Ürün sınırı

FasonCep, küçük fason atölyeleri için müşteri → sipariş → üretim → teslimat → tahsilat akışını izler. Stok, personel bordrosu, muhasebe entegrasyonu, e-fatura veya çok kiracılı kurumsal ERP kapsamda değildir.

## Bileşenler

- Frontend: React, TypeScript, Vite; tek sayfa uygulaması.
- Backend: FastAPI ve Pydantic doğrulamaları.
- Depolama: SQLite; tek uygulama örneği ve kalıcı disk.
- Üretim sunumu: FastAPI derlenmiş frontend'i ve `/api` uç noktalarını aynı adreste sunar. Caddy dış dünyada HTTPS sağlar.
- Excel: sürümlenen `.xlsx` şablonu ve standart Python kitaplığı. Office kurulumu gerekmez.

## Veri modeli

- `users`: normalleştirilmiş e-posta, ad, Argon2id parola hash'i.
- `sessions`: oturum anahtarının SHA-256 doğrulayıcısı, kullanıcı ve süre sonu.
- `auth_attempts`: giriş/kayıt hız sınırlaması.
- `workshops`: kullanıcıya ait atölyeler (`owner_id`).
- `customers`: atölyeye ait müşteri kayıtları.
- `orders`: müşteri, adet, birim fiyat, termin, not, fotoğraf ve renk/beden dağılımı.
- `production`, `deliveries`: siparişe bağlı tarihli adet hareketleri.
- `payments`: müşteri bazında tahsilatlar.

Tahsilatlar siparişe tahsis edilmez. Cari bakiye, müşterinin sipariş tutarları toplamı eksi tahsilatlar olarak hesaplanır; teslimat bazlı hakediş/muhasebe modeli değildir. Bu tanım ürün değişikliği yapılmadan değiştirilmemelidir.

## İş kuralları

- Para, veritabanında tam sayı kuruş olarak saklanır; arayüzde iki ondalık hane desteklenir.
- Toplam üretim sipariş adedini aşamaz.
- Teslimat, işlem tarihine kadar üretilmiş adedi aşamaz.
- Tahsilat müşteri bakiyesini aşamaz; avans/iade akışı henüz yoktur.
- Hareket görmüş siparişin müşterisi değiştirilemez.
- Silme ve düzenleme sonrası bağlı kayıtlar, adetler ve bakiyeler yeniden doğrulanır.
- Fotoğraf PNG/JPEG/WebP ve en fazla 2 MB; not en fazla 3000 karakterdir.
- Renk/beden dağılımı girilmişse toplamı sipariş adedine eşit olmalıdır.
- İstanbul tarihi kullanılır; tamamlanan işler bekleyen teslim takviminde görünmez.

Yazmalarda `BEGIN IMMEDIATE` ile okuma/doğrulama/yazma tek işlemde yapılır. Backend doğrulaması esas alınır; arayüz kontrolleri bunun yerini tutmaz.

## Erişim ve ekranlar

`/` tanıtım, `/giris` giriş, `/kayit` kayıt, `/uygulama` çalışma alanıdır. Arayüzde rota gizlemek tek başına erişim kontrolü değildir: tüm atölye, işlem ve Excel istekleri backend'de kullanıcı sahipliğiyle sınırlandırılır. Sahipsiz eski kayıtlar yeni hesaplara otomatik bağlanmaz.

API grupları: `/api/auth/*`, `/api/workshops`, `/api/workshops/{id}/operations/*`, `/api/workshops/{id}/export.xlsx`. Excel tüm atölye kayıtlarını kapsar; arayüz filtreleri ve sayfalama dışa aktarmayı daraltmaz. Geliştirmede şema `/api/openapi.json` adresindedir; üretimde kapalıdır.

## Şema ve sınırlar

Tablolar ilk açılışta oluşturulur; mevcut şemaya uyumlu eklemeler `initialize_db` içinde yapılır. Bu mekanizma genel bir migration sistemi değildir. Veri silen veya sütun anlamını değiştiren güncellemelerden önce ayrıca migration ve geri dönüş planı gerekir.

SQLite dosyasını ağ paylaşımında kullanmayın, API'yi birden fazla kopyaya ölçeklemeyin. Daha yüksek eşzamanlılık ihtiyacı ölçüldüğünde ayrı veritabanı/migration tasarımı değerlendirilmelidir.
