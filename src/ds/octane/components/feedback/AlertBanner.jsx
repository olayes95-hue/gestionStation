import React from 'react';
import {Icon} from '../core/Icon.jsx';
const T={alarm:['var(--state-alarm)','var(--state-alarm-bg)','octagon-alert'],warn:['var(--state-warn)','var(--state-warn-bg)','triangle-alert'],
  info:['var(--state-info)','var(--state-info-bg)','info'],ok:['var(--state-ok)','var(--state-ok-bg)','check']};
export function AlertBanner({tone='info',title,children,action,timestamp,onDismiss,style}){
  const [c,bg,ic]=T[tone]||T.info;
  return <div role="alert" style={{display:'flex',alignItems:'flex-start',gap:'var(--sp-5)',padding:'var(--sp-5)',background:bg,border:'1px solid '+c,
    borderLeft:'var(--bw-accent) solid '+c,borderRadius:'var(--radius-1)',...style}}>
    <span style={{color:c,display:'flex',paddingTop:1}}><Icon name={ic} size={16}/></span>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:'flex',alignItems:'baseline',gap:'var(--sp-4)'}}>
        <span style={{font:'var(--fw-semibold) 12px/1.2 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:c}}>{title}</span>
        {timestamp&&<span style={{font:'400 11px/1 var(--font-data)',color:'var(--text-muted)'}}>{timestamp}</span>}
      </div>
      {children&&<div style={{marginTop:'var(--sp-3)',font:'400 12px/1.45 var(--font-ui)',color:'var(--text-body)'}}>{children}</div>}
    </div>
    {action}
    {onDismiss&&<span onClick={onDismiss} style={{cursor:'pointer',color:'var(--text-muted)',display:'flex'}}><Icon name="x" size={14}/></span>}
  </div>;
}
