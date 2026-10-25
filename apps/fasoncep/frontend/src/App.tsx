import { updatePageMeta } from './siteMeta'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft, ArrowRight, LogOut, Download, Building2, Check, CheckCircle2,
  ChevronDown, ClipboardList, CloudOff, Factory,
  Home, Layers3, LockKeyhole, Mail, MapPin, Menu, Plus,
  Settings2, Share2, ShieldCheck, Shirt, Smartphone, Truck, Wallet, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from './api'
import Operations from './Operations'
import Landing from './Landing'
import AuthPage from './AuthPage'
import type { User } from './api'
import { validateWorkshop } from './validation'
import type { EmployeeBand, Workshop, WorkshopInput, WorkType } from './api'

type Page = 'overview' | 'customers' | 'orders' | 'production' | 'deliveries' | 'accounts' | 'workshop'

const workTypes: WorkType[] = ['Dikim', 'Kesim', 'Ütü / Paket', 'Diğer']
const bands: { value: EmployeeBand; label: string }[] = [
  { value: '1-5', label: '1–5 kişi' },
  { value: '6-10', label: '6–10 kişi' },
  { value: '11-20', label: '11–20 kişi' },
  { value: '21-50', label: '21–50 kişi' },
  { value: '50+', label: '50+ kişi' },
]
const initialForm: WorkshopInput = {
  name: '', work_types: ['Dikim'], employee_band: null,
  phone: null, email: null, address: null, description: null,
}

const nav: { page: Page; label: string; icon: LucideIcon; soon?: boolean }[] = [
  {page: 'overview', label: 'Dashboard', icon: Home},
  {page: 'customers', label: 'Müşteriler', icon: Building2},
  {page: 'orders', label: 'Siparişler', icon: ClipboardList},
  {page: 'production', label: 'Üretim', icon: Factory},
  {page: 'deliveries', label: 'Teslimatlar', icon: Truck},
  {page: 'accounts', label: 'Cari & Tahsilat', icon: Wallet},
]

function WorkshopForm({ workshop, onSave, onBack }: {
  workshop: Workshop | null
  onSave: (workshop: Workshop) => void
  onBack?: () => void
}) {
  const [form, setForm] = useState<WorkshopInput>(workshop ? {
    name: workshop.name, work_types: workshop.work_types, employee_band: workshop.employee_band,
    phone: workshop.phone, email: workshop.email, address: workshop.address, description: workshop.description,
  } : initialForm)
  const [optionalOpen, setOptionalOpen] = useState(Boolean(workshop?.phone || workshop?.email || workshop?.address || workshop?.description))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const errors = validateWorkshop(form)
  const fieldError = (field: keyof WorkshopInput) => submitted && errors[field]
    ? <p id={`${field}-error`} className="field-error" role="alert">{errors[field]}</p> : null
  const validationProps = (field: keyof WorkshopInput) => ({
    'aria-invalid': Boolean(submitted && errors[field]),
    'aria-describedby': submitted && errors[field] ? `${field}-error` : undefined,
  })

  function update<K extends keyof WorkshopInput>(field: K, value: WorkshopInput[K]) {
    setForm(previous => ({...previous, [field]: value}))
  }

  function toggleType(type: WorkType) {
    setForm(previous => {
      const selected = previous.work_types.includes(type)
      return { ...previous, work_types: selected
        ? previous.work_types.filter(item => item !== type)
        : [...previous.work_types, type] }
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (saving) return
    setSubmitted(true)
    if (Object.keys(errors).length) {
      if (errors.phone || errors.email || errors.address || errors.description) setOptionalOpen(true)
      setError('Lütfen işaretlenen alanları kontrol edin.')
      return
    }
    setSaving(true)
    try {
      const updated = workshop ? await api.updateWorkshop(workshop.id, form) : await api.createWorkshop(form)
      onSave(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilgiler kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="workshop-form" onSubmit={submit} noValidate>
      <div className="form-heading">
        <span className="eyebrow">{workshop ? 'İŞLETME AYARLARI' : 'YENİ ATÖLYE'}</span>
        <h1>{workshop ? 'Atölye bilgileri' : 'Atölyeni oluşturalım.'}</h1>
        <p>Başlamak için birkaç bilgi yeterli. Diğer alanları sonradan doldurabilirsin.</p>
      </div>

      <div className="form-field">
        <label htmlFor="workshopName">Atölye adı <span className="required">*</span></label>
        <input {...validationProps('name')} id="workshopName" autoFocus maxLength={120} value={form.name}
          onChange={event => update('name', event.target.value)} placeholder="Örn. ABC Tekstil" required minLength={2} />
        {fieldError('name')}
      </div>

      <div className="form-field">
        <label>Hangi işleri yapıyorsunuz? <span className="required">*</span></label>
        <p className="helper">Birden fazla seçim yapabilirsin.</p>
        <div className="chip-row" role="group" aria-label="İş türleri" {...validationProps('work_types')}>
          {workTypes.map(type => (
            <button key={type} type="button" className={`choice-chip ${form.work_types.includes(type) ? 'selected' : ''}`}
              aria-pressed={form.work_types.includes(type)} onClick={() => toggleType(type)}>
              {form.work_types.includes(type) && <Check size={15} strokeWidth={2.5} />}{type}
            </button>
          ))}
        </div>
        {fieldError('work_types')}
      </div>

      <div className="form-field">
        <label htmlFor="employeeBand">Çalışan sayısı <span className="optional">(isteğe bağlı)</span></label>
        <div className="select-wrapper"><select {...validationProps('employee_band')} id="employeeBand" value={form.employee_band || ''}
          onChange={event => update('employee_band', event.target.value ? event.target.value as EmployeeBand : null)}>
          <option value="">Seçmek istemiyorum</option>
          {bands.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
        </select><ChevronDown size={18} /></div>
        {fieldError('employee_band')}
      </div>

      <div className="details-panel">
        <button type="button" className="details-toggle" aria-expanded={optionalOpen} onClick={() => setOptionalOpen(!optionalOpen)}>
          <span className="details-toggle-title"><Plus size={18} /> Ek işletme bilgileri <span>(isteğe bağlı)</span></span>
          <ChevronDown size={18} className={optionalOpen ? 'rotate' : ''}/>
        </button>
        {optionalOpen && <div className="optional-grid">
          <div className="form-field"><label htmlFor="phone">İletişim telefonu</label>
            <input {...validationProps('phone')} id="phone" type="tel" maxLength={30} value={form.phone ?? ''}
              onChange={event => update('phone', event.target.value)} placeholder="05xx xxx xx xx" />{fieldError('phone')}</div>
          <div className="form-field"><label htmlFor="email">İletişim e-postası</label>
            <input {...validationProps('email')} id="email" type="email" maxLength={254} value={form.email ?? ''}
              onChange={event => update('email', event.target.value)} placeholder="iletisim@ornek.com" />{fieldError('email')}</div>
          <div className="form-field full"><label htmlFor="address">Adres</label>
            <textarea {...validationProps('address')} id="address" rows={2} maxLength={350} value={form.address ?? ''}
              onChange={event => update('address', event.target.value)} placeholder="İl, ilçe ve açık adres" />{fieldError('address')}</div>
          <div className="form-field full"><label htmlFor="description">Atölye hakkında</label>
            <textarea {...validationProps('description')} id="description" rows={3} maxLength={500} value={form.description ?? ''}
              onChange={event => update('description', event.target.value)} placeholder="Hangi ürünleri üretiyorsunuz?" />{fieldError('description')}</div>
          <p className="privacy-note full"><LockKeyhole size={15} /> Bu alanlar yalnızca bu bilgisayara kaydedilir. Herkese açık profil oluşturulmaz.</p>
        </div>}
      </div>

      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="form-actions">
        {onBack && <button type="button" className="button ghost" onClick={onBack}><ArrowLeft size={17}/> Vazgeç</button>}
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? 'Kaydediliyor...' : workshop ? 'Değişiklikleri kaydet' : 'Atölyeyi oluştur'}
          {!saving && <ArrowRight size={17} />}
        </button>
      </div>
    </form>
  )
}

function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}>
    <div className="brand-symbol"><Layers3 size={24} strokeWidth={2.3}/></div>
    <div><div className="brand-name">FasonCep<span className="brand-dot">.</span></div>
    <div className="brand-subtitle">ATÖLYE YÖNETİMİ</div></div>
  </div>
}

function Setup({ onSave }: { onSave: (w: Workshop) => void }) {
  return <div className="setup-layout">
    <div className="setup-left">
      <Brand />
      <div className="setup-intro">
        <h2>Atölyen düzenli.<br/><span>İşlerin kontrol altında.</span></h2>
        <p>Sipariş, üretim ve teslimat süreçlerini kolaylaştırmak için ilk adımı at.</p>
        <div className="intro-benefits">
          <div><CheckCircle2 size={21}/><span>Siparişlerini tek yerden takip et</span></div>
          <div><ShieldCheck size={21}/><span>Üretim ve teslimatını planla</span></div>
          <div><Smartphone size={21}/><span>Müşteri ve tahsilatlarını yönet</span></div>
        </div>
      </div>
    </div>
    <main className="setup-right"><div className="setup-card">
      <div className="step-symbol"><Shirt size={23}/></div>
      <WorkshopForm workshop={null} onSave={onSave}/>
    </div></main>
  </div>
}

function ShareModal({ workshop, onClose, onNotify }: { workshop: Workshop; onClose: () => void; onNotify: (message: string) => void }) {
  const [sharePhone, setSharePhone] = useState(false)
  const [shareEmail, setShareEmail] = useState(false)
  const [shareAddress, setShareAddress] = useState(false)
  const [shareDescription, setShareDescription] = useState(false)
  const cardText = useMemo(() => [
    workshop.name,
    `Faaliyet: ${workshop.work_types.join(', ')}`,
    sharePhone && workshop.phone ? `Telefon: ${workshop.phone}` : null,
    shareEmail && workshop.email ? `E-posta: ${workshop.email}` : null,
    shareAddress && workshop.address ? `Adres: ${workshop.address}` : null,
    shareDescription && workshop.description ? `Hakkımızda: ${workshop.description}` : null,
  ].filter(Boolean).join('\n'), [workshop, sharePhone, shareEmail, shareAddress, shareDescription])

  async function copy() {
    try {
      await navigator.clipboard.writeText(cardText)
      onNotify('Firma bilgileri panoya kopyalandı.')
      onClose()
    } catch {
      onNotify('Kopyalama başarısız. Tarayıcı pano iznini kontrol edin.')
    }
  }

  return <div className="modal-backdrop" onMouseDown={event => {if(event.target === event.currentTarget) onClose()}}>
    <section className="share-modal" role="dialog" aria-modal="true" aria-label="Firma profilini paylaş">
      <div className="modal-head"><div><h2>Firma kartını paylaş</h2><p>Hangi bilgilerin paylaşılacağını sen seç.</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Kapat"><X size={20}/></button>
      </div>
      <div className="share-choices">
        <label className="check-row"><input type="checkbox" checked readOnly disabled/> İşletme adı ve faaliyet alanı</label>
        {workshop.phone && <label className="check-row"><input type="checkbox" checked={sharePhone} onChange={e=>setSharePhone(e.target.checked)}/> Telefon</label>}
        {workshop.email && <label className="check-row"><input type="checkbox" checked={shareEmail} onChange={e=>setShareEmail(e.target.checked)}/> E-posta</label>}
        {workshop.address && <label className="check-row"><input type="checkbox" checked={shareAddress} onChange={e=>setShareAddress(e.target.checked)}/> Adres</label>}
        {workshop.description && <label className="check-row"><input type="checkbox" checked={shareDescription} onChange={e=>setShareDescription(e.target.checked)}/> Açıklama</label>}
      </div>
      <div className="copy-preview"><div className="preview-caption">ÖNİZLEME</div><pre>{cardText}</pre></div>
      <p className="modal-hint"><LockKeyhole size={15}/> Paylaşım yalnızca metni panoya kopyalar. İnternette profil yayımlamaz.</p>
      <button className="button primary full-button" onClick={copy}><Share2 size={17}/> Seçilen bilgileri kopyala</button>
    </section>
  </div>
}

function Workspace({ workshop, workshops, onSelect, onWorkshopChange, user, onLogout }: {
  user:User; onLogout:()=>void; workshop: Workshop; workshops: Workshop[]; onSelect: (id: number) => void;
  onWorkshopChange: (workshop: Workshop) => void
}) {
  const [page, setPage] = useState<Page>('overview')
  const [showShare, setShowShare] = useState(false)
  const [notification, setNotification] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [addingWorkshop, setAddingWorkshop] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  async function exportExcel() {
    if (exporting) return
    setExporting(true)
    try { await api.exportWorkshop(workshop.id); setNotification('Excel dosyası indirildi.') }
    catch (error) { setNotification(error instanceof Error ? error.message : 'Excel indirilemedi.') }
    finally { setExporting(false) }
  }

  function selectWorkshop(id: number) {
    onSelect(id); setSwitcherOpen(false); setMobileNav(false); setAddingWorkshop(false)
    setShowShare(false); setNotification('')
    // Keep the current module when switching workshops; creation returns to the dashboard.
    if (addingWorkshop) setPage('overview')
    window.scrollTo({top:0, behavior:'smooth'})
  }


  function navigate(next: Page) {
    setPage(next)
    setAddingWorkshop(false)
    setSwitcherOpen(false)
    setMobileNav(false)
    window.scrollTo({top:0, behavior:'smooth'})
  }

  return <div className="workspace">
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand"><Brand small/></div>
      <div className="workshop-switcher" onKeyDown={event => { if (event.key === 'Escape') setSwitcherOpen(false) }}>
        <button className="app-selector" aria-expanded={switcherOpen} aria-controls="workshop-options" onClick={() => setSwitcherOpen(!switcherOpen)}>
          <div className="selector-icon"><Shirt size={19}/></div><div className="selector-label"><strong>Atölyem</strong><span>{workshop.name}</span></div><ChevronDown size={17} className={switcherOpen ? 'rotate' : ''}/>
        </button>
        {switcherOpen && <><button className="switcher-dismiss" aria-label="Atölye seçimini kapat" onClick={() => setSwitcherOpen(false)}/><div className="workshop-options" id="workshop-options"><span className="switcher-heading">ATÖLYELERİM · {workshops.length}</span>
          <div className="workshop-option-list">{workshops.map(item => <button key={item.id} className={`workshop-option ${item.id === workshop.id ? 'selected' : ''}`} aria-current={item.id === workshop.id ? 'true' : undefined} onClick={() => selectWorkshop(item.id)}><span className="workshop-initial">{item.name.charAt(0).toLocaleUpperCase('tr-TR')}</span><span><strong>{item.name}</strong><small>{item.work_types.join(' · ')}</small></span>{item.id === workshop.id && <Check size={16}/>}</button>)}</div>
          <button className="add-workshop" onClick={() => {setAddingWorkshop(true);setSwitcherOpen(false);setPage('workshop');setMobileNav(false)}}><Plus size={17}/> Yeni atölye ekle</button>
        </div></>}
      </div>
      <div className="sidebar-label">ÇALIŞMA ALANI</div>
      <nav className="side-links">
        {nav.map(({page: id,label,icon:Icon,soon}) => <button key={id} className={`side-link ${page===id ? 'active':''}`}
          onClick={()=>navigate(id)}><Icon size={19}/><span>{label}</span>{soon && <small>Yakında</small>}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="account-summary"><span>{user.name}</span><small>{user.email}</small></div><button className="side-link" onClick={onLogout}><LogOut size={18}/> Çıkış yap</button>
        <button className={`side-link ${page==='workshop'?'active':''}`} onClick={()=>navigate('workshop')}><Settings2 size={19}/> Firma Ayarları</button>
      </div>
    </aside>
    <div className="main-wrap">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={()=>setMobileNav(!mobileNav)} aria-label="Menü"><Menu size={22}/></button>
        <span className="breadcrumb">Atölyem</span><span className="breadcrumb-sep">/</span><span className="breadcrumb strong">{workshop.name}</span></div>
        <div className="topbar-right"><button className="button secondary topbar-export" aria-label="Seçili atölyenin tüm kayıtlarını Excel olarak indir" title="Seçili atölyenin tüm kayıtları · Sayfalama ve filtrelerden bağımsız" disabled={exporting} onClick={() => void exportExcel()}><Download size={16}/><span>{exporting ? 'Hazırlanıyor…' : 'Excel indir'}</span></button>
        <button className="button secondary topbar-add" onClick={() => {setAddingWorkshop(true);setPage('workshop')}}><Plus size={16}/><span>Atölye ekle</span></button><div className="avatar">{workshop.name.charAt(0).toLocaleUpperCase('tr-TR')}</div></div></header>
      <main className="main-content">
        <div hidden={page === 'workshop'}><Operations key={workshop.id} workshopId={workshop.id} active={page !== 'workshop'} page={page === 'workshop' ? 'overview' : page} name={workshop.name} navigate={navigate} settings={() => navigate('workshop')}/></div>
        {page==='workshop' && addingWorkshop && <>
          <div className="section-header"><div><span className="eyebrow">ATÖLYELERİM</span><h1>Yeni bir atölye ekle</h1><p>Her atölyeni kendi çalışma alanında yönet.</p></div></div>
          <div className="panel new-workshop-panel"><WorkshopForm workshop={null} onSave={created => {onWorkshopChange(created);selectWorkshop(created.id)}} onBack={() => {setAddingWorkshop(false);setPage('overview')}}/></div>
        </>}
        {page==='workshop' && !addingWorkshop && <>
          <div className="section-header"><div><span className="eyebrow">YÖNETİM</span><h1>Firma ayarları</h1><p>Bilgilerini düzenle ve istediğin alanları paylaş.</p></div>
            <button className="button secondary" onClick={()=>setShowShare(true)}><Share2 size={17}/> Firma kartını paylaş</button></div>
          <div className="settings-grid"><div className="panel settings-form-panel"><WorkshopForm key={workshop.id} workshop={workshop}
            onSave={updated=>{onWorkshopChange(updated);setNotification('Atölye bilgileri kaydedildi.');navigate('overview')}} onBack={()=>navigate('overview')}/></div>
            <div className="settings-side"><div className="panel profile-preview"><div className="profile-avatar"><Building2 size={25}/></div>
              <h2>{workshop.name}</h2><p>{workshop.work_types.join(' · ')}</p>
              {workshop.phone && <div className="profile-detail"><Smartphone size={16}/>{workshop.phone}</div>}
              {workshop.email && <div className="profile-detail"><Mail size={16}/>{workshop.email}</div>}
              {workshop.address && <div className="profile-detail"><MapPin size={16}/>{workshop.address}</div>}
              <button className="button secondary full-button" onClick={()=>setShowShare(true)}><Share2 size={17}/> Firma kartını paylaş</button></div>
              <div className="safe-callout"><LockKeyhole size={19}/><p><strong>Paylaşım kontrolü sende.</strong><br/>Seçmediğin kişisel iletişim bilgileri kopyalanmaz.</p></div>
            </div></div>
        </>}

      </main>
    </div>
    {mobileNav && <div className="nav-overlay" onClick={()=>setMobileNav(false)} />}
    {showShare && <ShareModal workshop={workshop} onClose={()=>setShowShare(false)} onNotify={setNotification}/>}
    {notification && <div className="toast" role="status"><CheckCircle2 size={18}/>{notification}
      <button className="icon-button" onClick={()=>setNotification('')} aria-label="Bildirimi kapat"><X size={16}/></button></div>}
  </div>
}

function WorkshopApp({user,onLogout}:{user:User;onLogout:()=>void}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const workshop = workshops.find(item => item.id === activeId) ?? workshops[0] ?? null
  function select(id: number) {
    setActiveId(id)
    try { localStorage.setItem(`fasoncep-active-workshop-${user.id}`, String(id)) } catch { /* Selection still works without browser storage. */ }
  }
  function save(updated: Workshop) {
    setWorkshops(previous => previous.some(item => item.id === updated.id)
      ? previous.map(item => item.id === updated.id ? updated : item) : [...previous, updated])
    select(updated.id)
  }

  useEffect(() => {
    let cancelled = false
    api.listWorkshops().then(result => {
      if (cancelled) return
      setWorkshops(result)
      let saved = NaN
      try { saved = Number(localStorage.getItem(`fasoncep-active-workshop-${user.id}`)) } catch { /* Use the first workshop. */ }
      setActiveId(result.find(item => item.id === saved)?.id ?? result[0]?.id ?? null)
    })
      .catch(e => {if(!cancelled) setError(e instanceof Error ? e.message : 'Bağlantı sorunu')})
      .finally(()=>{if(!cancelled) setLoading(false)})
    return ()=>{cancelled=true}
  }, [])

  if (loading) return <div className="loading-screen"><div className="spinner"/><strong>FasonCep açılıyor...</strong><span>Atölyen hazırlanıyor</span></div>
  if (error) return <div className="error-screen"><CloudOff size={34}/><h1>Bağlantı kurulamadı</h1><p>{error}</p>
    <p>Frontend klasöründe npm run dev komutunu çalıştırın, sonra sayfayı yenileyin.</p><button className="button primary" onClick={()=>window.location.reload()}>Tekrar dene</button></div>
  if (!workshop) return <><button className="setup-logout button secondary" onClick={onLogout}><LogOut size={16}/> Çıkış yap</button><Setup onSave={save}/></>
  return <Workspace user={user} onLogout={onLogout} workshop={workshop} workshops={workshops} onSelect={select} onWorkshopChange={save}/>
}


export default function App() {
  const [path,setPath]=useState(window.location.pathname)
  const [user,setUser]=useState<User|null>(null)
  const [checking,setChecking]=useState(true)
  const [logoutError,setLogoutError]=useState('')
  function navigate(next:string) {
    window.history.pushState({},'',next);setPath(next);window.scrollTo({top:0,behavior:'instant'})
  }
  useEffect(()=>{
    const pop=()=>setPath(window.location.pathname)
    const expired=()=>{setUser(null);window.history.replaceState({},'','/giris');setPath('/giris')}
    window.addEventListener('popstate',pop);window.addEventListener('fasoncep:session-expired',expired)
    let cancelled=false
    api.me().then(value=>{if(!cancelled)setUser(value)}).catch(()=>{}).finally(()=>{if(!cancelled)setChecking(false)})
    return()=>{cancelled=true;window.removeEventListener('popstate',pop);window.removeEventListener('fasoncep:session-expired',expired)}
  },[])
  useEffect(()=>{
    if(checking)return
    if(!user && path==='/uygulama'){window.history.replaceState({},'','/giris');setPath('/giris')}
    if(user && (path==='/giris'||path==='/kayit')){window.history.replaceState({},'','/uygulama');setPath('/uygulama')}
  },[checking,user,path])
  async function logout(){
    setLogoutError('')
    try{await api.logout();setUser(null);navigate('/giris')}
    catch{setLogoutError('Çıkış tamamlanamadı. Bağlantıyı kontrol edip tekrar deneyin.')}
  }
  useEffect(()=>{updatePageMeta(path)},[path])
  const signedIn=(value:User)=>{setUser(value);navigate('/uygulama')}
  if(checking && path!=='/')return <div className="loading-screen"><div className="spinner"/><strong>Hesabın hazırlanıyor…</strong></div>
  if(path==='/uygulama' && user)return <>{logoutError&&<div className="auth-session-error" role="alert">{logoutError}<button onClick={()=>void logout()}>Tekrar dene</button></div>}<WorkshopApp key={user.id} user={user} onLogout={()=>void logout()}/></>
  if(path==='/giris'||path==='/kayit')return <AuthPage key={path} mode={path==='/kayit'?'register':'login'} navigate={navigate} onSuccess={signedIn}/>
  return <Landing navigate={navigate} signedIn={!!user}/>
}
