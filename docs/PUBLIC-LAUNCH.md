# İlk yayın: tanıtım ve demo talebi

## Kapsam

Varsayılan `FASONCEP_SITE_MODE=marketing` modunda yalnızca landing, örnek demo, demo talep formu ve aydınlatma sayfası kullanılır. Hesap/şifre oluşturulmaz. Eski `/kayit` ve `/giris` adresleri `/demo-talebi` adresine; `/uygulama` ise `/demo` adresine yönlenir.

Backend, marketing modunda `/api/health`, `/api/public-config` ve `/api/demo-requests` dışındaki tüm `/api/` yollarını 404 ile kapatır. Oturum çerezi olsa bile gerçek atölye, müşteri, sipariş, tahsilat ve dışa aktarma uç noktaları erişilemez. Mevcut veriler silinmez. `application` modu eski uygulamayı ve kayıt API'sini tekrar açar; ilk halka açık yayında bu modu kullanmayın. Bu ayrım HTTP API sınırıdır; uygulama kaynak kodu aynı frontend paketinde bulunur.

`/demo`, yalnızca frontend içindeki açıkça örnek olarak etiketlenmiş sabit kayıtları gösterir. Sipariş, teslimat ve alacak sekmeleri ile sipariş detayı incelenebilir. Ekleme, düzenleme, silme veya API'den iş kaydı yükleme işlemi yoktur. DB'ye demo veri yazılmaz. Gerçek bilgiler demo alanına girilemez.

## E-posta henüz belli değilken

Form tasarımı ve örnek demo hazırdır; gönderim varsayılan olarak kapalıdır. Formda “Demo talepleri yakında açılacak” gösterilir. API de 503 döndürür ve başvuru saklamaz. Adres/unvan boşken form açılmaz.

```dotenv
FASONCEP_SITE_MODE=marketing
FASONCEP_DEMO_REQUESTS_ENABLED=0
FASONCEP_OPERATOR_NAME=
FASONCEP_CONTACT_EMAIL=
```

Compose bu değerleri backend'e aktarır; ayar değişiklikleri için app konteynerini yeniden oluşturun. Geliştirmede backend aynı ortam değişkenlerini okur. Frontend geliştirme modunda `/api/public-config` üzerinden ayarı alır; backend'e erişemiyorsa güvenli şekilde kapalı form ve tanıtım görünümünde kalır. Üretimde ayar, sunulan HTML'e gömülür.

## Başvuru kabulünü açmadan önce

1. Gerçek veri sorumlusu ad/unvanını ve iletişim adresini belirleyin.
2. Barındırma/yedek sağlayıcılarını, yurt dışına aktarım olup olmadığını, işleme hukuki sebebini ve başvuru yöntemini bir KVKK uzmanı/avukatla değerlendirin. `/aydinlatma` metni teknik taslaktır; mevcut hali bütün altyapılar için uygunluk garantisi değildir. Gerektiğinde gerçek sağlayıcılar ve aktarım mekanizmasıyla güncelleyin.
3. Yedeklerin saklama ve silme düzenini aynı veri minimizasyonu amacıyla belirleyin. Ana veritabanından silinen kayıtlar eski yedeklerde kalabilir; yedek saklama sınırını ayrıca uygulayın. Geri yükleme sonrasında eski başvurular başlangıç temizliğinde silinir.
4. Sonrasında iki kimlik alanını doldurup `FASONCEP_DEMO_REQUESTS_ENABLED=1` yapın.

## Başvurular nasıl çalışır?

Ad soyad (2–80), atölye adı (2–120) ve e-posta (en fazla 254 karakter) doğrulanır. Telefon, şifre, çalışan veya müşteri listesi istenmez. Gereksiz alanlar reddedilir. İstekler aynı origin denetiminden geçer; IP başına saatte en fazla 5 geçerli deneme kabul edilir. Bot tuzağı alanı ve aynı e-postanın 24 saat içinde tekrar kaydedilmesini engelleyen denetim bulunur.

Başvurular SQLite `demo_requests` tablosuna, `demo-v1` aydınlatma sürümü ve tarih ile yazılır. Bu kayıt açık rıza beyanı değildir. Ana veritabanındaki 90 günü aşan başvurular başlangıçta, yeni başvurularda ve uygulama çalışırken saatlik temizlenir. Genel API üzerinden başvuru listeleme veya indirme yoktur; yetkili işletmeci veritabanı üzerinden erişir.

Başarılı işlem mesajı: “Talebin alındı. Demo için seninle iletişime geçeceğiz.” E-posta gönderimi veya bildirim servisi bu aşamada bağlı değildir. İletişim e-postası yalnızca iletişim ve aydınlatma bilgisidir; bildirim alıcısı yapılandırması değildir. Başvuruların takibi için e-posta bildirimi veya yetkili yönetim ekranı sonraki ayrı adımdır.

## Doğrulama

- Backend: `.venv/bin/python -m pytest -q`
- Frontend: `npm test` ve `npm run build`
- Kök dizin: `apps/fasoncep/backend/.venv/bin/python scripts/check_public_site.py`

Kontroller geçici DB kullanır. Canlı sunucu/HTTPS ve KVKK incelemesi bu testlerle tamamlanmış sayılmaz.
