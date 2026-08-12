import React from 'react';
import {Icon} from '../core/Icon.jsx';
const D={up:'var(--state-ok)',down:'var(--state-alarm)',flat:'var(--text-muted)'};
export function MetricTile({label,value,unit,delta,direction='flat',status,sub,style}){
  return <div style={{display:'flex',flexDirection:'column',gap:'var(--sp-3)',padding:'var(--sp-5)',background:'var(--surface-panel)',
    border:'var(--border-panel)',borderRadius:'var(--radius-1)',borderLeft:status?'var(--bw-accent) solid var(--state-'+status+')':'var(--border-panel)',...style}}>
    <span style={{font:'var(--fw-semibold) 10px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:'var(--text-muted)'}}>{label}</span>
    <div style={{display:'flex',alignItems:'baseline',gap:'var(--sp-3)'}}>
      <span style={{font:'600 28px/1 var(--font-data)',letterSpacing:'-.02em',whiteSpace:'nowrap',color:'var(--text-primary)',fontVariantNumeric:'tabular-nums'}}>{value}</span>
      {unit&&<span style={{font:'500 12px/1 var(--font-data)',color:'var(--text-muted)'}}>{unit}</span>}
    </div>
    <div style={{display:'flex',alignItems:'center',gap:'var(--sp-3)',minHeight:12}}>
      {delta&&<span style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-1)',font:'500 11px/1 var(--font-data)',color:D[direction]}}>
        <Icon name={direction==='up'?'trending-up':direction==='down'?'trending-down':'minus'} size={12}/>{delta}</span>}
      {sub&&<span style={{font:'400 11px/1 var(--font-ui)',color:'var(--text-muted)'}}>{sub}</span>}
    </div>
  </div>;
}
