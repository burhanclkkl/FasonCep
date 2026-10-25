# Yayın kontrol listesi

Bu liste kaynak hazırlığını gerçek canlı dağıtımdan ayırır.

## Kaynak hazırlığı

- [x] Gerçek kullanıcı, oturum, iş verisi ve eski yedekler kaynak dışına çıkarıldı/silindi.
- [x] Demo doldurma/sıfırlama komutları kaldırıldı; otomatik örnek veri yüklenmiyor.
- [x] İlk kaydolan kişinin eski sahipsiz atölyeleri devralması kaldırıldı.
- [x] `.gitignore`, `.dockerignore`, örnek çevre ayarları ve depo tarama betiği hazır.
- [x] Testler yalnızca geçici veritabanları kullanıyor.
- [x] Üretim kimlik/sahiplik, Secure cookie, Host ve Origin kontrolleri var.
- [x] Boş üretim açılışı, statik sayfalar ve anonim erişim engeli otomatik testte kontrol ediliyor.

## GitHub'a gönderirken

- [ ] `git status` ve staged diff incelendi; .env/DB/yedek/bağımlılık/derleme dosyaları yok.
- [ ] Depo görünürlüğü ve lisans tercihi belirlendi.
- [ ] GitHub Actions test ve Docker build adımları başarıyla tamamlandı.
- [ ] Gerekli branch/security ayarları depo sahibi tarafından yapıldı.

## Gerçek kullanıcıya açmadan önce

- [ ] Docker imajı hedef sunucuda derlendi ve non-root container sağlıklı.
- [ ] DNS/TLS/HTTP→HTTPS yönlendirmesi ve Secure oturum çerezi gerçek tarayıcıda doğrulandı.
- [ ] Kayıt → giriş → atölye → sipariş → üretim → teslimat → tahsilat → Excel akışı denendi.
- [ ] İkinci hesap birinci hesabın verilerine erişemiyor.
- [ ] Mobil/masaüstü görsel kontrol tamamlandı.
- [ ] Sunucu yeniden başlatıldığında veri korunuyor.
- [ ] Sunucu dışı yedek alındı; ayrı ortamda geri yükleme denendi.
- [ ] Disk izleme, güncelleme, hata takibi ve hesap kurtarma destek yöntemi belirlendi.
- [ ] İnternete açık kayıt akışı için spam ve e-posta doğrulama/onay ihtiyacı değerlendirildi.

## Doğrulama sınırı

Bu çalışma ortamında Docker CLI ve kullanılabilir izole tarayıcı yoktur. Docker yapılandırması hazırlanmış olsa da imaj, gerçek alan adı/TLS ve tarayıcı görsel kontrolleri tamamlanmış sayılmaz. Canlı sunucuya dağıtım veya GitHub push yapılmadı.

## Bu hazırlıktaki kontrol sonuçları — 25 Ekim 2026

- Backend: 68 test başarılı; son yedek/üretim testleri ayrıca tekrarlandı.
- Frontend: temiz `npm ci`, 22 test ve üretim derlemesi başarılı.
- Compose ve CI YAML sözdizimi kontrolü başarılı.
- `npm audit --omit=dev`: bu kontrolde bildirilen açık yok. Bu sonuç tüm sistem için güvenlik garantisi değildir.
- Kaynak dosyaları ve Markdown bağlantıları kontrol edildi; Git dışlamaları geçici bir depo ile doğrulandı.
- Son durumda geliştirme sunucuları kapalı; gerçek veri dizini, eski yedekler, dist ve önbellekler kaldırılmıştır.
- Kurulu `.venv` ve `node_modules` geliştirme için tutulur, Git ve Docker bağlamına alınmaz.
