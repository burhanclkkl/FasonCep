# Demo talebi e-posta bildirimleri

## Akış

Form, başvuru ve bildirim kuyruğu kayıtlarını aynı veritabanı işleminde yazar. Kullanıcıya talebin alındığı gösterilir; e-posta teslim edildiği iddia edilmez. Backend, yaklaşık her 5 saniyede bir bekleyen bildirimleri kontrol eder. Bildirim yalnızca işletmecinin `FASONCEP_MAIL_TO` adresine gider; başvuran kişiye otomatik mesaj veya pazarlama e-postası gönderilmez. Başvuranın adresi Reply-To olarak kullanılır. Gönderici sabit ve SMTP sağlayıcısında yetkilendirilmiş adres olmalıdır.

Ayarlar henüz girilmemişken `FASONCEP_MAIL_ENABLED=0` kalır. Başvuru kabulü ayrı ayardır; mail kapalı olsa bile kabul edilen yeni başvurular kuyruğa alınır. Sonradan e-postayı açmak bekleyen bu bildirimleri gönderir. Bu özellik eklenmeden önceki başvurular kendiliğinden kuyruğa eklenmez.

## Ayarlar

Gerçek SMTP hesabını sağlayıcınızdan edinin. Sağlayıcı uygulama şifresi veya SMTP anahtarı gerektiriyorsa onu kullanın; hesabın normal şifresini varsaymayın. Gerçek sırları `.env.production.example` dosyasına veya GitHub'a yazmayın. Proje kökündeki Git tarafından dışlanan `.env.production` dosyasında şunları ayarlayın:

```dotenv
FASONCEP_MAIL_ENABLED=1
FASONCEP_SMTP_HOST=smtp.saglayiciniz.com
FASONCEP_SMTP_PORT=587
FASONCEP_SMTP_SECURITY=starttls
FASONCEP_SMTP_USERNAME=SMTP_KULLANICISI
FASONCEP_SMTP_PASSWORD=SMTP_UYGULAMA_SIFRESI_VEYA_ANAHTARI
FASONCEP_MAIL_FROM=bildirim@alanadiniz.com
FASONCEP_MAIL_TO=basvurular@alanadiniz.com
```

Bu değerler örnektir; gerçek sunucu ve kimlik bilgileriyle değiştirilmelidir. Port 465 kullanan sağlayıcı için `FASONCEP_SMTP_SECURITY=ssl` ve port 465 kullanılır. Şifrelenmemiş bağlantı desteklenmez; sertifika doğrulaması kapatılamaz. Kullanıcı adı ve parola birlikte doldurulur veya sağlayıcı kimlik doğrulamasız TLS aktarımına izin veriyorsa ikisi de boş bırakılır. Gönderici/alıcı tek bir yalın e-posta adresi olmalıdır.

Mevcut başvuru kabul ayarları (`FASONCEP_OPERATOR_NAME`, `FASONCEP_CONTACT_EMAIL`, `FASONCEP_DEMO_REQUESTS_ENABLED`) ayrıca tanımlanır. `CONTACT_EMAIL`, `MAIL_FROM` ve `MAIL_TO` farklı amaçlara sahiptir; otomatik olarak birbirlerinin yerine kullanılmaz.

Üretimde proje kökünde:

```bash
docker compose --env-file .env.production up -d --build app
```

Compose, backend'e yalnızca dışarı bağlantı için ayrı ağ ekler; API portunu internete açmaz. Sunucu/hosting sağlayıcınızın SMTP çıkış portlarını engellemediğini kontrol edin. Gönderici alan adının doğrulanması ve SPF/DKIM/DMARC kayıtları sağlayıcınızın verdiği değerlere göre yapılmalıdır. Uygulama bunları veya alıcının spam klasörünü yönetmez.

## Yerelde

Backend klasöründe Git tarafından dışlanan `.env` dosyasına aynı ayarları yazabilirsiniz. Dosya kendiliğinden yüklenmez. Güvendiğiniz kendi dosyanızı aynı terminale yükleyip backend'i başlatın:

```bash
set -a
source .env
set +a
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload
```

Var olan backend'i önce Ctrl+C ile durdurun. Terminale şifre yazmak yerine dosyada tutun; dosyayı paylaşmayın. Başka kaynaktan gelen shell dosyalarını source etmeyin.

## Hata, yeniden deneme ve takip

SMTP hatasında başvuru silinmez. Yeniden deneme 1, 2, 4… dakika aralıklarıyla, en fazla 6 saat aralıkla sürer. Gönderildi olarak işaretlenmiş kayıt tekrar gönderilmez. Gönderim sırasında süreç kapanırsa beş dakikalık kilit süresinden sonra tekrar denenebilir. Her tekrar aynı Message-ID kullanır; SMTP tam olarak bir kez teslim garantisi sağlamadığından, sunucu e-postayı kabul ettikten sonra bağlantı/süreç kesilirse yinelenen e-posta mümkün olabilir.

Kuyruk `demo_mail_outbox` tablosundadır. Kişisel bilgi, parola veya sağlayıcının ham hata mesajı loglanmaz; sadece hata sınıfı tutulur. İşletmeci güvenli veritabanı aracıyla `request_id, attempts, sent_at, last_error, next_attempt` alanlarını kontrol edebilir. Genel HTTP üzerinden kuyruk okuma veya yeniden gönderme uç noktası yoktur. Sürekli hata varsa uygulama loglarını ve SMTP ayarlarını kontrol edin; ayarları düzelttikten sonra normal yeniden denemeyi bekleyin.

90 günü aşan başvuru silindiğinde ona ait kuyruk kaydı da silinir. Gönderilmiş e-postalar bu temizliğe dahil değildir; alıcı posta kutusu ve sağlayıcı saklama ayarları ayrıca yönetilmelidir. E-posta sağlayıcısı ve olası yurt dışına aktarım, başvuru aydınlatma/altyapı incelemesine dahil edilmelidir.

## Doğrulama sınırı

Otomatik testler geçici DB ve sahte SMTP istemcisiyle TLS, alıcı ayrımı, hatada yeniden deneme, kalıcılık ve tekrar bildirim engelini kontrol eder. Gerçek sağlayıcıya bağlantı veya gerçek e-posta teslimi bu testlerle doğrulanmaz. Sağlayıcı ayarlarından sonra, size ait adresle tek bir açıkça test olarak belirtilmiş başvuru yapıp teslimi ayrıca kontrol edin.
