import React from 'react';
import {Icon} from '../core/Icon.jsx';
import {Select} from '../forms/Select.jsx';
export function Pagination({page=1,pageCount=1,total,pageSize=50,onPage,onPageSize,style}){
  const btn=(icon,to,dis)=><button type="button" disabled={dis} onClick={()=>onPage&&onPage(to)}
    style={{width:24,height:24,display:'inline-flex',alignItems:'center',justifyContent:'center',background:'var(--carbon-300)',
      border:'1px solid var(--border-default)',borderRadius:'var(--radius-1)',color:dis?'var(--text-disabled)':'var(--text-secondary)',cursor:dis?'not-allowed':'pointer'}}>
    <Icon name={icon} size={13}/></button>;
  return <div style={{display:'flex',alignItems:'center',gap:'var(--sp-5)',height:32,padding:'0 var(--sp-5)',background:'var(--surface-raised)',
    borderTop:'1px solid var(--border-hairline)',font:'400 11px/1 var(--font-data)',color:'var(--text-muted)',...style}}>
    {total!=null&&<span>{total.toLocaleString('fr-FR').replace(/\u202f|,/g,' ')} lignes</span>}
    <span style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-3)'}}>
      <span className="eyebrow">Par page</span>
      <Select size="sm" value={String(pageSize)} onChange={e=>onPageSize&&onPageSize(Number(e.target.value))} options={['25','50','100','250']}/>
    </span>
    <span style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:'var(--sp-3)'}}>
      {btn('chevrons-left',1,page<=1)}{btn('chevron-left',page-1,page<=1)}
      <span style={{color:'var(--text-primary)',padding:'0 var(--sp-3)'}}>{page} / {pageCount}</span>
      {btn('chevron-right',page+1,page>=pageCount)}{btn('chevrons-right',pageCount,page>=pageCount)}
    </span>
  </div>;
}
