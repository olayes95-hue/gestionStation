import React from 'react';
import {Icon} from './Icon.jsx';
export function Tag({children,color,onRemove,style,...rest}){
  const c=color||'var(--carbon-700)';
  return <span style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-2)',height:20,padding:'0 var(--sp-3)',background:'var(--carbon-200)',
    border:'1px solid var(--border-hairline)',borderLeft:'2px solid '+c,borderRadius:'var(--radius-1)',
    font:'var(--fw-medium) 11px/1 var(--font-data)',color:'var(--text-secondary)',...style}} {...rest}>
    {children}
    {onRemove&&<span onClick={onRemove} style={{cursor:'pointer',display:'inline-flex',color:'var(--text-muted)'}}><Icon name="x" size={11}/></span>}
  </span>;
}
