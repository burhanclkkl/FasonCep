import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, ArrowRight, TriangleAlert } from 'lucide-react'
import type { Order, Movement, Customer } from './operationTypes'
import { dueBucket, istanbulToday } from './schedule'

type Bucket = 'late' | 'today' | 'week' | 'later'
const labels: Record<Bucket,string> = {late:'Geciken',today:'Bugün',week:'Bu hafta',later:'Sonraki tarihler'}
export default function DeliveryCalendar({orders,deliveries,customers,onOpen}: {orders:Order[];deliveries:Movement[];customers:Customer[];onOpen:(id:string)=>void}) {
  const [today,setToday] = useState(istanbulToday)
  const [bucket,setBucket] = useState<Bucket>('today')
  const [selectedDate,setSelectedDate] = useState('')
  const [month,setMonth] = useState(today.slice(0,7))
  useEffect(() => {const timer=setInterval(() => setToday(istanbulToday()),60000);return () => clearInterval(timer)},[])
  const remaining = (o:Order) => o.quantity-deliveries.filter(m => m.order === o.id).reduce((sum,m) => sum+m.quantity,0)
  const pending = orders.filter(o => remaining(o)>0).sort((a,b) => a.due.localeCompare(b.due))
  const counts = (key:Bucket) => pending.filter(o => dueBucket(o.due,today)===key).length
  const visible = pending.filter(o => selectedDate ? o.due===selectedDate : dueBucket(o.due,today)===bucket)
  const first = new Date(`${month}-01T12:00:00Z`)
  const days = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate()
  const offset = (first.getUTCDay()+6)%7
  function changeMonth(step:number) { const date=new Date(first);date.setUTCMonth(date.getUTCMonth()+step);if(date.getUTCFullYear()>=1900 && date.getUTCFullYear()<=9999)setMonth(date.toISOString().slice(0,7)) }
  return <section className="panel delivery-calendar">
    <div className="calendar-heading"><div className="list-title"><CalendarDays size={19}/><h2>Teslim takvimi</h2></div>{counts('late')>0 && <span className="late-warning"><TriangleAlert size={14}/>{counts('late')} sipariş gecikti</span>}</div>
    <div className="calendar-layout"><div className="month-calendar"><div className="month-heading"><button className="icon-button" aria-label="Önceki ay" onClick={() => changeMonth(-1)}><ChevronLeft size={16}/></button><strong>{first.toLocaleDateString('tr-TR',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button className="icon-button" aria-label="Sonraki ay" onClick={() => changeMonth(1)}><ChevronRight size={16}/></button></div><div className="month-grid">{['Pt','Sa','Ça','Pe','Cu','Ct','Pa'].map(day => <span className="week-day" key={day}>{day}</span>)}{Array.from({length:offset},(_,i) => <span key={`blank-${i}`}/>)}{Array.from({length:days},(_,i) => {const date=`${month}-${String(i+1).padStart(2,'0')}`;const count=pending.filter(o => o.due===date).length;return <button key={date} className={`calendar-day ${date===today?'is-today':''} ${selectedDate===date?'selected':''} ${count && date<today?'overdue':''}`} aria-pressed={selectedDate===date} aria-label={`${date}, ${count} bekleyen sipariş`} onClick={() => setSelectedDate(date)}>{i+1}{count>0 && <span className="day-dot"/>}</button>})}</div><p className="calendar-caption">Noktalı günlerde bekleyen teslimat var.</p></div>
    <div className="calendar-agenda"><div className="calendar-tabs" role="group" aria-label="Teslim tarihine göre filtrele">{(Object.keys(labels) as Bucket[]).map(key => <button key={key} className={!selectedDate && bucket===key?'active':''} aria-pressed={!selectedDate && bucket===key} onClick={() => {setBucket(key);setSelectedDate('')}}>{labels[key]} <span>{counts(key)}</span></button>)}</div>{selectedDate && <div className="selected-date"><span>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('tr-TR')} teslimleri</span><button className="text-button" onClick={() => setSelectedDate('')}>Filtreyi kaldır</button></div>}<p className="calendar-caption">Bu hafta: bugünden sonra pazar gününe kadar. Tamamlanan teslimatlar listelenmez.</p><div className="agenda-list">{visible.length ? visible.map(order => <button className="agenda-item" key={order.id} onClick={() => onOpen(order.id)}><span className={`agenda-date ${order.due<today?'late':''}`}>{new Date(`${order.due}T12:00:00`).toLocaleDateString('tr-TR',{day:'2-digit',month:'short'})}</span><span><strong>{order.model}</strong><small>{customers.find(c => c.id===order.customer)?.name} · {remaining(order).toLocaleString('tr-TR')} adet kaldı</small></span><ArrowRight size={15}/></button>) : <div className="agenda-empty"><CalendarDays size={24}/><p>Bu tarih aralığında bekleyen teslimat yok.</p></div>}</div></div></div>
  </section>
}
