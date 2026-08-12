import React from 'react';
export function Textarea({value,onChange,placeholder,rows=4,invalid,disabled,mono,style,...rest}){
  const [foc,setFoc]=React.useState(false);
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} disabled={disabled}
    onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
    style={{width:'100%',padding:'var(--sp-4)',resize:'vertical',background:disabled?'var(--carbon-200)':'var(--surface-field)',
      border:'1px solid '+(invalid?'var(--state-alarm)':foc?'var(--border-focus)':'var(--border-default)'),borderRadius:'var(--radius-1)',
      boxShadow:foc?'var(--focus-ring)':'var(--well)',outline:'none',color:disabled?'var(--text-disabled)':'var(--text-primary)',
      font:mono?'400 12px/1.5 var(--font-data)':'400 13px/1.45 var(--font-ui)',transition:'var(--t-control)',...style}} {...rest}/>;
}
