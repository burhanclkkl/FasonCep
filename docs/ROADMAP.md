# Yol haritası

## MVP — uygulandı

- [x] E-posta/şifre ile kayıt, Argon2id ve çerez oturumu
- [x] Hesaba ait birden fazla atölye ve API sahiplik kontrolü
- [x] Kalıcı müşteri, sipariş, üretim, teslimat ve tahsilat işlemleri
- [x] Sipariş fotoğrafı, notlar ve renk/beden dağılımı
- [x] Teslim takvimi, gecikmeler ve durum etiketleri
- [x] Mobil sipariş kartları, sayfalama ve hızlı işlemler
- [x] Biçimlendirilmiş Excel raporu
- [x] Landing page ve giriş/kayıt sayfaları

## GitHub/yayın hazırlığı — bu aşama

- [x] Demo/sıfırlama araçlarını ve eski tek-atölye API'sini kaldırma
- [x] Yeni hesapların eski sahipsiz verileri otomatik devralmasını kaldırma
- [x] Sır/veri/önbellek dışlamaları ve depo kontrolü
- [x] Docker, Caddy HTTPS, kalıcı veri alanı ve üretim kontrolleri
- [x] CI, kurulum, mimari, güvenlik ve işletim belgeleri
- [ ] Gerçek Docker imajının CI/sunucuda başarıyla derlenmesi
- [ ] Alan adı üzerinde HTTPS, cookie, erişim ve mobil görsel doğrulama
- [ ] Sunucu dışı yedekleme ve geri yükleme provası

## Sonraki görüşmede planlanacak — henüz uygulanmadı

Amaç: web sitesindeki “Hesap oluştur” akışından sonra işletmeciye otomatik bilgi gelmesi.

Karar verilecekler:

- Doğrudan hesap açılması mı, önce başvuru/demo talebi mi?
- Yönetici bilgilendirme e-postası mı, kullanıcı e-posta doğrulaması da mı?
- Onay bekleyen hesap gerekli mi, hangi bilgiler istenecek?
- SMTP/işlemsel mail sağlayıcısı, sırlar, gönderim hatası ve tekrar deneme akışı.
- Spam sınırları ve izin/aydınlatma metinlerinin hazırlanması.

Bu kararlar mevcut kayıt akışını kendiliğinden değiştirmez. Bu sürüm hiçbir e-posta göndermez.

## İhtiyaç doğrulanırsa

- Parola kurtarma ve e-posta doğrulama
- Kolay uygulama içi yedekleme/geri yükleme
- Yazdırılabilir teslimat fişi ve hesap özeti
- Arşivleme/iptal ve işlem geçmişi

Stok, bordro, QR ve karmaşık ERP modülleri MVP hedefi değildir.
