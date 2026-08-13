import React from 'react';
import {Icon} from './Icon.jsx';
const RULE={none:null,ok:'var(--state-ok)',warn:'var(--state-warn)',alarm:'var(--state-alarm)',info:'var(--state-info)',accent:'var(--accent)'};
export function Panel({title,meta,actions,children,status='none',flush,scroll,style,bodyStyle,sectionRef,...rest}){
  const rule=RULE[status];
  return <section ref={sectionRef} style={{display:'flex',flexDirection:'column',minHeight:0,background:'var(--surface-panel)',border:'var(--border-panel)',borderRadius:'var(--radius-1)',
      borderTop:rule?'var(--bw-accent) solid '+rule:'var(--border-panel)',...style}} {...rest}>
    {(title||actions)&&<header style={{display:'flex',alignItems:'center',gap:'var(--sp-4)',height:'32px',flex:'0 0 auto',padding:'0 var(--sp-5)',background:'var(--surface-raised)',borderBottom:'1px solid var(--border-hairline)'}}>
      <span style={{font:'var(--fw-semibold) 11px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:'var(--text-primary)'}}>{title}</span>
      {meta&&<span style={{font:'400 11px/1 var(--font-data)',color:'var(--text-muted)'}}>{meta}</span>}
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'var(--sp-2)'}}>{actions}</div>
    </header>}
    <div style={{flex:'1 1 auto',minHeight:0,padding:flush?0:'var(--gutter-panel)',overflow:scroll?'auto':'visible',...bodyStyle}}>{children}</div>
  </section>;
}
export function PanelEmpty({icon='inbox',label}){
  return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'var(--sp-4)',padding:'var(--sp-9) 0',color:'var(--text-muted)',
    backgroundImage:'repeating-linear-gradient(0deg,var(--grid-line) 0 1px,transparent 1px 24px),repeating-linear-gradient(90deg,var(--grid-line) 0 1px,transparent 1px 24px)'}}>
    <Icon name={icon} size={20}/><span style={{font:'var(--fw-semibold) 11px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)'}}>{label||'Aucune donnée'}</span>
  </div>;
}
