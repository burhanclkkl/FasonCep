export type User = {id:number;name:string;email:string}
export type WorkType = 'Dikim' | 'Kesim' | 'Ütü / Paket' | 'Diğer'
export type EmployeeBand = '1-5' | '6-10' | '11-20' | '21-50' | '50+'

export type WorkshopInput = {
  name: string
  work_types: WorkType[]
  employee_band: EmployeeBand | null
  phone: string | null
  email: string | null
  address: string | null
  description: string | null
}

export type Workshop = WorkshopInput & {
  id: number
  created_at: string
  updated_at: string
}

async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    const headers=new Headers(options?.headers)
    headers.set('X-FasonCep-Request','1')
    response = await fetch(url, { ...options, headers, credentials:'same-origin', cache: 'no-store' })
  } catch {
    throw new Error('Yerel sunucuya bağlanılamadı. FastAPI terminalini kontrol edin.')
  }
  if (!response.ok) {
    if(response.status===401 && !url.startsWith('/api/auth/'))window.dispatchEvent(new Event('fasoncep:session-expired'))
    if (response.status >= 500) throw new Error('Uygulama sunucusuna bağlanılamadı. Terminalde npm run dev komutunu çalıştırın.')
    const body = await response.json().catch(() => null)
    if (typeof body?.detail === 'string') throw new Error(body.detail)
    if (response.status === 422) throw new Error('Bilgiler geçersiz. Zorunlu alanları ve veri biçimini kontrol edin.')
    throw new Error(`İşlem başarısız (HTTP ${response.status}).`)
  }
  return response.json() as Promise<T>
}

export const api = {
  me: () => jsonRequest<User>('/api/auth/me'),
  register: (payload:{name:string;email:string;password:string}) => jsonRequest<User>('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),
  login: (payload:{email:string;password:string}) => jsonRequest<User>('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),
  logout: () => jsonRequest('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),
  exportWorkshop: async (id: number) => {
    const response = await fetch(`/api/workshops/${id}/export.xlsx`, {cache:'no-store'})
    if(response.status===401)window.dispatchEvent(new Event('fasoncep:session-expired'))
    if (!response.ok) throw new Error('Excel dosyası oluşturulamadı. API güncel ve açık olmalı.')
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `FasonCep-Atolye-${id}-${new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul'}).format(new Date())}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
  saveOperation: <T,>(workshopId: number, kind: string, payload: object, id?: string) => jsonRequest<T>(`/api/workshops/${workshopId}/operations/${kind}${id ? `/${id}` : ''}`, {
    method: id ? 'PUT' : 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload),
  }),
  deleteOperation: <T,>(workshopId: number, kind: string, id: string) => jsonRequest<T>(`/api/workshops/${workshopId}/operations/${kind}/${id}`, {method: 'DELETE'}),
  getOperations: <T,>(workshopId: number) => jsonRequest<T>(`/api/workshops/${workshopId}/operations`),
  listWorkshops: () => jsonRequest<Workshop[]>('/api/workshops'),
  createWorkshop: (workshop: WorkshopInput) => jsonRequest<Workshop>('/api/workshops', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(workshop),
  }),
  updateWorkshop: (id: number, workshop: WorkshopInput) => jsonRequest<Workshop>(`/api/workshops/${id}`, {
    method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(workshop),
  }),
}
