import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Pencil, Trash2, ArrowUpRight } from 'lucide-react'

export default function RowActions({label,onEdit,onDelete,onView}: {label:string;onEdit:()=>void;onDelete:()=>void;onView?:()=>void}) {
  const trigger=useRef<HTMLButtonElement>(null)
  const menu=useRef<HTMLDivElement>(null)
  const [position,setPosition]=useState<{left:number;top:number}|null>(null)
  function close(focus=false) {setPosition(null);if(focus)trigger.current?.focus()}
  function toggle() {
    if(position) {close();return}
    const rect=trigger.current!.getBoundingClientRect()
    const height=onView?142:100
    setPosition({left:Math.max(8,Math.min(rect.right-170,window.innerWidth-178)),top:rect.bottom+height<window.innerHeight?rect.bottom+6:Math.max(8,rect.top-height)})
  }
  useEffect(() => {
    if(!position)return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const outside=(event:PointerEvent) => {if(!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node))close()}
    const moved=(event:Event) => {if(!menu.current?.contains(event.target as Node))close()}
    document.addEventListener('pointerdown',outside)
    window.addEventListener('resize',moved)
    window.addEventListener('scroll',moved,true)
    return () => {document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',moved);window.removeEventListener('scroll',moved,true)}
  },[position])
  const act=(callback:()=>void) => {close(true);callback()}
  return <><button ref={trigger} className="icon-button row-menu-trigger" aria-label={`${label} işlemleri`} aria-haspopup="menu" aria-expanded={!!position} onClick={toggle}><MoreHorizontal size={20}/></button>{position && createPortal(<div ref={menu} className="row-action-menu" role="menu" aria-label={`${label} işlemleri`} style={position} onKeyDown={event => {
    const buttons=Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('button'))
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement)
    if(event.key==='Escape'){event.preventDefault();close(true)}
    if(event.key==='ArrowDown' || event.key==='ArrowUp'){event.preventDefault();buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus()}
    if(event.key==='Home'){event.preventDefault();buttons[0].focus()}
    if(event.key==='End'){event.preventDefault();buttons[buttons.length-1].focus()}
    if(event.key==='Tab')close(true)
  }}>{onView && <button role="menuitem" onClick={() => act(onView)}><ArrowUpRight size={15}/> Detayı görüntüle</button>}<button role="menuitem" onClick={() => act(onEdit)}><Pencil size={15}/> Düzenle</button><button role="menuitem" className="danger-action" onClick={() => act(onDelete)}><Trash2 size={15}/> Sil</button></div>,document.body)}</>
}
