import React from 'react';
export function PrintSheet({title,subtitle,station,reference,meta=[],children,footer,style}){
  return <div style={{width:'210mm',minHeight:'297mm',margin:'0 auto',padding:'16mm 14mm',background:'#FFFFFF',color:'#000000',
    border:'1px solid var(--border-hairline)',font:'400 11px/1.5 var(--font-data)',...style}}>
    <header style={{display:'flex',alignItems:'flex-start',gap:'12mm',paddingBottom:'4mm',borderBottom:'2px solid #000'}}>
      <div style={{flex:1}}>
        <div style={{font:'700 18px/1 var(--font-ui)',letterSpacing:'.16em',textTransform:'uppercase'}}>OCTANE</div>
        <div style={{marginTop:4,font:'400 10px/1.4 var(--font-data)'}}>{station}</div>
      </div>
      <div style={{textAlign:'right'}}>
        <div style={{font:'700 14px/1.2 var(--font-ui)',textTransform:'uppercase',letterSpacing:'.08em'}}>{title}</div>
        {subtitle&&<div style={{marginTop:2,font:'400 10px/1.3 var(--font-data)'}}>{subtitle}</div>}
        {reference&&<div style={{marginTop:2,font:'400 10px/1.3 var(--font-data)'}}>{reference}</div>}
      </div>
    </header>
    {meta.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4mm',padding:'4mm 0',borderBottom:'1px solid #000'}}>
      {meta.map(m=><div key={m.label}><div style={{font:'600 8px/1 var(--font-ui)',letterSpacing:'.14em',textTransform:'uppercase'}}>{m.label}</div>
        <div style={{marginTop:2,font:'500 12px/1 var(--font-data)'}}>{m.value}</div></div>)}
    </div>}
    <div style={{padding:'6mm 0'}}>{children}</div>
    <footer style={{marginTop:'auto',paddingTop:'4mm',borderTop:'1px solid #000',display:'flex',justifyContent:'space-between',font:'400 9px/1.4 var(--font-data)'}}>
      <span>{footer}</span><span>Document généré par OCTANE — non contractuel sans signature</span>
    </footer>
  </div>;
}
export function PrintTable({columns=[],rows=[],footer}){
  return <table style={{width:'100%',borderCollapse:'collapse',font:'400 10px/1.4 var(--font-data)'}}>
    <thead><tr>{columns.map(c=><th key={c.key} style={{textAlign:c.align||'left',padding:'2mm 1mm',borderBottom:'1px solid #000',
      font:'600 8px/1 var(--font-ui)',letterSpacing:'.14em',textTransform:'uppercase'}}>{c.header}</th>)}</tr></thead>
    <tbody>{rows.map((r,i)=><tr key={r.id??i}>{columns.map(c=><td key={c.key} style={{textAlign:c.align||'left',padding:'1.6mm 1mm',
      borderBottom:'1px solid #C8C8C8'}}>{c.render?c.render(r):r[c.key]}</td>)}</tr>)}</tbody>
    {footer&&<tfoot><tr>{columns.map(c=><td key={c.key} style={{textAlign:c.align||'left',padding:'2mm 1mm',borderTop:'2px solid #000',
      font:'600 11px/1 var(--font-data)'}}>{footer[c.key]??''}</td>)}</tr></tfoot>}
  </table>;
}
