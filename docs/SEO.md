# SEO ve yapay zekâ aramalarında görünürlük

## Uygulanan yapı

- Ana sayfa derleme sırasında React ile HTML olarak oluşturulur. Kullanıcılar ve botlar aynı ürün içeriğini JavaScript beklemeden alır; React sonrasında etkileşimleri devralır.
- Türkçe dil, açıklayıcı başlık/açıklama, favicon, canonical, Open Graph ve büyük Twitter/X paylaşım kartı bulunur. Paylaşım görseli 1200×630 PNG'dir; kaynak SVG de depodadır.
- JSON-LD, görünür özelliklerle tutarlı Organization, WebSite, WebPage ve SoftwareApplication varlıklarını tanımlar. Fiyat, değerlendirme, kullanıcı sayısı ve adres uydurulmaz. Bu şema zengin sonuç garantisi değildir.
- `/sitemap.xml` yalnızca halka açık ana sayfayı içerir. Gerçek bir güncelleme tarihi kaynağı olmadığı için yapay lastmod üretilmez.
- Giriş, kayıt ve uygulama sayfaları `noindex, nofollow` ile sunulur. API yanıtlarında da `X-Robots-Tag` bulunur. Robots dosyası erişim denetimi değildir; kullanıcı verileri oturum ve sahiplik kontrolleriyle korunur.
- Robots, halka açık sayfaya arama botlarının erişmesine izin verir. Auth sayfaları, noindex talimatının okunabilmesi için robots ile engellenmez. API taraması engellenir.
- Bilinmeyen URL'ler gerçek 404 döndürür; ana sayfaya dönüştürülmez.
- Ana sayfadaki ürün tanımı, kullanım adımları, özellikler ve sık sorulanlar yapay zekâ aramalarının da okuyabileceği HTML metnidir. Google için özel AI dosyaları veya ayrı GEO şeması gerekmez; `llms.txt` eklenmedi.

## Alan adı ve yayın

Compose, `.env.production` içindeki `DOMAIN` değerinden `FASONCEP_PUBLIC_URL=https://...` üretir. Docker dışında dağıtımda ayrıca `FASONCEP_PUBLIC_URL=https://gercek-alan-adiniz` ve aynı alan adını içeren `FASONCEP_ALLOWED_HOSTS` ayarlayın. URL yalnızca HTTPS kök adresi olabilir; yol, sorgu veya kullanıcı bilgisi kabul edilmez. Ana adresin tüm alternatiflerini (www/eski alan adı) sunucuda bu adrese 301 ile yönlendirin. Bu yönlendirme gerçek alan adları belirlendiğinde yapılmalıdır.

URL tanımlanmamışsa üretim dahil sayfalar noindex kalır ve sitemap boş olur. Geliştirme ortamı her zaman indeks dışıdır. Örnek alan adını gerçek yayın alan adı olarak kullanmayın. Yeni alan adına geçişte robots/sitemap önbelleğini temizleyin veya bir saat bekleyin.

Vite geliştirme sunucusu yayın sunucusu değildir. Tam SEO çıktısını kontrol etmek için `npm run build` sonrası üretim backend/Caddy yolunu kullanın; Vite preview çalışma zamanı canonical ve sitemap üretmez.

## Canlıya çıktıktan sonra

1. HTTPS, DNS, www/ana adres yönlendirmesi ve ana sayfanın HTTP 200 yanıtını gerçek alan adında kontrol edin. Canonical, og:url ve sitemap aynı kök adresi göstermeli.
2. Google Search Console ve Bing Webmaster Tools'da alan adı sahipliğini DNS ile doğrulayın; sitemap URL'sini gönderin. Bunlar hesap/sunucu erişimi gerektirdiği için kod değişikliğiyle tamamlanmaz.
3. Search Console URL Denetimi ile işlenmiş HTML ve indekslenebilirliği inceleyin. Schema Markup Validator ile JSON-LD'yi kontrol edin; Rich Results Test, her geçerli schema türü için zengin sonuç göstermez.
4. Mobil PageSpeed Insights ile LCP, INP ve CLS ölçün. Gerçek sunucu, cihaz ve ağ verisi olmadan performans puanı vaat etmeyin. Vite varlıkları dosya hash'iyle, Caddy üzerinden uzun süre önbelleklenir.
5. Paylaşım kartını gerçek URL üzerinden sosyal platformların önizleme araçlarında kontrol edin.
6. Search Console/Bing raporlarından sorgu, gösterim, tıklama ve indeks sorunlarını izleyin. İçeriği gerçek kullanıcı sorularına göre geliştirin. Seri şehir sayfaları, sahte yorumlar, anahtar kelime doldurma ve satın alınmış bağlantılar kullanmayın.

Sıralama veya yapay zekâ yanıtında alıntılanma garanti edilemez. Bu çalışma teknik altyapıyı hazırlar; yayın, keşfedilme, özgün faydalı içerik ve gerçek kullanım geri bildirimi sonraki adımlardır.

## Kaynaklar

- [Google: JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google: AI özellikleri ve web siteniz](https://developers.google.com/search/docs/appearance/ai-features)
- [Google: Generative AI optimizasyon rehberi](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Google: robots meta ve X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)

## Otomatik doğrulama

Frontend derlemesinden sonra proje kökünde `apps/fasoncep/backend/.venv/bin/python scripts/check_public_site.py` çalıştırılabilir. Geçici veritabanıyla üretim HTML çıktısını, canonical/sitemap tutarlılığını, görsel boyutlarını ve özel sayfaların indeks dışı kalmasını sınar. CI da bu kontrolü derlemeden sonra çalıştırır.

İlk yayın artık `marketing` modudur. Eski giriş/kayıt/uygulama adresleri demo talebi veya örnek demoya yönlenir. Demo ve talep sayfaları noindex kalır; sitemap yalnızca ana sayfayı içerir. Ayrıntılar: [PUBLIC-LAUNCH.md](PUBLIC-LAUNCH.md).
