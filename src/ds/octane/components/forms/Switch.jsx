import React from 'react';
export function Switch({checked,onChange,label,disabled,style}){
  return <label style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-4)',cursor:disabled?'not-allowed':'pointer',...style}} onClick={()=>!disabled&&onChange&&onChange(!checked)}>
    <span style={{width:32,height:16,padding:1,display:'inline-flex',alignItems:'center',flex:'0 0 auto',
      background:checked?'var(--switch-track-on)':'var(--carbon-300)',border:'1px solid '+(checked?'var(--state-ok)':'var(--border-default)'),
      borderRadius:'var(--radius-1)',boxShadow:'var(--well)',opacity:disabled?.5:1,transition:'var(--t-control)'}}>
      <span style={{width:12,height:12,background:checked?'var(--state-ok)':'var(--carbon-600)',borderRadius:'1px',
        transform:'translateX('+(checked?16:0)+'px)',transition:'transform var(--dur-fast) var(--ease-sharp)'}}/>
    </span>
    {label&&<span style={{font:'400 12px/1 var(--font-ui)',color:disabled?'var(--text-disabled)':'var(--text-body)'}}>{label}</span>}
  </label>;
}
