# Geliştirme ve katkı

Önce [kurulum](docs/QUICKSTART.md), [mimari](docs/ARCHITECTURE.md) ve [güvenlik](SECURITY.md) belgelerini okuyun.

## Kontroller

Proje kökünde `python3 scripts/check_repository.py`; backend'de `.venv/bin/python -m pytest -q`; frontend'de `npm test` ve `npm run build` çalıştırın. Python testleri geçici dizinlerde çalışır; gerçek veritabanını test hedefi yapmayın.

CI ayrıca temiz `npm ci` ve Docker build çalıştırır. Workflow GitHub'a yüklendikten sonra gerçekten başarılı olmalıdır; dosyanın varlığı başarılı çalıştığı anlamına gelmez.

## Kurallar

- Kullanıcı/atölye ayrımını yalnızca frontend'de uygulamayın; backend sahiplik kontrollerini koruyun.
- Adet, tarih ve bakiye kurallarını değiştirdiğinizde hem ekleme hem düzenleme/silme senaryolarını kontrol edin.
- Üretim verisi, kayıt sıfırlayıcı, demo kullanıcı veya örnek şifre eklemeyin. Test fixture'ları yalnızca geçici test veritabanlarında kalır.
- Uygulama paletini ve sade akışı koruyun. Yeni bağımlılıkları gerekçelendirin.
- `export-template.xlsx` kullanılan bir kaynaktır; geçici çıktı değildir.
- Bağımlılık değişikliğinde lock dosyalarını kontrollü güncelleyin, temiz kurulum ve testleri tekrarlayın. Üretim Python kilidi Python 3.12/Linux dağıtımı için tutulur.
- Şema değişikliklerinde veri taşıma, yedek ve geri dönüş etkisini belgeleyin.
- `.env`, hash'ler, çerezler ve gerçek müşteri bilgilerini PR/issue/log içine kopyalamayın.

## GitHub'a ilk aktarım

Kontrollerden sonra `git init`, uygun `.gitignore` ile `git add`, `git status` ve staged diff incelemesini kullanıcı yapmalıdır. Özellikle veri/ortam dosyalarının listede olmadığını doğrulayın. Ardından commit ve seçtiğiniz GitHub remote'una push yapılabilir. Bu hazırlık çalışması uzak depo oluşturmaz veya push yapmaz.

Depoya bir yazılım lisansı henüz eklenmedi; lisans seçimi sahibinin kararıdır.
