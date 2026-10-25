# FasonCep çalışma notları

- Ürün: sade fason atölye iş defteri. Kapsam için docs/ROADMAP.md, veri kuralları için docs/ARCHITECTURE.md okuyun.
- Frontend: apps/fasoncep/frontend (React/TypeScript/Vite). Backend: apps/fasoncep/backend (FastAPI/SQLite).
- Testler: backend'de `.venv/bin/python -m pytest -q`; frontend'de `npm test` ve `npm run build`.
- İş kayıtları ve hesaplar kullanıcıya ait atölyeyle ayrıdır. Sahiplik denetimini hiçbir API'den kaldırmayın.
- Gerçek DB/hesap/yedek üzerinde test çalıştırmayın. Test fixture'ları geçici dizinler kullanır.
- Demo veriyi uygulamayla birlikte göndermeyin; veri sıfırlama uç noktası eklemeyin.
- Veri ve sırlar Git/build context dışında kalmalı. scripts/check_repository.py kontrolünü koruyun.
- Para kuruş olarak saklanır. Tahsilat müşteri bazlıdır; siparişe tahsis edildiğini iddia etmeyin.
- Renk paleti: #F8FAFC #FFFFFF #182D54 #2563EB #EFF6FF #1D4ED8 #16A34A #F59E0B #DC2626 #0F172A #64748B #E2E8F0.
- Excel şablonu backend/app/assets/export-template.xlsx gerekli dosyadır; otomatik temizlikte silmeyin.
- Üretim: Docker/Caddy, tek API örneği, kalıcı /data. Uzak sunucu/HTTPS doğrulanmadan canlıya alındı demeyin.
- E-posta bildirimi ve kayıt sonrası onay modeli henüz planlanıyor; talep olmadan mesaj göndermeyin veya servis bağlamayın.
