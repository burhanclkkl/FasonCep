# İşletim, yedek ve geri dönüş

## Günlük kontrol

```bash
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 app
```

`https://ALAN_ADINIZ/api/health` yalnızca servis durumunu verir. Disk doluluğunu ve yedeklerin gerçekten oluştuğunu ayrıca izleyin. Parola, çerez veya iş kayıtlarını destek mesajlarına/günlüklere eklemeyin.

## Tutarlı yedek

Uygulama çalışırken SQLite backup API ile alınabilir:

```bash
docker compose --env-file .env.production exec -T app python -m app.backup
```

Komut `/data/backups/...db` yolunu döndürür. Dosyayı sunucu dışına güvenli biçimde kopyalayın. Aynı diskteki kopya sunucu kaybına karşı koruma sağlamaz. Saklama süresi ve zamanlanmış yedek işi işletmeci tarafından belirlenir; otomatik offsite aktarım kurulmamıştır.

Yerel geliştirmede backend klasöründen `.venv/bin/python -m app.backup` kullanılabilir. Komut mevcut bir yedeğin veya kaynak veritabanının üzerine yazmaz; dosyayı 0600 izinle oluşturur ve bütünlük kontrolü yapar.

Yedek müşteri bilgileri ve parola hash'leri içerir. Repoya, açık dosya paylaşımına veya herkese açık web dizinine konulmaz.

## Geri yükleme

1. Mevcut verinin ayrıca yedeğini alın; doğru yedeği ve hedef ortamı belirleyin.
2. API'yi durdurun: `docker compose --env-file .env.production stop app`.
3. Compose projesinin `app_data` volume'ünde `fasoncep.db` dosyasını seçilen yedekle değiştirin. Eski `-wal`/`-shm` dosyalarını farklı bir veritabanıyla birlikte kullanmayın.
4. Dosya sahibi container kullanıcısı `10001:10001`, veri dizini 0700 ve dosya 0600 olmalı.
5. SQLite `PRAGMA integrity_check` ve `PRAGMA foreign_key_check` çalıştırın.
6. Geri yüklenmiş oturumları iptal etmek için kapalı veritabanında `DELETE FROM sessions` uygulayın; kullanıcılar tekrar giriş yapsın.
7. API'yi açın, giriş yapın ve müşteri/sipariş/adet/bakiye örneklerini kontrol edin.

Geri yükleme canlı verinin üzerine yazan bir bakım işlemidir. İlk kez gerçek ortamda denemeyin; önce ayrı bir test volume'ünde prova yapın. Bu çalışma gerçek sunucu geri yükleme provası yapıldığını iddia etmez.

## Güncelleme

Önce yedek, sonra kaynak sürümünü güncelleme, ardından:

```bash
docker compose --env-file .env.production up -d --build
```

Şema değişikliği olan sürümlerde sadece eski imaja dönmek yeterli olmayabilir; ilgili veri yedeğiyle beraber geri dönüş planlayın. Volume adlarını değiştirmeyin. Servisi yatay ölçeklemeyin.

## Hesap erişimi

Hazır yönetici hesabı veya varsayılan şifre yoktur. E-posta doğrulama, şifre sıfırlama e-postası ve yönetim paneli yoktur. Parola unutma desteği için düz metin şifre istemeyin ve veritabanına hazır şifre yazmayın; kontrollü hesap kurtarma akışı sonraki sürüm kapsamıdır.
