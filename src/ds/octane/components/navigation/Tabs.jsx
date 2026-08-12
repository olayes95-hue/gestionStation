import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function Tabs({items=[],value,onChange,style}){
  return <div role="tablist" style={{display:'flex',alignItems:'stretch',gap:0,borderBottom:'1px solid var(--border-default)',background:'var(--surface-raised)',...style}}>
    {items.map(it=>{const v=typeof it==='string'?it:it.value,l=typeof it==='string'?it:it.label,on=v===value;
      return <button key={v} role="tab" aria-selected={on} onClick={()=>onChange&&onChange(v)}
        style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-3)',height:32,padding:'0 var(--sp-6)',background:on?'var(--surface-panel)':'transparent',
          border:0,borderRight:'1px solid var(--border-hairline)',boxShadow:on?'inset 0 -2px 0 var(--accent)':'none',cursor:'pointer',
          font:'var(--fw-semibold) 11px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',
          color:on?'var(--text-primary)':'var(--text-muted)',transition:'var(--t-control)'}}>
        {it.icon&&<Icon name={it.icon} size={13}/>}{l}
        {it.count!=null&&<span style={{font:'500 10px/1 var(--font-data)',color:'var(--text-muted)',letterSpacing:0}}>{it.count}</span>}
      </button>;})}
  </div>;
}
