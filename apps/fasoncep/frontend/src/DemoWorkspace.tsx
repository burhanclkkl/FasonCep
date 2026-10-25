import { useState } from 'react'
import { Home, Building2, ClipboardList, Factory, Truck, Wallet, Layers3, Shirt, ChevronDown, Check, Menu, ArrowLeft, ArrowRight, Settings2, X } from 'lucide-react'
import Operations from './Operations'
import type { OperationPage } from './Operations'
import { createDemoData } from './demoData'

const workshops=[{id:1,name:'Örnek Dikim Atölyesi',work:'Dikim · Ütü / Paket'},{id:2,name:'Örnek Kesim Atölyesi',work:'Kesim · Dikim'}]
const navigation=[{id:'overview',label:'Dashboard',icon:Home},{id:'customers',label:'Müşteriler',icon:Building2},{id:'orders',label:'Siparişler',icon:ClipboardList},{id:'production',label:'Üretim',icon:Factory},{id:'deliveries',label:'Teslimatlar',icon:Truck},{id:'accounts',label:'Cari & Tahsilat',icon:Wallet}] as const
export default function DemoWorkspace({navigate}:{navigate:(path:string)=>void}) {
  const [page,setPage]=useState<OperationPage|'workshop'>('overview')
  const [active,setActive]=useState(1)
  const [switcher,setSwitcher]=useState(false)
  const [mobile,setMobile]=useState(false)
  const [datasets]=useState(()=>({1:createDemoData(1),2:createDemoData(2)}))
  const workshop=workshops.find(item=>item.id===active)!
  function go(next:typeof page){setPage(next);setMobile(false);setSwitcher(false);window.scrollTo({top:0,behavior:'smooth'})}
  return <div className="workspace demo-workspace"><aside className={`sidebar ${mobile?'mobile-open':''}`}>
    <div className="sidebar-brand"><div className="public-brand"><span><Layers3 size={23}/></span><strong>FasonCep<span>.</span></strong></div></div>
    <div className="workshop-switcher"><button className="app-selector" onClick={()=>setSwitcher(!switcher)} aria-expanded={switcher} aria-controls="demo-workshops"><div className="selector-icon"><Shirt size={19}/></div><div className="selector-label"><strong>Atölyem</strong><span>{workshop.name}</span></div><ChevronDown size={17}/></button>
    {switcher&&<div className="workshop-options" id="demo-workshops"><span className="switcher-heading">ÖRNEK ATÖLYELER</span>{workshops.map(item=><button key={item.id} className={`workshop-option ${active===item.id?'selected':''}`} onClick={()=>{setActive(item.id);setSwitcher(false);setMobile(false)}}><span className="workshop-initial">Ö</span><span><strong>{item.name}</strong><small>{item.work}</small></span>{active===item.id&&<Check size={16}/>}</button>)}</div>}</div>
    <div className="sidebar-label">ÇALIŞMA ALANI</div><nav className="side-links">{navigation.map(item=><button key={item.id} className={`side-link ${page===item.id?'active':''}`} onClick={()=>go(item.id)}><item.icon size={19}/><span>{item.label}</span></button>)}</nav>
    <div className="sidebar-bottom"><div className="account-summary"><span>Örnek demo</span><small>Gerçek kayıt içermez</small></div><button className={`side-link ${page==='workshop'?'active':''}`} onClick={()=>go('workshop')}><Settings2 size={19}/> Firma Ayarları</button><button className="side-link" onClick={()=>navigate('/')}><ArrowLeft size={18}/> Ana sayfaya dön</button></div>
  </aside><div className="main-wrap"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={()=>setMobile(!mobile)} aria-label="Menü" aria-expanded={mobile}><Menu size={22}/></button><span className="breadcrumb">Atölyem</span><span className="breadcrumb-sep">/</span><span className="breadcrumb strong">{workshop.name}</span></div><div className="topbar-right"><button className="button primary" onClick={()=>navigate('/demo-talebi')}>Hesap aç<ArrowRight size={16}/></button></div></header>
    <main className="main-content"><div className="demo-mode-banner" role="note"><span><strong>Örnek demo</strong> · Uygulamanın gerçek ekranlarını örnek verilerle inceliyorsun. Ekleme, düzenleme, silme ve dışa aktarma kapalıdır.</span><button className="icon-button" onClick={()=>navigate('/')} aria-label="Demodan çık"><X size={18}/></button></div>
    {page==='workshop'?<><div className="section-header"><div><span className="eyebrow">YÖNETİM</span><h1>Firma ayarları</h1><p>Örnek atölye bilgileri · salt okunur</p></div></div><section className="panel demo-profile"><Building2 size={30}/><h2>{workshop.name}</h2><p>{workshop.work}</p><p>Bu demoda gerçek iletişim bilgisi girilmez. Atölye seçicisinden diğer örnek atölyeye geçebilirsin.</p></section></>:<Operations key={active} workshopId={active} name={workshop.name} page={page} navigate={go} settings={()=>go('workshop')} previewData={datasets[active as 1|2]}/>}
    </main></div>{mobile&&<div className="nav-overlay" onClick={()=>setMobile(false)}/>}</div>
}
