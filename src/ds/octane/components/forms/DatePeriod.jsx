import React from 'react';
import {Icon} from '../core/Icon.jsx';
const PRESETS=[{value:'jour',label:"Aujourd'hui"},{value:'hier',label:'Hier'},{value:'7j',label:'7 jours'},{value:'30j',label:'30 jours'},{value:'mois',label:'Ce mois'},{value:'perso',label:'Personnalisé'}];
export function DatePeriod({value='jour',onChange,from,to,onRangeChange,disabled,style}){
  const custom=value==='perso';
  const dateStyle={height:'var(--control-h)',padding:'0 var(--sp-4)',background:'var(--surface-field)',border:'1px solid var(--border-default)',
    borderRadius:'var(--radius-1)',boxShadow:'var(--well)',outline:'none',color:'var(--text-primary)',font:'500 12px/1 var(--font-data)',colorScheme:'light'};
  return <div style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-4)',...style}}>
    <div style={{display:'inline-flex',border:'1px solid var(--border-default)',borderRadius:'var(--radius-1)',overflow:'hidden'}}>
      {PRESETS.map(p=><button key={p.value} type="button" disabled={disabled} onClick={()=>onChange&&onChange(p.value)}
        style={{height:'var(--control-h)',padding:'0 var(--sp-5)',border:0,borderRight:'1px solid var(--border-hairline)',cursor:'pointer',
          background:p.value===value?'var(--accent-quiet)':'var(--carbon-300)',color:p.value===value?'var(--accent)':'var(--text-secondary)',
          font:'var(--fw-semibold) 11px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',transition:'var(--t-control)'}}>{p.label}</button>)}
    </div>
    {custom&&<div style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-3)'}}>
      <Icon name="calendar" size={14} color="var(--text-muted)"/>
      <input type="date" value={from||''} onChange={e=>onRangeChange&&onRangeChange(e.target.value,to)} style={dateStyle}/>
      <span style={{color:'var(--text-muted)',font:'400 12px/1 var(--font-data)'}}>→</span>
      <input type="date" value={to||''} onChange={e=>onRangeChange&&onRangeChange(from,e.target.value)} style={dateStyle}/>
    </div>}
  </div>;
}
