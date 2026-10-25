export function orderStatus(quantity:number,produced:number,delivered:number) {
  if(delivered>=quantity)return {label:'Tamamlandı',tone:'complete'}
  if(produced>=quantity)return {label:'Teslime hazır',tone:'ready'}
  if(produced>0)return {label:'Üretimde',tone:'production'}
  return {label:'Yeni',tone:'new'}
}
export function isLate(due:string,today:string,quantity:number,delivered:number) {
  return delivered<quantity && due<today
}
