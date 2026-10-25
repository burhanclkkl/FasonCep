import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from './api'
import { toCents, lineCents, parseAmount, validDate } from './amounts'
import { deletionBlockReason } from './deletion'
import type { DeleteKind, DeleteTarget } from './deletion'
import { ArrowRight, Building2, ClipboardList, Factory, Plus, Search, Truck, Wallet, X, ArrowUpRight, Trash2, Shirt, PackageCheck } from 'lucide-react'

export type OperationPage = 'overview' | 'customers' | 'orders' | 'production' | 'deliveries' | 'accounts'
import type { Customer, Order, Movement, Payment, OperationData, Variant } from './operationTypes'
import OrderDetail from './OrderDetail'
import DeliveryCalendar from './DeliveryCalendar'
import { istanbulToday } from './schedule'
import RowActions from './RowActions'
import Pagination, { usePagination } from './Pagination'
import { orderStatus, isLate } from './orderPresentation'
const money = (n: number) => n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
const number = (n: number) => n.toLocaleString('tr-TR')
const dateLabel = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('tr-TR')
const today = istanbulToday
const config = {
  customers: { title: 'Müşteriler', subtitle: 'Birlikte çalıştığın firmalar, tek bir yerde.', action: 'Müşteri ekle', icon: Building2 },
  orders: { title: 'Siparişler', subtitle: 'Her siparişin başlangıcından teslimine kadar takipte kal.', action: 'Yeni sipariş', icon: ClipboardList },
  production: { title: 'Üretim', subtitle: 'Günün emeğini kaydet, üretimin ilerleyişini gör.', action: 'Üretim kaydet', icon: Factory },
  deliveries: { title: 'Teslimatlar', subtitle: 'Hazır olanı teslim et, kalan adetleri kolayca takip et.', action: 'Teslimat ekle', icon: Truck },
  accounts: { title: 'Cari & Tahsilat', subtitle: 'Müşteri bakiyelerini ve ödemelerini birlikte izle.', action: 'Tahsilat ekle', icon: Wallet },
}

export default function Operations({ page, name, navigate, settings, workshopId, active = true }: { workshopId: number; active?: boolean; page: OperationPage; name: string; navigate: (page: OperationPage) => void; settings: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [production, setProduction] = useState<Movement[]>([])
  const [deliveries, setDeliveries] = useState<Movement[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [reload, setReload] = useState(0)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [editRecord, setEditRecord] = useState<Customer | Order | Movement | Payment | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [, refreshDay] = useState(0)
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => refreshDay(value => value + 1), 60000)
    return () => clearInterval(timer)
  }, [active])
  const [prefill, setPrefill] = useState<{order?:string;customer?:string}>({})
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([])
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  function applyData(data: OperationData) {
    setCustomers(data.customers); setOrders(data.orders); setProduction(data.production)
    setDeliveries(data.deliveries); setPayments(data.payments)
  }
  const defaultField = (field: string) => {
    const record = editRecord as unknown as Record<string, string | number> | null
    return record?.[field] ?? (field === 'order' ? prefill.order : field === 'customer' ? prefill.customer : '') ?? ''
  }
  const backendKind = (kind: string) => kind === 'accounts' ? 'payments' : kind

  useEffect(() => {
    if (!active) return
    let cancelled = false
    setDataLoading(true); setDataError('')
    api.getOperations<OperationData>(workshopId).then(data => {
      if (cancelled) return
      setCustomers(data.customers); setOrders(data.orders); setProduction(data.production)
      setDeliveries(data.deliveries); setPayments(data.payments)
    }).catch(error => { if (!cancelled) setDataError(error instanceof Error ? error.message : 'Veriler yüklenemedi.') })
      .finally(() => { if (!cancelled) setDataLoading(false) })
    return () => { cancelled = true }
  }, [workshopId, reload, active])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState<Exclude<OperationPage, 'overview'> | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const deleteTrigger = useRef<HTMLElement | null>(null)
  const deleteReason = deleting ? deletionBlockReason(deleting, { customers, orders, production, deliveries, payments }) : null
  const deleteLabels: Record<DeleteKind, string> = { customers: 'Müşteri', orders: 'Sipariş', production: 'Üretim kaydı', deliveries: 'Teslimat', accounts: 'Tahsilat' }
  useEffect(() => {
    if (deleting && active) deleteDialog.current?.showModal()
    else { deleteDialog.current?.close(); deleteTrigger.current?.focus() }
  }, [deleting, active])
  useEffect(() => { setDeleting(null) }, [active, page])
  function requestDeletion(kind: DeleteKind, id: string, label: string) {
    deleteTrigger.current = document.activeElement as HTMLElement
    setDeleteError(''); setDeleting({kind, id, label})
  }
  async function deleteRecord() {
    if (!deleting || busy.current || deletionBlockReason(deleting, { customers, orders, production, deliveries, payments })) return
    busy.current = true; setSaving(true); setDeleteError('')
    try {
      const data = await api.deleteOperation<OperationData>(workshopId, backendKind(deleting.kind), deleting.id)
      applyData(data); setDetailId(null); setDeleting(null)
      setNotice(`${deleteLabels[deleting.kind]} silindi.`)
    } catch (error) { setDeleteError(error instanceof Error ? error.message : 'Kayıt silinemedi.') }
    finally { busy.current = false; setSaving(false) }
  }
  function resolveDeletion() {
    if (!deleting) return
    let destination: OperationPage = 'accounts'
    if (deleting.kind === 'customers' && orders.some(o => o.customer === deleting.id)) destination = 'orders'
    if (deleting.kind === 'orders' && (production.some(m => m.order === deleting.id) || deliveries.some(m => m.order === deleting.id))) {
      destination = deliveries.some(m => m.order === deleting.id) ? 'deliveries' : 'production'
    }
    if (deleting.kind === 'production') destination = 'deliveries'
    setDeleting(null)
    navigate(destination)
  }
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  useEffect(() => { if (!active) { setModal(null); setDetailId(null); setNotice('') } }, [active])
  useEffect(() => { setQuery(''); setFilter('all'); setDetailId(null) }, [page])
  useEffect(() => {
    if (modal) { trigger.current = document.activeElement as HTMLElement; dialog.current?.showModal() }
    else { dialog.current?.close(); trigger.current?.focus() }
  }, [modal])
  const customerName = (id: string) => customers.find(c => c.id === id)?.name ?? '—'
  const produced = (id: string) => production.filter(m => m.order === id).reduce((a, m) => a + m.quantity, 0)
  const delivered = (id: string) => deliveries.filter(m => m.order === id).reduce((a, m) => a + m.quantity, 0)
  const billed = (id: string) => orders.filter(o => o.customer === id).reduce((a, o) => a + lineCents(o.quantity, o.price), 0) / 100
  const paid = (id: string) => payments.filter(p => p.customer === id).reduce((a, p) => a + toCents(p.amount), 0) / 100
  const status = (o: Order) => orderStatus(o.quantity,produced(o.id),delivered(o.id))
  const late = (o:Order) => isLate(o.due,today(),o.quantity,delivered(o.id))
  const orderBadges = (o:Order) => <span className="order-badges"><span className={`status-pill order-status-${status(o).tone}`}>{status(o).label}</span>{late(o) && <span className="status-pill overdue-badge">Gecikti</span>}</span>
  const matches = (...values: string[]) => values.join(' ').toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))
  const total = orders.reduce((a, o) => a + lineCents(o.quantity, o.price), 0) / 100
  const collected = payments.reduce((a, p) => a + toCents(p.amount), 0) / 100
  function open(kind: Exclude<OperationPage, 'overview'>, record: Customer | Order | Movement | Payment | null = null, context: {order?:string;customer?:string} = {}) {
    if (busy.current) return
    setError(''); setEditRecord(record); setPrefill(context); setExtrasOpen(false); setPhoto(record && 'photo' in record ? record.photo : null)
    setVariants(record && 'variants' in record ? record.variants.map(item => ({...item})) : [])
    setModal(kind)
  }
  async function readPhoto(file?: File) {
    if (!file) return
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setError('PNG, JPEG veya WebP seçin. Fotoğraf en fazla 2 MB olabilir.'); return }
    setPhotoBusy(true); setError('')
    try {
      const result = await new Promise<string>((resolve,reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file)})
      await new Promise<void>((resolve,reject) => {const image = new Image(); image.onload = () => resolve(); image.onerror = reject; image.src = result})
      setPhoto(result)
    } catch { setError('Fotoğraf okunamadı; geçerli bir görsel seçin.') }
    finally { setPhotoBusy(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current || photoBusy || !modal) return
    let payload: object | null = null
    const data = new FormData(event.currentTarget)
    const str = (key: string) => String(data.get(key) ?? '').trim()
    const fail = (message: string) => setError(message)
    setError('')
    if (modal !== 'customers' && (!validDate(str('date')) || (modal !== 'orders' && str('date') > today()))) return fail('Geçerli bir tarih girin. İşlem tarihi gelecekte olamaz.')
    if (modal === 'customers') {
      if (str('name').length < 2 || str('name').length > 120) return fail('Firma adı 2–120 karakter olmalı.')
      if (customers.some(c => c.id !== editRecord?.id && c.name.toLocaleLowerCase('tr-TR') === str('name').toLocaleLowerCase('tr-TR'))) return fail('Bu firma zaten listede.')
      if (str('phone') && (!/^\+?[0-9 ()-]+$/.test(str('phone')) || str('phone').replace(/\D/g, '').length < 10 || str('phone').replace(/\D/g, '').length > 15)) return fail('Geçerli bir telefon numarası girin.')
      if (str('contact').length > 120 || str('phone').length > 30) return fail('İlgili kişi en fazla 120, telefon en fazla 30 karakter olabilir.')
      if (str('email') && (str('email').length > 254 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(str('email')))) return fail('Geçerli bir e-posta adresi girin.')
      payload = { name: str('name'), contact: str('contact'), phone: str('phone'), email: str('email') }
    } else if (modal === 'orders') {
      const quantity = Number(str('quantity')), price = parseAmount(str('price'))
      if (!customers.some(c => c.id === str('customer')) || !str('model') || str('model').length > 120 || !Number.isSafeInteger(quantity) || quantity < 1 || price === null || !Number.isSafeInteger(lineCents(quantity, price)) || !validDate(str('date'))) return fail('Müşteri, model, adet, fiyat ve teslim tarihini kontrol edin.')
      if (price === null) return fail('Birim fiyat pozitif ve en fazla iki ondalık haneli olmalı.')
      if (variants.length && variants.reduce((sum, v) => sum + v.quantity, 0) !== quantity) {setExtrasOpen(true);return fail('Renk/beden dağılımının toplamı sipariş adedine eşit olmalı.')}
      if (variants.some(v => !v.color.trim() || !v.size.trim() || !Number.isSafeInteger(v.quantity) || v.quantity < 1)) {setExtrasOpen(true);return fail('Her dağılım satırında renk, beden ve pozitif tam adet girin.')}
      const keys = variants.map(v => `${v.color.trim().toLocaleLowerCase('tr-TR')}|${v.size.trim().toLocaleLowerCase('tr-TR')}`)
      if (new Set(keys).size !== keys.length) {setExtrasOpen(true);return fail('Aynı renk/beden birden fazla satırda olamaz.')}
      payload = { customer: str('customer'), model: str('model'), quantity, price, due: str('date'), notes: str('notes'), photo, variants }
    } else if (modal === 'production' || modal === 'deliveries') {
      const order = orders.find(o => o.id === str('order')), quantity = Number(str('quantity'))
      if (!order || !Number.isSafeInteger(quantity) || quantity < 1 || !validDate(str('date'))) return fail('Sipariş, tarih ve geçerli bir adet seçin.')
      const remaining = modal === 'production' ? order.quantity - produced(order.id) : produced(order.id) - delivered(order.id)
      if (!editRecord && quantity > remaining) return fail(`Kaydedilebilecek en fazla adet: ${remaining}.`)
      payload = { order: order.id, quantity, date: str('date') }
    } else if (modal === 'accounts') {
      const amount = parseAmount(str('amount'))
      if (!customers.some(c => c.id === str('customer')) || amount === null || !validDate(str('date'))) return fail('Müşteri, tarih ve geçerli bir tutar girin.')
      if (amount === null) return fail('Tutar pozitif ve en fazla iki ondalık haneli olmalı.')
      const outstandingCents = toCents(billed(str('customer'))) - toCents(paid(str('customer')))
      if (!editRecord && toCents(amount) > outstandingCents) return fail(`Tahsilat açık bakiyeyi aşamaz. Kaydedilebilecek en fazla tutar: ${money(outstandingCents / 100)}.`)
      payload = { customer: str('customer'), amount, date: str('date') }
    }
    if (!payload) return
    busy.current = true; setSaving(true)
    try {
      const result = await api.saveOperation<OperationData>(workshopId, backendKind(modal), payload, editRecord?.id)
      applyData(result); setModal(null); setNotice(editRecord ? 'Değişiklikler kaydedildi.' : 'Kayıt eklendi.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Kayıt kaydedilemedi.') }
    finally { busy.current = false; setSaving(false) }
  }
  const stats = page === 'overview' ? [
    {label:'Bugün teslim',value:number(orders.filter(o => o.due === today() && delivered(o.id)<o.quantity).length),icon:Truck,color:'blue',note:'Bugün teslim bekleyen sipariş'},
    {label:'Geciken işler',value:number(orders.filter(late).length),icon:ClipboardList,color:'orange',note:'Teslim tarihi geçen açık sipariş'},
    {label:'Açık alacak',value:money((toCents(total)-toCents(collected))/100),icon:Wallet,color:'green',note:`${money(collected)} tahsil edildi`},
  ] : [
    { label: 'Aktif sipariş', value: number(orders.filter(o => delivered(o.id) < o.quantity).length), icon: ClipboardList, color: 'blue', note: `${orders.length} toplam sipariş` },
    { label: 'Üretilecek adet', value: number(orders.reduce((a, o) => a + o.quantity - produced(o.id), 0)), icon: Factory, color: 'navy', note: 'Üretim planında bekleyen' },
    { label: 'Teslime hazır adet', value: number(orders.reduce((a, o) => a + produced(o.id) - delivered(o.id), 0)), icon: Truck, color: 'orange', note: 'Üretilen, henüz teslim edilmeyen' },
    { label: 'Açık alacak', value: money((toCents(total) - toCents(collected)) / 100), icon: Wallet, color: 'green', note: `${money(collected)} tahsil edildi` },
  ]
  const orderTable = (rows: Order[]) => <>
    <div className="table-scroll desktop-order-list"><table><thead><tr><th>Sipariş / Model</th><th>Müşteri</th><th>Kalan adet</th><th>Teslim tarihi</th><th>Tutar</th><th>Durum</th><th><span className="sr-only">İşlemler</span></th></tr></thead><tbody>{rows.map(o => <tr key={o.id}><td><div className="order-model-cell"><button className="order-thumbnail" aria-label={`${o.model} detayını aç`} onClick={() => setDetailId(o.id)}>{o.photo ? <img src={o.photo} alt=""/> : <Shirt size={20}/>}</button><div><button className="order-link" onClick={() => setDetailId(o.id)}>{o.model}</button><small>#{o.id.slice(0,6).toUpperCase()} · {number(o.quantity)} adet</small></div></div></td><td>{customerName(o.customer)}</td><td><strong>{number(o.quantity-delivered(o.id))} adet</strong><div className="progress-track"><span style={{width:`${produced(o.id)/o.quantity*100}%`}}/></div><small>{number(produced(o.id))} üretildi · {number(delivered(o.id))} teslim</small></td><td className={late(o)?'overdue-text':''}>{dateLabel(o.due)}</td><td>{money(lineCents(o.quantity,o.price)/100)}</td><td>{orderBadges(o)}</td><td><RowActions label={o.model} onView={() => setDetailId(o.id)} onEdit={() => open('orders',o)} onDelete={() => requestDeletion('orders',o.id,`${o.model} · ${customerName(o.customer)}`)}/></td></tr>)}</tbody></table></div>
    <div className="mobile-order-list">{rows.map(o => <article className="mobile-order-card" key={o.id}><div className="mobile-order-head"><button className="order-thumbnail" aria-label={`${o.model} detayını aç`} onClick={() => setDetailId(o.id)}>{o.photo ? <img src={o.photo} alt=""/> : <Shirt size={21}/>}</button><div><button className="order-link" onClick={() => setDetailId(o.id)}>{o.model}</button><p>{customerName(o.customer)}</p></div><RowActions label={o.model} onView={() => setDetailId(o.id)} onEdit={() => open('orders',o)} onDelete={() => requestDeletion('orders',o.id,`${o.model} · ${customerName(o.customer)}`)}/></div>{orderBadges(o)}<dl><div><dt>Kalan teslimat</dt><dd>{number(o.quantity-delivered(o.id))} adet</dd></div><div><dt>Teslim tarihi</dt><dd className={late(o)?'overdue-text':''}>{dateLabel(o.due)}</dd></div><div><dt>Sipariş tutarı</dt><dd>{money(lineCents(o.quantity,o.price)/100)}</dd></div></dl><button className="text-button" onClick={() => setDetailId(o.id)}>Sipariş detayına git <ArrowRight size={14}/></button></article>)}</div>
  </>
  const empty = (title: string, description: string, action?: () => void, label?: string) => <div className="empty-state operational-empty"><div className="empty-illustration"><PackageCheck size={28}/></div><strong>{title}</strong><p>{description}</p>{action && <button className="button secondary" onClick={action}><Plus size={16}/>{label}</button>}</div>
  const current = page === 'overview' ? null : config[page]
  const Icon = current?.icon ?? ClipboardList
  const filteredOrders = orders.filter(o => matches(o.model, customerName(o.customer), o.id) && (filter === 'all' || (filter === 'done' ? delivered(o.id) === o.quantity : delivered(o.id) < o.quantity)))
  const filteredCustomers = customers.filter(c => matches(c.name, c.contact, c.phone, c.email))
  const moves = page === 'deliveries' ? deliveries : production
  const filteredMoves = moves.filter(m => { const o = orders.find(o => o.id === m.order); return matches(o?.model ?? '', o ? customerName(o.customer) : '') })
  const paginationKey = `${workshopId}:${page}:${query}:${filter}`
  const customerPages = usePagination(filteredCustomers,paginationKey)
  const orderPages = usePagination(filteredOrders,paginationKey)
  const movementPages = usePagination([...filteredMoves].reverse(),paginationKey)
  const filteredPayments = payments.filter(p => matches(customerName(p.customer))).slice().reverse()
  const paymentPages = usePagination(filteredPayments,paginationKey)
  const mainPages = page === 'orders' ? orderPages : page === 'production' || page === 'deliveries' ? movementPages : customerPages
  if (dataLoading) return <div className="empty-state"><div className="spinner"/><strong>Atölye kayıtları yükleniyor…</strong></div>
  if (dataError) return <div className="empty-state"><strong>Kayıtlar yüklenemedi</strong><p>{dataError} Backend'i yeniden başlatıp tekrar deneyin.</p><button className="button secondary" onClick={() => setReload(value => value + 1)}>Tekrar dene</button></div>
  return <>
    {detailId && orders.find(o => o.id === detailId) ? <OrderDetail order={orders.find(o => o.id === detailId)!} customers={customers} production={production} deliveries={deliveries} payments={payments} onBack={() => setDetailId(null)} onEdit={() => open('orders',orders.find(o => o.id === detailId)!)} onAction={kind => {const order=orders.find(o => o.id === detailId)!;open(kind,null,{order:order.id,customer:order.customer})}}/> : <>
    <div className="section-header"><div><span className="eyebrow">{page === 'overview' ? 'DASHBOARD' : 'ÇALIŞMA ALANI'}</span><h1>{current?.title ?? `Merhaba, ${name} 👋`}</h1><p>{current?.subtitle ?? 'Bugünün işlerini birlikte düzene koyalım.'}</p></div><button className="button primary" onClick={() => open(page === 'overview' ? 'orders' : page)}><Plus size={18}/>{current?.action ?? 'Yeni sipariş'}</button></div>

    <div className={`metric-grid operation-metrics ${page === 'overview' ? 'dashboard-priorities' : ''}`}>{stats.map(s => <div className="metric-card" key={s.label}><div className={`metric-icon ${s.color}`}><s.icon size={20}/></div><p>{s.label}</p><strong>{s.value}</strong><span>{s.note}</span></div>)}</div>
    {(page === 'overview' || page === 'deliveries') && <DeliveryCalendar orders={orders} deliveries={deliveries} customers={customers} onOpen={setDetailId}/>}
    {page === 'overview' ? <>
      <div className="dashboard-grid"><section className="panel"><div className="panel-title"><h2>Son siparişler</h2><button className="text-button" onClick={() => navigate('orders')}>Tümünü gör <ArrowRight size={14}/></button></div>{orders.length ? orderTable(orders.slice(-5).reverse()) : empty('İlk siparişinle başla', 'Önce müşterini ekle, ardından sipariş detaylarını gir. Üretim ve teslimatı buradan takip et.', () => open('customers'), 'Müşteri ekle')}</section><section className="panel quick-panel"><div className="panel-title"><h2>Bir sonraki adımın</h2></div>{[{ title: 'Müşterilerini ekle', sub: `${customers.length} firma kayıtlı`, icon: Building2, action: () => navigate('customers') }, { title: 'Üretimini kaydet', sub: 'Tamamlanan adetleri işle', icon: Factory, action: () => navigate('production') }, { title: 'Firma profilini tamamla', sub: 'Atölyenin bilgilerini güncelle', icon: ArrowUpRight, action: settings }].map(item => <button className="quick-action" key={item.title} onClick={item.action}><span className="quick-icon"><item.icon size={18}/></span><span><strong>{item.title}</strong><small>{item.sub}</small></span><ArrowRight size={16}/></button>)}<div className="workflow-note">Müşteri → Sipariş → Üretim → Teslimat<br/><span>Her adımda işinin kontrolü sende.</span></div></section></div>
      <div className="dashboard-insights">
        <section className="panel pipeline-panel"><div className="panel-title"><h2>Atölyenin iş akışı</h2><span>Seçili atölye</span></div><div className="pipeline-stages">{[
          {label:'Planlanan',count:orders.filter(o => produced(o.id) === 0).length,icon:ClipboardList,page:'orders' as const},
          {label:'Üretimde',count:orders.filter(o => produced(o.id) > 0 && produced(o.id) < o.quantity).length,icon:Factory,page:'production' as const},
          {label:'Teslime hazır',count:orders.filter(o => produced(o.id) === o.quantity && delivered(o.id) < o.quantity).length,icon:Truck,page:'deliveries' as const},
          {label:'Tamamlanan',count:orders.filter(o => delivered(o.id) === o.quantity).length,icon:PackageCheck,page:'orders' as const},
        ].map(stage => <button key={stage.label} className="pipeline-stage" onClick={() => navigate(stage.page)}><stage.icon size={19}/><strong>{number(stage.count)}</strong><span>{stage.label}</span></button>)}</div></section>
        <section className="panel deadlines-panel"><div className="panel-title"><h2>Yaklaşan teslimler</h2><Truck size={18}/></div>{orders.filter(o => delivered(o.id) < o.quantity).length ? <div className="deadline-list">{orders.filter(o => delivered(o.id) < o.quantity).sort((a,b) => a.due.localeCompare(b.due)).slice(0,3).map(o => <button key={o.id} className="deadline-item" onClick={() => setDetailId(o.id)}><span className="deadline-date">{new Date(`${o.due}T12:00:00`).getDate()}<small>{new Date(`${o.due}T12:00:00`).toLocaleDateString('tr-TR',{month:'short'})}</small></span><span><button className="order-link" onClick={() => setDetailId(o.id)}>{o.model}</button><small>{customerName(o.customer)} · {number(o.quantity-delivered(o.id))} adet</small></span><ArrowRight size={15}/></button>)}</div> : <div className="deadline-empty"><Truck size={24}/><p>Takviminde bekleyen teslimat yok.</p><button className="text-button" onClick={() => open('orders')}>Sipariş planla <ArrowRight size={14}/></button></div>}</section>
      </div>
      <div className="overview-bottom"><div><span className="eyebrow">TAHSİLAT DURUMU</span><h2>{money(collected)}</h2><p>{money(total)} toplam sipariş tutarından tahsil edildi.</p><div className="progress-track"><span style={{ width: `${total ? collected / total * 100 : 0}%` }}/></div></div><button className="button secondary" onClick={() => navigate('accounts')}>Cari hesapları incele <ArrowRight size={16}/></button></div>
    </> : <section className="panel data-panel"><div className="table-toolbar"><div className="list-title"><Icon size={19}/><h2>{page === 'accounts' ? 'Müşteri bakiyeleri' : page === 'production' || page === 'deliveries' ? 'Hareket geçmişi' : `${current?.title} listesi`}</h2></div><div className="table-controls"><label className="search-box"><Search size={17}/><input aria-label="Listede ara" placeholder="Listede ara…" value={query} onChange={e => setQuery(e.target.value)}/></label>{page === 'orders' && <select aria-label="Sipariş durumu" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tüm durumlar</option><option value="active">Aktif siparişler</option><option value="done">Teslim edilenler</option></select>}</div></div>
      {page === 'customers' && (filteredCustomers.length ? <div className="table-scroll"><table><thead><tr><th>Firma</th><th>İlgili kişi</th><th>İletişim</th><th>Sipariş</th><th>Açık bakiye</th><th>İşlemler</th></tr></thead><tbody>{customerPages.rows.map(c => <tr key={c.id}><td><div className="customer-name"><span className="customer-avatar">{c.name.slice(0, 2).toLocaleUpperCase('tr-TR')}</span><strong>{c.name}</strong></div></td><td>{c.contact || '—'}</td><td>{c.phone || '—'}<small>{c.email}</small></td><td>{orders.filter(o => o.customer === c.id).length} sipariş</td><td>{money((toCents(billed(c.id)) - toCents(paid(c.id))) / 100)}</td><td><RowActions label={c.name} onEdit={() => open('customers',c)} onDelete={() => requestDeletion('customers',c.id,c.name)}/></td></tr>)}</tbody></table></div> : empty(query ? 'Sonuç bulunamadı' : 'Müşteri listen burada büyüyecek', query ? 'Farklı bir arama deneyebilirsin.' : 'Birlikte çalıştığın ilk firmayı ekleyerek başlayabilirsin.', query ? undefined : () => open('customers'), 'İlk müşteriyi ekle'))}
      {page === 'orders' && (filteredOrders.length ? orderTable(orderPages.rows) : empty(orders.length ? 'Eşleşen sipariş yok' : 'Henüz sipariş eklenmedi', 'Müşteri, model, adet ve teslim tarihini ekleyerek planını oluştur.', () => open('orders'), 'Sipariş oluştur'))}
      {(page === 'production' || page === 'deliveries') && (filteredMoves.length ? <div className="table-scroll"><table><thead><tr><th>Model</th><th>Müşteri</th><th>Tarih</th><th>Adet</th><th>Durum</th><th>İşlemler</th></tr></thead><tbody>{movementPages.rows.map(m => { const o = orders.find(o => o.id === m.order)!; return <tr key={m.id}><td><button className="order-link" onClick={() => setDetailId(o.id)}>{o.model}</button><small>#{o.id.slice(0, 6).toUpperCase()}</small></td><td>{customerName(o.customer)}</td><td>{dateLabel(m.date)}</td><td>{number(m.quantity)} adet</td><td><span className="status-pill success">{page === 'production' ? 'Üretildi' : 'Teslim edildi'}</span></td><td><RowActions label={`${o.model} · ${number(m.quantity)} adet`} onEdit={() => open(page === 'production' ? 'production' : 'deliveries',m)} onDelete={() => requestDeletion(page === 'production' ? 'production' : 'deliveries',m.id,`${o.model} · ${number(m.quantity)} adet · ${dateLabel(m.date)}`)}/></td></tr> })}</tbody></table></div> : empty('Henüz hareket yok', page === 'production' ? 'Siparişlerine ait tamamlanan üretim adetlerini kaydet.' : 'Üretilen siparişler için kısmi veya tam teslimat ekle.', () => open(page), current?.action))}
      {page === 'accounts' && (filteredCustomers.length ? <><div className="table-scroll"><table><thead><tr><th>Müşteri</th><th>Sipariş tutarı</th><th>Tahsil edilen</th><th>Açık bakiye</th></tr></thead><tbody>{customerPages.rows.map(c => <tr key={c.id}><td><strong>{c.name}</strong></td><td>{money(billed(c.id))}</td><td className="positive">{money(paid(c.id))}</td><td><strong>{money((toCents(billed(c.id)) - toCents(paid(c.id))) / 100)}</strong></td></tr>)}</tbody></table></div><Pagination {...customerPages} label="Müşteri bakiyeleri"/><div className="panel-title"><h2>Son tahsilatlar</h2></div>{filteredPayments.length ? <div className="table-scroll"><table><thead><tr><th>Müşteri</th><th>Tarih</th><th>Tutar</th><th>İşlemler</th></tr></thead><tbody>{paymentPages.rows.map(p => <tr key={p.id}><td>{customerName(p.customer)}</td><td>{dateLabel(p.date)}</td><td className="positive">{money(p.amount)}</td><td><RowActions label={`${customerName(p.customer)} · ${money(p.amount)}`} onEdit={() => open('accounts',p)} onDelete={() => requestDeletion('accounts',p.id,`${customerName(p.customer)} · ${money(p.amount)} · ${dateLabel(p.date)}`)}/></td></tr>)}</tbody></table></div> : <p className="table-foot">Henüz tahsilat kaydı yok.</p>}<Pagination {...paymentPages} label="Tahsilatlar"/></> : empty('Cari hesaplar için ilk adım', 'Müşteri ve sipariş eklediğinde bakiyeler burada görünecek.', () => navigate('customers'), 'Müşterilere git'))}
      {page !== 'accounts' && <Pagination {...mainPages} label={current?.title ?? 'Kayıtlar'}/>}
    </section>}
    </>}
    <dialog ref={dialog} className="record-dialog" onCancel={event => { if (saving || photoBusy) event.preventDefault(); else setModal(null) }} aria-labelledby="record-title" onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) if (!saving && !photoBusy) setModal(null) } }}>
      {modal && <form noValidate onSubmit={submit} key={`${modal}-${editRecord?.id ?? 'new'}`}><div className="modal-head"><div><span className="eyebrow">{editRecord ? 'KAYDI DÜZENLE' : 'YENİ KAYIT'}</span><h2 id="record-title">{editRecord ? `${deleteLabels[modal]} düzenle` : config[modal].action}</h2><p>Bilgileri gir, çalışma alanına ekle.</p></div><button type="button" className="icon-button" aria-label="Kapat" disabled={saving || photoBusy} onClick={() => setModal(null)}><X size={20}/></button></div>
        <div className="record-fields">
          {modal === 'customers' ? <><Field label="Firma adı" name="name" defaultValue={defaultField('name')} required maxLength={120}/><Field label="İlgili kişi" name="contact" defaultValue={defaultField('contact')} maxLength={120}/><Field label="Telefon" name="phone" defaultValue={defaultField('phone')} type="tel" maxLength={30}/><Field label="E-posta" name="email" defaultValue={defaultField('email')} type="email" maxLength={254}/></> : <>
            {(modal === 'orders' || modal === 'accounts') && <div className="form-field full"><label htmlFor="record-customer">Müşteri *</label><select id="record-customer" name="customer" required defaultValue={defaultField('customer')}><option value="" disabled>Müşteri seçin</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{!customers.length && <p className="field-error">Önce Müşteriler bölümünden bir firma ekleyin.</p>}</div>}
            {modal === 'orders' && <><Field label="Model / ürün adı" name="model" defaultValue={defaultField('model')} required maxLength={120}/><Field label="Sipariş adedi" name="quantity" defaultValue={defaultField('quantity')} type="number" min={1} max={10000000} step={1} required/><Field label="Birim fiyat (₺)" name="price" defaultValue={defaultField('price')} inputMode="decimal" placeholder="Örn. 12,50" required/></>}
            {(modal === 'production' || modal === 'deliveries') && <><div className="form-field full"><label htmlFor="record-order">Sipariş *</label><select id="record-order" name="order" required defaultValue={defaultField('order')}><option value="" disabled>Sipariş seçin</option>{orders.filter(o => defaultField('order') === o.id || (modal === 'production' ? produced(o.id) < o.quantity : produced(o.id) > delivered(o.id))).map(o => <option key={o.id} value={o.id}>{o.model} · {customerName(o.customer)} · {modal === 'production' ? o.quantity - produced(o.id) : produced(o.id) - delivered(o.id)} adet uygun</option>)}</select><p className="helper">{modal === 'production' ? 'Üretimi tamamlanmamış siparişler listelenir.' : 'Yalnızca üretilmiş ve teslim edilmemiş adetler teslim edilebilir.'}</p></div><Field label="Adet" name="quantity" defaultValue={defaultField('quantity')} type="number" min={1} max={10000000} step={1} required/></>}
            {modal === 'accounts' && <Field label="Tahsilat tutarı (₺)" name="amount" defaultValue={defaultField('amount')} inputMode="decimal" placeholder="Örn. 250,00" required/>}
            <Field label={modal === 'orders' ? 'Planlanan teslim tarihi' : 'İşlem tarihi'} name="date" type="date" min="1900-01-01" max={modal === 'orders' ? '9999-12-31' : today()} defaultValue={String(defaultField(modal === 'orders' ? 'due' : 'date') || today())} required/>
          </>}
          {modal === 'orders' && <div className="order-extras full"><button type="button" className="order-extras-toggle" aria-expanded={extrasOpen} aria-controls="order-extra-fields" onClick={() => setExtrasOpen(!extrasOpen)}><Plus size={16}/><span>Fotoğraf, notlar ve renk / beden</span><small>İsteğe bağlı</small></button><div id="order-extra-fields" hidden={!extrasOpen}>
            <div className="form-field full"><label htmlFor="order-notes">Sipariş notları</label><textarea id="order-notes" name="notes" rows={3} maxLength={3000} defaultValue={defaultField('notes')}/></div>
            <div className="form-field full"><label htmlFor="order-photo">Model fotoğrafı</label><input id="order-photo" type="file" accept="image/png,image/jpeg,image/webp" disabled={saving || photoBusy} onChange={event => void readPhoto(event.target.files?.[0])}/><p className="helper">PNG, JPEG, WebP · En fazla 2 MB</p>{photo && <div className="photo-preview"><img src={photo} alt="Model önizlemesi"/><button type="button" className="text-button" onClick={() => setPhoto(null)}>Fotoğrafı kaldır</button></div>}</div>
            <div className="form-field full"><div className="variant-heading"><label>Renk / beden dağılımı</label><button type="button" className="text-button" disabled={variants.length >= 100} onClick={() => setVariants([...variants,{color:'',size:'',quantity:1}])}><Plus size={14}/> Satır ekle</button></div><p className="helper">İsteğe bağlı. Girilirse toplam adet sipariş adedine eşit olmalı.</p>{variants.map((variant,index) => <div className="variant-row" key={index}><input aria-label={`${index+1}. renk`} placeholder="Renk" maxLength={60} required value={variant.color} onChange={e => setVariants(variants.map((v,i) => i === index ? {...v,color:e.target.value} : v))}/><input aria-label={`${index+1}. beden`} placeholder="Beden" maxLength={30} required value={variant.size} onChange={e => setVariants(variants.map((v,i) => i === index ? {...v,size:e.target.value} : v))}/><input aria-label={`${index+1}. adet`} type="number" min={1} max={10000000} required value={variant.quantity || ''} onChange={e => setVariants(variants.map((v,i) => i === index ? {...v,quantity:Number(e.target.value)} : v))}/><button type="button" className="icon-button" aria-label={`${index+1}. dağılımı kaldır`} onClick={() => setVariants(variants.filter((_,i) => i !== index))}><X size={16}/></button></div>)}{variants.length > 0 && <p className="helper">Dağılım toplamı: {number(variants.reduce((sum,v) => sum + v.quantity,0))} adet</p>}</div>
          </div></div>}
        </div>{error && <div className="alert error" role="alert">{error}</div>}<div className="form-actions"><button type="button" className="button secondary" disabled={saving || photoBusy} onClick={() => setModal(null)}>Vazgeç</button><button className="button primary" type="submit" disabled={saving || photoBusy}>{saving ? 'Kaydediliyor…' : editRecord ? 'Değişiklikleri kaydet' : 'Kaydı ekle'} <ArrowRight size={16}/></button></div>
      </form>}
    </dialog>
    <dialog ref={deleteDialog} className="record-dialog delete-customer-dialog" aria-labelledby="delete-record-title" aria-describedby="delete-record-description" onCancel={event => { if (saving) event.preventDefault(); else setDeleting(null) }}>
      {deleting && <><div className="modal-head"><h2 id="delete-record-title">{deleteLabels[deleting.kind]} {deleteReason ? 'silinemiyor' : 'silinsin mi?'}</h2><button type="button" className="icon-button" aria-label="Kapat" disabled={saving} onClick={() => setDeleting(null)}><X size={20}/></button></div>
        <p id="delete-record-description" className="delete-description"><strong>{deleting.label}</strong><br/>{deleteReason ?? 'Bu kayıt veritabanından silinecek ve özetler yeniden hesaplanacak. Bu işlem geri alınamaz.'}</p>
        {deleteError && <div className="alert error" role="alert">{deleteError}</div>}<div className="form-actions"><button type="button" className="button secondary" autoFocus disabled={saving} onClick={() => setDeleting(null)}>{deleteReason ? 'Tamam' : 'Vazgeç'}</button>{(deleteReason || deleteError) && <button type="button" className="button primary" disabled={saving} onClick={resolveDeletion}>Bağlı kayıtlara git <ArrowRight size={16}/></button>}{!deleteReason && <button type="button" className="button danger" disabled={saving} onClick={deleteRecord}><Trash2 size={16}/> Kaydı sil</button>}</div>
      </>}
    </dialog>
    {notice && <div className="toast" role="status">{notice}<button className="icon-button" aria-label="Bildirimi kapat" onClick={() => setNotice('')}><X size={16}/></button></div>}
  </>
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div className="form-field"><label htmlFor={`record-${props.name}`}>{label}{props.required ? ' *' : ' (isteğe bağlı)'}</label><input id={`record-${props.name}`} {...props}/></div>
}
