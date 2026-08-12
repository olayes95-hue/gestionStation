import React from 'react';
import {IconButton} from '../core/IconButton.jsx';
export function Drawer({open,title,meta,children,footer,width=420,onClose,status,style}){
  if(!open)return null;
  return <div style={{position:'fixed',inset:0,zIndex:70,display:'flex',justifyContent:'flex-end',background:'var(--scrim)'}} onClick={onClose}>
    <aside onClick={e=>e.stopPropagation()} style={{width,maxWidth:'92vw',height:'100%',display:'flex',flexDirection:'column',
      background:'var(--surface-panel)',borderLeft:'1px solid var(--border-default)',boxShadow:'var(--lift)',...style}}>
      <header style={{flex:'0 0 auto',display:'flex',alignItems:'center',gap:'var(--sp-4)',height:'var(--topbar-h)',padding:'0 var(--sp-5)',
        background:'var(--surface-raised)',borderBottom:'1px solid var(--border-hairline)',
        boxShadow:status?'inset 0 3px 0 var(--state-'+status+')':'none'}}>
        <span style={{font:'var(--fw-semibold) 12px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:'var(--text-primary)'}}>{title}</span>
        {meta&&<span style={{font:'400 11px/1 var(--font-data)',color:'var(--text-muted)'}}>{meta}</span>}
        <span style={{marginLeft:'auto'}}><IconButton icon="x" title="Fermer" onClick={onClose}/></span>
      </header>
      <div style={{flex:1,minHeight:0,overflow:'auto',padding:'var(--sp-6)'}}>{children}</div>
      {footer&&<footer style={{flex:'0 0 auto',display:'flex',justifyContent:'flex-end',gap:'var(--sp-4)',padding:'var(--sp-5)',
        background:'var(--carbon-050)',borderTop:'1px solid var(--border-hairline)'}}>{footer}</footer>}
    </aside>
  </div>;
}
export function DrawerRow({label,value,mono=true,status}){
  return <div style={{display:'flex',alignItems:'baseline',gap:'var(--sp-5)',padding:'var(--sp-4) 0',borderBottom:'1px solid var(--border-hairline)'}}>
    <span style={{flex:'0 0 40%',font:'var(--fw-semibold) 10px/1.3 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:'var(--text-muted)'}}>{label}</span>
    <span style={{flex:1,textAlign:'right',font:mono?'500 12px/1.3 var(--font-data)':'400 12px/1.4 var(--font-ui)',
      color:status?'var(--state-'+status+')':'var(--text-primary)',fontVariantNumeric:'tabular-nums'}}>{value}</span>
  </div>;
}
