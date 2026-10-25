import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Check, LockKeyhole, ClipboardList, Truck, Wallet } from 'lucide-react'
import { api } from './api'
import type { User } from './api'
import { PublicBrand } from './Landing'

export default function AuthPage({mode,navigate,onSuccess}: {mode:'login'|'register';navigate:(path:string)=>void;onSuccess:(user:User)=>void}) {
  const register=mode==='register'
  const [visible,setVisible]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const busy=useRef(false)
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    if(busy.current)return
    const data=new FormData(event.currentTarget)
    const email=String(data.get('email')??'').trim()
    const password=String(data.get('password')??'')
    const name=String(data.get('name')??'').trim()
    if(!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)){setError('Geçerli bir e-posta adresi girin.');return}
    if(register && name.length<2){setError('Adınızı en az 2 karakter olarak girin.');return}
    if(register && password.trim().length<12){setError('Şifreniz en az 12 karakter olmalı.');return}
    if(register && password!==data.get('confirm')){setError('Şifreler eşleşmiyor.');return}
    if(!password){setError('Şifrenizi girin.');return}
    busy.current=true;setSaving(true);setError('')
    try{const user=register?await api.register({name,email,password}):await api.login({email,password});onSuccess(user)}
    catch(error){setError(error instanceof Error?error.message:'İşlem tamamlanamadı. Tekrar deneyin.')}
    finally{busy.current=false;setSaving(false)}
  }
  return <div className="auth-layout"><aside className="auth-story"><PublicBrand onClick={()=>navigate('/')}/><div><span className="public-eyebrow">ATÖLYENİN DİJİTAL İŞ DEFTERİ</span><h1>İşin sende.<br/><span>Takibi FasonCep’te.</span></h1><p>Hangi iş ne zaman teslim edilecek, kaç adet kaldı, kimden ne kadar alacağın var? Hepsini bir arada gör.</p><ul>{[{icon:ClipboardList,text:'Müşteri ve siparişlerin bir arada'},{icon:Truck,text:'Üretim ve teslimatların takipte'},{icon:Wallet,text:'Alacakların ve tahsilatların görünür'}].map(item=><li key={item.text}><item.icon size={20}/>{item.text}</li>)}</ul></div><small>Sade bir çalışma alanı. Daha düzenli bir atölye.</small></aside><main className="auth-main"><button className="text-button auth-back" onClick={()=>navigate('/')}><ArrowLeft size={16}/> Ana sayfaya dön</button><div className="auth-card"><span className="auth-symbol"><LockKeyhole size={23}/></span><span className="eyebrow">{register?'YENİ BİR BAŞLANGIÇ':'TEKRAR HOŞ GELDİN'}</span><h2>{register?'Hesabını oluştur.':'Atölyene giriş yap.'}</h2><p>{register?'Bilgilerini gir, ardından atölyeni oluşturmaya başla.':'E-posta adresin ve şifrenle kaldığın yerden devam et.'}</p><form onSubmit={submit} noValidate>
      {register&&<div className="form-field"><label htmlFor="auth-name">Ad soyad</label><input id="auth-name" name="name" autoComplete="name" autoFocus required minLength={2} maxLength={80} placeholder="Adınız ve soyadınız"/></div>}
      <div className="form-field"><label htmlFor="auth-email">E-posta adresi</label><input id="auth-email" name="email" type="email" autoComplete="email" autoFocus={!register} required maxLength={254} placeholder="ornek@firma.com"/></div>
      <div className="form-field"><label htmlFor="auth-password">Şifre</label><div className="auth-password"><input id="auth-password" name="password" type={visible?'text':'password'} autoComplete={register?'new-password':'current-password'} required maxLength={128} minLength={register?12:1} placeholder={register?'En az 12 karakter':'Şifreniz'}/><button type="button" className="icon-button" aria-label={visible?'Şifreyi gizle':'Şifreyi göster'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{register&&<p className="auth-password-help">En az 12 karakter kullan. Uzun ve benzersiz bir şifre seç.</p>}</div>
      {register&&<div className="form-field"><label htmlFor="auth-confirm">Şifre tekrarı</label><input id="auth-confirm" name="confirm" type={visible?'text':'password'} autoComplete="new-password" required maxLength={128} placeholder="Şifrenizi tekrar girin"/></div>}
      {error&&<div className="alert error" role="alert">{error}</div>}<button className="button primary auth-submit" type="submit" disabled={saving}>{saving?'Lütfen bekleyin…':register?'Hesabımı oluştur':'Giriş yap'}{!saving&&<ArrowRight size={17}/>}</button></form><div className="auth-switch">{register?'Zaten bir hesabın var mı?':'Henüz hesabın yok mu?'}<button onClick={()=>navigate(register?'/giris':'/kayit')}>{register?'Giriş yap':'Hesap oluştur'}</button></div>{register&&<div className="auth-footnote"><Check size={14}/><span>Hesabın hazır olduğunda atölyelerini buradan yönetebilirsin.</span></div>}</div></main></div>
}
