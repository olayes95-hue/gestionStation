import React from 'react';
export function Toolbar({left,right,children,dense,style}){
  return <div className="oct-toolbar" style={{display:'flex',alignItems:'center',flexWrap:'wrap',rowGap:'var(--sp-3)',gap:'var(--sp-4)',
    minHeight:dense?32:'var(--topbar-h)',padding:'var(--sp-2) var(--sp-5)',
    background:'var(--surface-raised)',borderBottom:'1px solid var(--border-hairline)',...style}}>
    {left}{children}<div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'var(--sp-4)'}}>{right}</div>
  </div>;
}
export function ToolbarDivider(){return <span style={{width:1,height:18,background:'var(--border-hairline)'}}/>;}
