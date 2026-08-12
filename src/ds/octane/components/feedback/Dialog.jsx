import React from 'react';
import {IconButton} from '../core/IconButton.jsx';
export function Dialog({open=true,title,meta,children,footer,width=460,onClose,tone,style}){
  if(!open)return null;
  return <div style={{position:'fixed',inset:0,zIndex:80,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--scrim)',backdropFilter:'blur(1px)'}} onClick={onClose}>
    <div role="dialog" onClick={e=>e.stopPropagation()} style={{width,maxWidth:'92vw',background:'var(--surface-panel)',border:'1px solid var(--border-default)',
      borderTop:'var(--bw-accent) solid '+(tone?'var(--state-'+tone+')':'var(--accent)'),borderRadius:'var(--radius-1)',boxShadow:'var(--lift)',...style}}>
      <header style={{display:'flex',alignItems:'center',gap:'var(--sp-4)',height:36,padding:'0 var(--sp-5)',background:'var(--surface-raised)',borderBottom:'1px solid var(--border-hairline)'}}>
        <span style={{font:'var(--fw-semibold) 12px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:'var(--text-primary)'}}>{title}</span>
        {meta&&<span style={{font:'400 11px/1 var(--font-data)',color:'var(--text-muted)'}}>{meta}</span>}
        <span style={{marginLeft:'auto'}}><IconButton icon="x" size="sm" title="Fermer" onClick={onClose}/></span>
      </header>
      <div style={{padding:'var(--sp-6)',font:'400 13px/1.45 var(--font-ui)',color:'var(--text-body)'}}>{children}</div>
      {footer&&<footer style={{display:'flex',justifyContent:'flex-end',gap:'var(--sp-4)',padding:'var(--sp-5)',background:'var(--carbon-050)',borderTop:'1px solid var(--border-hairline)'}}>{footer}</footer>}
    </div>
  </div>;
}
