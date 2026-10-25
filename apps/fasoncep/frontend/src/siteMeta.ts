export const SITE_TITLE = 'Fason Atölye Takip Programı | FasonCep'
export const SITE_DESCRIPTION = 'FasonCep ile fason atölyenin sipariş, üretim, teslimat ve müşteri alacaklarını tek yerden takip et. Teslim takvimi, renk/beden dağılımı ve Excel raporları.'

let publicTags: HTMLElement[] = []

export function updatePageMeta(path: string) {
  const home = path === '/'
  document.title = home ? SITE_TITLE : path === '/giris' ? 'Giriş yap · FasonCep' : path === '/kayit' ? 'Hesap oluştur · FasonCep' : path === '/demo-talebi' ? 'Demo talebi · FasonCep' : path === '/demo' ? 'Örnek demo · FasonCep' : path === '/aydinlatma' ? 'Aydınlatma · FasonCep' : 'Çalışma alanı · FasonCep'
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (robots) robots.content = home ? (robots.dataset.publicPolicy || 'noindex, nofollow') : 'noindex, nofollow'
  if (!publicTags.length) publicTags = Array.from(document.querySelectorAll<HTMLElement>('[data-public-seo]')).map(element => element.cloneNode(true) as HTMLElement)
  if (home && !document.querySelector('[data-public-seo]')) publicTags.forEach(element => document.head.append(element.cloneNode(true)))
  for (const element of document.querySelectorAll<HTMLElement>('[data-public-seo]')) {
    // Private SPA routes must not retain public-page canonical, social tags or schema.
    if (!home) { element.remove(); continue }
  }
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (description) description.content = home ? SITE_DESCRIPTION : ['/demo','/demo-talebi','/aydinlatma'].includes(path) ? 'FasonCep’i örnek verilerle incele ve demo talebi hakkında bilgi al.' : 'FasonCep hesabını yönet.'
}
