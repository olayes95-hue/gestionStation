import React from 'react';
export function Radio({checked,onChange,label,value,disabled,style}){
  return <label style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-4)',cursor:disabled?'not-allowed':'pointer',...style}} onClick={()=>!disabled&&onChange&&onChange(value)}>
    <span style={{width:14,height:14,borderRadius:'var(--radius-full)',flex:'0 0 auto',display:'inline-flex',alignItems:'center',justifyContent:'center',
      background:'var(--surface-field)',border:'1px solid '+(checked?'var(--accent)':'var(--border-default)'),boxShadow:'var(--well)',opacity:disabled?.5:1}}>
      {checked&&<span style={{width:6,height:6,borderRadius:'var(--radius-full)',background:'var(--accent)',boxShadow:'0 0 6px var(--accent)'}}/>}
    </span>
    {label&&<span style={{font:'400 12px/1 var(--font-ui)',color:disabled?'var(--text-disabled)':'var(--text-body)'}}>{label}</span>}
  </label>;
}
