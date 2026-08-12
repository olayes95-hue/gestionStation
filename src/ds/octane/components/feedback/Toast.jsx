import React from 'react';
import {Icon} from '../core/Icon.jsx';
const C={ok:'var(--state-ok)',warn:'var(--state-warn)',alarm:'var(--state-alarm)',info:'var(--state-info)'};
export function Toast({tone='info',title,message,onDismiss,style}){
  const c=C[tone]||C.info;
  return <div style={{display:'flex',alignItems:'flex-start',gap:'var(--sp-4)',minWidth:280,maxWidth:380,padding:'var(--sp-5)',background:'var(--surface-raised)',
    border:'1px solid var(--border-default)',borderLeft:'var(--bw-accent) solid '+c,borderRadius:'var(--radius-1)',boxShadow:'var(--lift)',...style}}>
    <span style={{color:c,display:'flex',paddingTop:1}}><Icon name={tone==='ok'?'check':tone==='alarm'?'octagon-alert':tone==='warn'?'triangle-alert':'info'} size={15}/></span>
    <div style={{flex:1,minWidth:0}}>
      <div style={{font:'var(--fw-semibold) 12px/1.2 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:'var(--text-primary)'}}>{title}</div>
      {message&&<div style={{marginTop:3,font:'400 12px/1.4 var(--font-ui)',color:'var(--text-secondary)'}}>{message}</div>}
    </div>
    {onDismiss&&<span onClick={onDismiss} style={{cursor:'pointer',color:'var(--text-muted)',display:'flex'}}><Icon name="x" size={13}/></span>}
  </div>;
}
export function ToastStack({children,style}){
  return <div style={{position:'fixed',right:'var(--sp-6)',bottom:'calc(var(--statusbar-h) + var(--sp-6))',display:'flex',flexDirection:'column',gap:'var(--sp-4)',zIndex:60,...style}}>{children}</div>;
}
