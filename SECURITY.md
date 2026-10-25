# Güvenlik

## Uygulanan kontroller

- Argon2id parola hash'i: 64 MiB bellek, 3 tur, otomatik rastgele salt.
- Rastgele oturum anahtarı, sunucuda SHA-256 doğrulayıcısı; 12 saat süre ve çıkışta iptal.
- HttpOnly, SameSite=Strict; üretimde Secure çerez. Kimlik bilgileri localStorage'a yazılmaz.
- Başarısız/yoğun giriş denemelerini sınırlama, genel giriş hata mesajı ve doğrulama yanıtlarında parola yansıtmama.
- Atölye sahipliğinin tüm iş/Excel uç noktalarında denetlenmesi.
- Origin/JSON istek kontrolleri, izin verilen Host'lar, parametreli SQL ve işlem içinde iş kuralı doğrulamaları.
- Excel'de kullanıcı metninin formül olarak çalıştırılmaması.
- Üretimde kapalı OpenAPI; örnek/doldurulmuş veri ve varsayılan kullanıcı bulunmaması.

İlk kaydolan kullanıcı sahipsiz eski verileri otomatik devralmaz. Bakımdan kalan sahipsiz kayıtlar varsa yetkili işletmeci açık bir veri taşıma işlemi planlamalıdır.

## Sınırlar

SQLite ve alınan yedekler dosya düzeyinde uygulama tarafından şifrelenmez. Sunucu, volume ve yedek erişimini sınırlamak; HTTPS'i, disk/yedek korumasını ve güncellemeleri işletmek dağıtımın parçasıdır.

E-posta sahipliği doğrulaması, e-posta ile parola kurtarma, MFA ve ekip rolleri henüz yoktur. Kayıt formundaki e-posta, doğrulanmış adres anlamına gelmez. Genel güvenlik/penetrasyon veya kapasite denetimi yapıldığı iddia edilmez. Gerçek kullanıcıya açılmadan önce yayın kontrol listesindeki eksikleri değerlendirin.

## Sır ve veri yönetimi

Veritabanı, yedek, çerez, gerçek `.env`, özel anahtar ve müşteri verisi Git'e eklenmez. Örnek yapılandırmalar gerçek sır içermez. Yanlışlıkla yayımlanan bir sırrı dosyadan silmek yeterli değildir: iptal/değiştirme ve Git geçmişi temizliği gerekir.

## Açık bildirme

Gerçek kullanıcı verisini veya kullanılabilir oturum anahtarını herkese açık GitHub issue'suna koymayın. Depo oluşturulduktan sonra GitHub private vulnerability reporting etkinleştirilmesi önerilir. Henüz bu depoya ait tanımlanmış bir güvenlik e-posta adresi yoktur; uydurma iletişim adresi kullanılmamıştır.
