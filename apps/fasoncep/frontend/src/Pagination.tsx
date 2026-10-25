import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pagination } from './pageMath'

export function usePagination<T>(rows:T[],resetKey:string) {
  const [state,setState]=useState({key:resetKey,page:1,size:10})
  const info=pagination(rows.length,state.key===resetKey?state.page:1,state.size)
  useEffect(()=>{
    if(state.key!==resetKey || state.page!==info.page)setState(previous=>({...previous,key:resetKey,page:info.page}))
  },[resetKey,state.key,state.page,info.page])
  return {...info,rows:rows.slice(info.offset,info.offset+info.pageSize),
    setPage:(page:number)=>setState(previous=>({...previous,key:resetKey,page})),
    setSize:(size:number)=>setState({key:resetKey,page:1,size})}
}
type Props=ReturnType<typeof pagination>&{setPage:(page:number)=>void;setSize:(size:number)=>void;label:string}
export default function Pagination({page,pageSize,pageCount,start,end,total,numbers,setPage,setSize,label}:Props) {
  if(!total)return null
  return <div className="pagination-bar"><span className="pagination-count" aria-live="polite">{total.toLocaleString('tr-TR')} kayıttan {start}–{end}</span><div className="pagination-controls"><label className="pagination-size">Sayfada<select aria-label={`${label}: sayfadaki kayıt sayısı`} value={pageSize} onChange={e=>setSize(Number(e.target.value))}>{[10,20,50].map(size=><option key={size} value={size}>{size}</option>)}</select></label><nav aria-label={`${label} sayfaları`} className="pagination-pages"><button className="pagination-arrow" aria-label={`${label}: önceki sayfa`} disabled={page===1} onClick={()=>setPage(page-1)}><ChevronLeft size={16}/></button>{numbers.map((number,index)=><span className="pagination-number-wrap" key={number}>{index>0&&number>numbers[index-1]+1&&<span className="pagination-ellipsis" aria-hidden="true">…</span>}<button aria-label={`${label}: ${number}. sayfa`} aria-current={number===page?'page':undefined} onClick={()=>setPage(number)}>{number}</button></span>)}<button className="pagination-arrow" aria-label={`${label}: sonraki sayfa`} disabled={page===pageCount} onClick={()=>setPage(page+1)}><ChevronRight size={16}/></button></nav></div></div>
}
