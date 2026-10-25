import type { OperationData } from './operationTypes'
import { istanbulToday } from './schedule.ts'

// Browser-only fixtures. Never seeded into a database or saved in browser storage.
export function createDemoData(workshop: number, day = istanbulToday()): OperationData {
  const relative=(offset:number)=>{
    const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+offset)
    return date.toISOString().slice(0,10)
  }
  const prefix=`demo${workshop}`
  const customers=Array.from({length:4},(_,i)=>({id:`${prefix}-customer-${i}`,name:['Örnek Moda','Örnek Giyim','Örnek Tekstil','Örnek Tasarım'][i],contact:'Örnek yetkili',phone:'',email:`ornek${i+1}@example.invalid`}))
  const orders:OperationData['orders']=[], production:OperationData['production']=[], deliveries:OperationData['deliveries']=[]
  const models=workshop===1?['Basic tişört','Polo yaka tişört','Pamuklu tunik','Oversize sweatshirt']:['Keten gömlek','İş önlüğü','Poplin bluz','Dokuma pantolon']
  for(let i=0;i<14;i++) {
    const id=`D${workshop}${String(i+1).padStart(4,'0')}`
    const quantity=200+(i%4)*100+(workshop===2?50:0)
    const stage=i%4
    const made=stage===0?0:stage===1?quantity/2:quantity
    const sent=stage===3?quantity:stage===2?quantity/2:0
    const color=['Lacivert','Beyaz','Mavi'][i%3]
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" rx="24" fill="#EFF6FF"/><path d="m80 50-45 35 25 40 20-12v87h80v-87l20 12 25-40-45-35-20 15h-40Z" fill="${i%3===1?'#FFFFFF':i%3===0?'#182D54':'#2563EB'}" stroke="#64748B" stroke-width="3"/><path d="M100 50q20 30 40 0" fill="none" stroke="#64748B" stroke-width="3"/></svg>`
    orders.push({id,customer:customers[i%4].id,model:`${models[i%4]} · ${i+1}`,quantity,price:workshop===1?45+(i%3)*10:75+(i%3)*15,due:relative([-2,0,2,5][i%4]),notes:'Örnek sipariş: etiket, dikiş ve paket kontrolü teslimattan önce yapılacak.',photo:`data:image/svg+xml,${encodeURIComponent(svg)}`,variants:[{color,size:'M',quantity:quantity/2},{color,size:'L',quantity:quantity/2}]})
    if(made)production.push({id:`${prefix}-production-${i}`,order:id,quantity:made,date:relative(-3)})
    if(sent)deliveries.push({id:`${prefix}-delivery-${i}`,order:id,quantity:sent,date:relative(-1)})
  }
  const payments=customers.map((customer,i)=>({id:`${prefix}-payment-${i}`,customer:customer.id,amount:workshop===1?2000+i*500:3000+i*500,date:relative(-1)}))
  return {customers,orders,production,deliveries,payments}
}
