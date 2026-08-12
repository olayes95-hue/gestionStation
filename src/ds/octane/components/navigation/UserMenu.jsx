import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function UserMenu({name,role,items=[],onSelect,style}){
  const [open,setOpen]=React.useState(false);const box=React.useRef(null);
  React.useEffect(()=>{const h=e=>{if(box.current&&!box.current.contains(e.target))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[]);
  const initials=(name||'').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();
  return <div ref={box} style={{position:'relative',...style}}>
    <button type="button" onClick={()=>setOpen(!open)} style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-4)',height:30,padding:'0 var(--sp-3)',
      background:open?'var(--carbon-300)':'transparent',border:'1px solid '+(open?'var(--border-default)':'transparent'),borderRadius:'var(--radius-1)',cursor:'pointer'}}>
      <span style={{width:22,height:22,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'var(--carbon-999)',color:'var(--carbon-000)',
        font:'600 10px/1 var(--font-data)',letterSpacing:'.04em'}}>{initials}</span>
      <span style={{textAlign:'left',display:'flex',flexDirection:'column',gap:2}}>
        <span style={{font:'var(--fw-semibold) 11px/1 var(--font-ui)',color:'var(--text-primary)'}}>{name}</span>
        <span style={{font:'400 9px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:'var(--text-muted)'}}>{role}</span>
      </span>
      <Icon name="chevron-down" size={12} color="var(--text-muted)"/>
    </button>
    {open&&<div style={{position:'absolute',right:0,top:'calc(100% + 4px)',minWidth:200,zIndex:60,background:'var(--surface-panel)',
      border:'1px solid var(--border-default)',borderTop:'var(--bw-accent) solid var(--accent)',borderRadius:'var(--radius-1)',boxShadow:'var(--lift)'}}>
      {items.map(it=><button key={it.value} type="button" onClick={()=>{setOpen(false);onSelect&&onSelect(it.value)}}
        style={{width:'100%',display:'flex',alignItems:'center',gap:'var(--sp-4)',height:'var(--row-h)',padding:'0 var(--sp-5)',textAlign:'left',
          background:'transparent',border:0,borderBottom:'1px solid var(--border-hairline)',cursor:'pointer',
          font:'400 12px/1 var(--font-ui)',color:it.danger?'var(--state-alarm)':'var(--text-body)'}}
        onMouseEnter={e=>e.currentTarget.style.background='var(--surface-row-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <Icon name={it.icon||'circle'} size={13}/>{it.label}</button>)}
    </div>}
  </div>;
}
