export function marketingRedirect(path: string, mode: 'marketing'|'application', configReady: boolean): string | null {
  if (!configReady || mode !== 'marketing') return null
  if (path === '/uygulama') return '/demo'
  if (path === '/giris' || path === '/kayit') return '/demo-talebi'
  return null
}
