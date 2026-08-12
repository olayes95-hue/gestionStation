import React from 'react';
export function Tooltip({label,children,placement='top',style}){
  const [on,setOn]=React.useState(false);
  const pos=placement==='bottom'?{top:'calc(100% + 6px)'}:placement==='right'?{left:'calc(100% + 6px)',top:'50%',transform:'translateY(-50%)'}:{bottom:'calc(100% + 6px)'};
  return <span style={{position:'relative',display:'inline-flex',...style}} onMouseEnter={()=>setOn(true)} onMouseLeave={()=>setOn(false)}>
    {children}
    {on&&<span style={{position:'absolute',zIndex:70,whiteSpace:'nowrap',padding:'3px var(--sp-4)',background:'var(--carbon-999)',border:'1px solid var(--carbon-999)',color:'var(--carbon-000)',
      borderRadius:'var(--radius-1)',font:'400 11px/1.3 var(--font-data)',pointerEvents:'none',...pos}}>{label}</span>}
  </span>;
}
