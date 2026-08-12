import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function Breadcrumb({items=[],onNavigate,style}){
  return <nav style={{display:'flex',alignItems:'center',gap:'var(--sp-3)',font:'var(--fw-semibold) 11px/1 var(--font-ui)',
    textTransform:'uppercase',letterSpacing:'var(--ls-label)',...style}}>
    {items.map((it,i)=>{const last=i===items.length-1;
      return <React.Fragment key={it.label}>
        {i>0&&<Icon name="chevron-right" size={12} color="var(--text-disabled)"/>}
        <span onClick={()=>!last&&onNavigate&&onNavigate(it.value??it.label)}
          style={{cursor:last?'default':'pointer',color:last?'var(--text-primary)':'var(--text-muted)'}}>{it.label}</span>
      </React.Fragment>;})}
  </nav>;
}
