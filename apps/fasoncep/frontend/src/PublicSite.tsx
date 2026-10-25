import { marketingRedirect } from './publicRouting'
import DemoWorkspace from './DemoWorkspace'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import Landing, { PublicBrand } from './Landing'
import { updatePageMeta } from './siteMeta'

type Config = { mode: 'marketing'|'application'; accepting_requests: boolean; operator_name: string; contact_email: string; retention_days: number }
const fallback: Config = {mode:'marketing',accepting_requests:false,operator_name:'',contact_email:'',retention_days:90}
function initialConfig(): Config {
  try { return JSON.parse(document.getElementById('public-config')?.textContent || 'null') || fallback } catch { return fallback }
}
export default function PublicSite({application}:{application:ReactNode}) {
  const [config,setConfig]=useState(initialConfig)
  const [configReady,setConfigReady]=useState(()=>!!document.getElementById('public-config'))
  const [path,setPath]=useState(window.location.pathname)
  function navigate(next:string) { window.history.pushState({},'',next);setPath(next);window.scrollTo({top:0,behavior:'instant'}) }
  useEffect(()=>{
    const pop=()=>setPath(window.location.pathname)
    window.addEventListener('popstate',pop)
    const controller=new AbortController()
    if(!document.getElementById('public-config')) fetch('/api/public-config',{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(value=>{if(!controller.signal.aborted)setConfig(value)}).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setConfigReady(true)})
    return()=>{controller.abort();window.removeEventListener('popstate',pop)}
  },[])
  useEffect(()=>{
    const next=marketingRedirect(path,config.mode,configReady)
    if(next) {
      window.history.replaceState({},'',next);setPath(next)
    }
    if(configReady && config.mode==='marketing')updatePageMeta(path)
  },[path,config.mode,configReady])
  if(!configReady && path!=='/')return <div className="loading-screen" role="status"><div className="spinner"/><strong>FasonCep açılıyor…</strong></div>
  if(config.mode==='application')return application
  if(path==='/demo')return <DemoWorkspace navigate={navigate}/>
  if(path==='/')return <Landing navigate={navigate} signedIn={false}/>
  return <div className="public-shell"><header className="public-shell-header landing-container"><PublicBrand onClick={()=>navigate('/')}/><button className="button secondary" onClick={()=>navigate('/')}><ArrowLeft size={16}/> Ana sayfa</button></header><main className="landing-container public-shell-main">
    {path==='/aydinlatma'?<Privacy config={config}/>:<RequestForm config={config} navigate={navigate}/>}
  </main><footer className="public-footer landing-container"><span>© {new Date().getFullYear()} FasonCep</span><button className="text-button" onClick={()=>navigate('/aydinlatma')}>Demo talebi aydınlatma metni</button></footer></div>
}

export function RequestForm({config,navigate}:{config:Config;navigate:(path:string)=>void}) {
  const [saving,setSaving]=useState(false), [error,setError]=useState(''), [done,setDone]=useState(false)
  const busy=useRef(false)
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(busy.current||!config.accepting_requests)return
    const form=event.currentTarget
    if(!form.reportValidity())return
    const values=new FormData(form)
    const payload={name:String(values.get('name')||'').trim(),workshop_name:String(values.get('workshop_name')||'').trim(),email:String(values.get('email')||'').trim(),website:String(values.get('website')||'')}
    if(payload.name.length<2 || payload.workshop_name.length<2){setError('Ad ve atölye adı en az 2 karakter olmalı.');return}
    busy.current=true;setSaving(true);setError('')
    try {
      const response=await fetch('/api/demo-requests',{method:'POST',headers:{'Content-Type':'application/json','X-FasonCep-Request':'1'},body:JSON.stringify(payload),credentials:'same-origin'})
      if(!response.ok) {
        const body=await response.json().catch(()=>null)
        throw Error(typeof body?.detail==='string'?body.detail:'Bilgileri kontrol edip tekrar deneyin.')
      }
      setDone(true)
    } catch(error) {setError(error instanceof Error?error.message:'Talep kaydedilemedi. Lütfen tekrar deneyin.')} finally {busy.current=false;setSaving(false)}
  }
  if(done)return <section className="auth-card demo-request-card" role="status"><span className="auth-symbol"><Check/></span><h1>Talebin alındı.</h1><p>Demo için seninle iletişime geçeceğiz.</p><button className="button primary" onClick={()=>navigate('/demo')}>Örnek demoyu incele<ArrowRight size={17}/></button></section>
  return <section className="auth-card demo-request-card"><span className="eyebrow">FASONCEP İLE TANIŞ</span><h1>Atölyeni tanıyalım.</h1><p>Demo talebini bırak, seninle iletişime geçelim. Bu aşamada hesap veya şifre oluşturulmaz.</p>
    {!config.accepting_requests&&<div className="alert" role="status">Demo talepleri yakında açılacak. Bu sırada örnek demoyu inceleyebilirsin.</div>}
    <form onSubmit={submit}><div className="form-field"><label htmlFor="request-name">Ad soyad *</label><input id="request-name" name="name" autoComplete="name" required minLength={2} maxLength={80}/></div><div className="form-field"><label htmlFor="request-workshop">Atölye adı *</label><input id="request-workshop" name="workshop_name" autoComplete="organization" required minLength={2} maxLength={120}/></div><div className="form-field"><label htmlFor="request-email">E-posta *</label><input id="request-email" name="email" autoComplete="email" type="email" required maxLength={254}/></div><div className="request-honeypot" aria-hidden="true"><label htmlFor="request-website">Web sitesi</label><input id="request-website" name="website" tabIndex={-1} autoComplete="off"/></div>
    <p className="auth-password-help">Bilgilerinin demo talebi kapsamında işlenmesi hakkında <a href="/aydinlatma">aydınlatma metnini</a> inceleyebilirsin.</p>
    {error&&<div className="alert error" role="alert">{error}</div>}<button className="button primary auth-submit" disabled={saving||!config.accepting_requests}>{saving?'Gönderiliyor…':'Demo talebi gönder'}<ArrowRight size={17}/></button></form><button className="text-button" onClick={()=>navigate('/demo')}>Örnek demoyu incele</button></section>
}

function Privacy({config}:{config:Config}) {
  return <article className="public-notice"><span className="eyebrow">DEMO TALEBİ</span><h1>Kişisel verilerin hakkında.</h1>{!config.accepting_requests?<p>Demo talep formu henüz başvuru kabul etmiyor. Başvurular açılmadan önce veri sorumlusu ve iletişim bilgileriyle birlikte aydınlatma metni burada paylaşılacak.</p>:<>
    <h2>Veri sorumlusu</h2><p>{config.operator_name}. Başvuru ve iletişim adresi: <a href={`mailto:${config.contact_email}`}>{config.contact_email}</a>.</p>
    <h2>Hangi bilgiler, hangi amaçla?</h2><p>Formda verdiğin ad soyad, atölye adı ve e-posta adresi; demo talebini kaydetmek, değerlendirmek ve talebine yanıt vermek için elektronik ortamda toplanır. Hesap açılmaz; şifre veya müşteri/çalışan kaydı istenmez.</p>
    <h2>Hukuki sebep ve aktarım</h2><p>Talebin kapsamındaki işleme, 6698 sayılı Kanun’un 5/2-c maddesindeki sözleşmenin kurulmasıyla doğrudan ilgili olma şartına dayanır. Veriler, bu amaçla kullanılan barındırma, e-posta ve yedekleme hizmeti sağlayıcılarına hizmetin gerektirdiği ölçüde, yetkili kamu kurumlarına ise yasal yükümlülük halinde aktarılabilir.</p>
    <h2>Saklama ve hakların</h2><p>Demo talebi kayıtları ana veritabanında en fazla {config.retention_days} gün saklanır. Kanun’un 11. maddesi kapsamında işlenip işlenmediğini öğrenme, bilgi isteme, amaç ve alıcıları öğrenme, düzeltme, şartları varsa silme/yok etme ve bunların alıcılara bildirilmesini isteme, yalnızca otomatik analizle aleyhine sonuç doğmasına itiraz ve kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme hakların bulunur. Taleplerini Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ’e uygun şekilde yukarıdaki iletişim adresinden iletebilirsin.</p>
    <p>Bu form pazarlama bülteni aboneliği oluşturmaz. Metin sürümü: demo-v1.</p>
  </>}</article>
}

export function SampleDemo({navigate}:{navigate:(path:string)=>void}) {
  return <DemoWorkspace navigate={navigate}/>
}
