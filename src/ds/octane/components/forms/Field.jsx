import React from 'react';
export function Field({label,hint,error,required,children,style}){
  return <label style={{display:'flex',flexDirection:'column',gap:'var(--sp-2)',...style}}>
    {label&&<span style={{font:'var(--fw-semibold) 11px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:'var(--text-muted)'}}>
      {label}{required&&<span style={{color:'var(--accent)'}}> *</span>}</span>}
    {children}
    {(error||hint)&&<span style={{font:'400 11px/1.3 var(--font-ui)',color:error?'var(--state-alarm)':'var(--text-muted)'}}>{error||hint}</span>}
  </label>;
}
