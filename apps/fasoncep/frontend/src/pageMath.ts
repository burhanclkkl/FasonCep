export function pagination(total:number, requestedPage=1, size=10) {
  const pageSize = [10,20,50].includes(size) ? size : 10
  const count = Math.max(0, Math.trunc(total) || 0)
  const pageCount = Math.max(1,Math.ceil(count/pageSize))
  const page = Math.min(pageCount,Math.max(1,Math.trunc(requestedPage) || 1))
  const offset=(page-1)*pageSize
  const numbers=Array.from(new Set([1,...Array.from({length:5},(_,i)=>page+i-2),pageCount])).filter(n=>n>=1&&n<=pageCount).sort((a,b)=>a-b)
  return {page,pageSize,pageCount,offset,start:count?offset+1:0,end:Math.min(offset+pageSize,count),total:count,numbers}
}
