import React from 'react';
import {Icon} from '../core/Icon.jsx';
import {Checkbox} from '../forms/Checkbox.jsx';
export function DataTable({columns=[],rows=[],dense,selectedId,onRowClick,zebra=true,footer,
  sortKey,sortDir='asc',onSort,selectable,selectedIds=[],onSelectionChange,rowStatus}){
  const h=dense?'var(--row-h-dense)':'var(--row-h)';
  const ids=rows.map(r=>r.id);
  const allOn=selectable&&ids.length>0&&ids.every(i=>selectedIds.includes(i));
  const someOn=selectable&&!allOn&&ids.some(i=>selectedIds.includes(i));
  const toggle=(id)=>onSelectionChange&&onSelectionChange(selectedIds.includes(id)?selectedIds.filter(x=>x!==id):[...selectedIds,id]);
  const th={position:'sticky',top:0,zIndex:1,height:26,background:'var(--surface-raised)',borderBottom:'1px solid var(--border-default)',
    font:'var(--fw-semibold) 10px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:'var(--text-muted)',whiteSpace:'nowrap'};
  return <div style={{width:'100%',overflow:'auto'}}>
    <table style={{width:'100%',borderCollapse:'collapse',font:'400 12px/1 var(--font-ui)'}}>
      <thead><tr>
        {selectable&&<th style={{...th,width:32,padding:'0 0 0 var(--sp-5)'}}>
          <Checkbox checked={allOn} indeterminate={someOn} onChange={()=>onSelectionChange&&onSelectionChange(allOn?[]:ids)}/></th>}
        {columns.map(c=>{const on=sortKey===c.key;
          return <th key={c.key} onClick={()=>c.sortable&&onSort&&onSort(c.key,on&&sortDir==='asc'?'desc':'asc')}
            data-optional={c.optional} style={{...th,padding:'0 var(--sp-5)',textAlign:c.align||'left',width:c.width,cursor:c.sortable?'pointer':'default',color:on?'var(--text-primary)':th.color,
              boxShadow:on?'inset 0 -2px 0 var(--accent)':'none',userSelect:'none'}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:4,justifyContent:c.align==='right'?'flex-end':'flex-start',width:'100%'}}>
              {c.header}{c.sortable&&<Icon name={on?(sortDir==='asc'?'arrow-up':'arrow-down'):'chevrons-up-down'} size={11} color={on?'var(--accent)':'var(--text-disabled)'}/>}
            </span></th>;})}
      </tr></thead>
      <tbody>{rows.map((r,i)=>{
        const sel=selectedId!=null&&r.id===selectedId;
        const checked=selectable&&selectedIds.includes(r.id);
        const base=sel||checked?'var(--surface-row-selected)':zebra&&i%2?'color-mix(in srgb,var(--text-primary) 3%,transparent)':'transparent';
        const st=rowStatus&&rowStatus(r);
        return <tr key={r.id??i} onClick={()=>onRowClick&&onRowClick(r)}
          style={{background:base,boxShadow:sel?'inset 3px 0 0 var(--accent)':st?'inset 3px 0 0 var(--state-'+st+')':'none',cursor:onRowClick?'pointer':'default'}}
          onMouseEnter={e=>{if(!sel&&!checked)e.currentTarget.style.background='var(--surface-row-hover)'}}
          onMouseLeave={e=>{if(!sel&&!checked)e.currentTarget.style.background=base}}>
          {selectable&&<td style={{height:h,padding:'0 0 0 var(--sp-5)',borderBottom:'1px solid var(--border-hairline)'}} onClick={e=>{e.stopPropagation();toggle(r.id)}}>
            <Checkbox checked={checked} onChange={()=>toggle(r.id)}/></td>}
          {columns.map(c=><td key={c.key} data-optional={c.optional} style={{height:h,padding:'0 var(--sp-5)',textAlign:c.align||'left',borderBottom:'1px solid var(--border-hairline)',
            color:c.muted?'var(--text-muted)':'var(--text-body)',whiteSpace:'nowrap',
            font:c.numeric?'500 12px/1 var(--font-data)':'400 12px/1 var(--font-ui)',fontVariantNumeric:'tabular-nums'}}>
            {c.render?c.render(r):r[c.key]}</td>)}
        </tr>;})}</tbody>
      {footer&&<tfoot><tr>{selectable&&<td style={{background:'var(--surface-raised)',borderTop:'1px solid var(--border-default)'}}/>}
        {columns.map(c=><td key={c.key} data-optional={c.optional} style={{height:'var(--row-h)',padding:'0 var(--sp-5)',textAlign:c.align||'left',background:'var(--surface-raised)',
        borderTop:'1px solid var(--border-default)',color:'var(--text-primary)',font:c.numeric?'600 12px/1 var(--font-data)':'var(--fw-semibold) 11px/1 var(--font-ui)',
        textTransform:c.numeric?'none':'uppercase',letterSpacing:c.numeric?'0':'var(--ls-label)'}}>{footer[c.key]??''}</td>)}</tr></tfoot>}
    </table>
  </div>;
}
