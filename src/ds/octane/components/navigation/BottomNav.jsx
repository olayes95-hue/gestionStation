import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function BottomNav({items=[],value,onChange,style}){
  return <nav className="oct-only-sm" style={{flex:'0 0 auto',display:'flex',alignItems:'stretch',background:'var(--carbon-000)',
    borderTop:'1px solid var(--border-default)',paddingBottom:'env(safe-area-inset-bottom)',...style}}>
    {items.slice(0,5).map(it=>{const on=it.value===value;
      return <button key={it.value} type="button" onClick={()=>onChange&&onChange(it.value)}
        style={{flex:1,minHeight:'var(--tap-min)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,
          padding:'8px 4px',background:'transparent',border:0,borderTop:'2px solid '+(on?'var(--accent)':'transparent'),cursor:'pointer',
          color:on?'var(--accent)':'var(--text-muted)'}}>
        <span style={{position:'relative',display:'flex'}}>
          <Icon name={it.icon||'circle'} size={18}/>
          {it.badge&&<span style={{position:'absolute',top:-4,right:-8,minWidth:14,height:14,padding:'0 3px',display:'flex',alignItems:'center',
            justifyContent:'center',background:'var(--state-alarm)',color:'#FFF',font:'600 9px/1 var(--font-data)'}}>{it.badge}</span>}
        </span>
        <span style={{font:'var(--fw-semibold) 9px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)'}}>{it.label}</span>
      </button>;})}
  </nav>;
}
