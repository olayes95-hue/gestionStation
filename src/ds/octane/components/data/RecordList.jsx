import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function RecordList({columns=[],rows=[],onRowClick,selectedId,titleKey,metaKey,rowStatus,style}){
  return <div style={{display:'flex',flexDirection:'column',...style}}>
    {rows.map((r,i)=>{
      const sel=selectedId!=null&&r.id===selectedId;const st=rowStatus&&rowStatus(r);
      const rest=columns.filter(c=>c.key!==titleKey&&c.key!==metaKey);
      return <button key={r.id??i} type="button" onClick={()=>onRowClick&&onRowClick(r)}
        style={{textAlign:'left',display:'flex',flexDirection:'column',gap:'var(--sp-3)',minHeight:'var(--tap-min)',padding:'var(--sp-5)',
          background:sel?'var(--surface-row-selected)':'transparent',border:0,borderBottom:'1px solid var(--border-hairline)',
          boxShadow:sel?'inset 3px 0 0 var(--accent)':st?'inset 3px 0 0 var(--state-'+st+')':'none',cursor:onRowClick?'pointer':'default'}}>
        <div style={{display:'flex',alignItems:'baseline',gap:'var(--sp-4)'}}>
          <span style={{font:'var(--fw-semibold) 13px/1.2 var(--font-ui)',color:'var(--text-primary)'}}>{titleKey?r[titleKey]:''}</span>
          {metaKey&&<span style={{marginLeft:'auto',font:'500 12px/1 var(--font-data)',color:'var(--text-secondary)',fontVariantNumeric:'tabular-nums'}}>{r[metaKey]}</span>}
          {onRowClick&&<Icon name="chevron-right" size={14} color="var(--text-disabled)"/>}
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'var(--sp-3) var(--sp-6)'}}>
          {rest.map(c=><span key={c.key} style={{display:'inline-flex',alignItems:'baseline',gap:'var(--sp-2)'}}>
            <span style={{font:'var(--fw-semibold) 9px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:'var(--text-muted)'}}>{c.header}</span>
            <span style={{font:c.numeric?'500 12px/1 var(--font-data)':'400 12px/1 var(--font-ui)',color:'var(--text-body)',fontVariantNumeric:'tabular-nums'}}>
              {c.render?c.render(r):r[c.key]}</span></span>)}
        </div>
      </button>;})}
  </div>;
}
