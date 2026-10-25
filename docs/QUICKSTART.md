# Kurulum ve geliştirme

## Gereksinimler

- Önerilen: Node.js 24 ve Python 3.12.
- Node alt sınırı 22.12; bağımlılıklar `package-lock.json` ile yüklenir.
- Python üretim sürümleri `requirements.lock`, test sürümleri `requirements-dev.txt` içindedir.

## macOS / Linux

Proje kökünden:

```bash
cd apps/fasoncep/backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

Yeni terminalde, proje kökünden:

```bash
cd apps/fasoncep/frontend
npm ci
npm run dev
```

`http://127.0.0.1:5173` adresini açın. Önce hesap, ardından atölye oluşturun. Demo veya varsayılan hesap yüklenmez.

## Windows / PowerShell

```powershell
cd apps/fasoncep/backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Yeni terminalde:

```powershell
cd apps/fasoncep/frontend
npm ci
npm run dev
```

Aktivasyon veya execution policy değişikliği gerekmez.

## İki terminal seçeneği

Backend klasöründe:

```bash
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8765 --reload
```

Frontend klasöründe:

```bash
npm run dev:web
```

`npm run dev` zaten API'yi başlatıyorsa ayrıca Uvicorn açmayın.

## Sorun giderme

| Belirti | Kontrol |
| --- | --- |
| `Address already in use` | Aynı API veya Vite ikinci kez başlatılmış olabilir; ilgili terminalde Ctrl+C kullanın. |
| `ECONNREFUSED ...8765` | API kapalıdır; frontend'de `npm run dev` ile birlikte başlatın. |
| Python 3.9 tür hatası | `.venv/bin/python --version` ile ortamı kontrol edin; yeni ortamı Python 3.12 ile oluşturun. |
| Kayıt sırasında kaynak hatası | Vite proxy'de `changeOrigin: false` korunmalı; API/Vite yeniden başlatılmalı. |
| Girişten sonra boş atölyeler | Her hesap ayrıdır. Eski sahipsiz kayıtlar otomatik devralınmaz. |

Geliştirme verisi varsayılan olarak `apps/fasoncep/backend/data/fasoncep.db` içinde oluşur ve Git tarafından dışlanır. Gerçek veriyle çalışmadan önce [güvenlik](../SECURITY.md) ve [işletim](OPERATIONS.md) belgelerini okuyun.
