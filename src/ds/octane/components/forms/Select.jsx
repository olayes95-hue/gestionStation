import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function Select({value,onChange,options=[],disabled,size='md',style,...rest}){
  const h=size==='sm'?'var(--control-h-sm)':size==='lg'?'var(--control-h-lg)':'var(--control-h)';
  return <div style={{position:'relative',display:'inline-flex',alignItems:'center',height:h,background:disabled?'var(--carbon-200)':'var(--surface-field)',
    border:'1px solid var(--border-default)',borderRadius:'var(--radius-1)',boxShadow:'var(--well)',...style}}>
    <select value={value} onChange={onChange} disabled={disabled}
      style={{appearance:'none',background:'transparent',border:0,outline:'none',width:'100%',height:'100%',padding:'0 26px 0 var(--sp-4)',
        color:disabled?'var(--text-disabled)':'var(--text-primary)',font:'400 13px/1 var(--font-ui)',cursor:disabled?'not-allowed':'pointer'}} {...rest}>
      {options.map(o=>{const v=typeof o==='string'?o:o.value,l=typeof o==='string'?o:o.label;return <option key={v} value={v} style={{background:'var(--carbon-200)'}}>{l}</option>;})}
    </select>
    <span style={{position:'absolute',right:6,pointerEvents:'none',color:'var(--text-muted)',display:'flex'}}><Icon name="chevron-down" size={13}/></span>
  </div>;
}
