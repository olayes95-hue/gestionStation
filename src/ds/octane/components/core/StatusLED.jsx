import React from 'react';
const C={ok:'var(--state-ok)',warn:'var(--state-warn)',alarm:'var(--state-alarm)',info:'var(--state-info)',idle:'var(--text-disabled)'};
export function StatusLED({state='idle',label,blink,size=8,style}){
  const c=C[state]||C.idle;
  return <span style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-3)',...style}}>
    <span style={{width:size,height:size,borderRadius:'var(--radius-full)',background:c,boxShadow:'0 0 6px '+c+', inset 0 0 0 1px rgba(0,0,0,.45)',
      animation:blink?'octane-blink 1s steps(1,end) infinite':'none',flex:'0 0 auto'}}/>
    {label&&<span style={{font:'var(--fw-semibold) 11px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:'var(--text-secondary)'}}>{label}</span>}
  </span>;
}
