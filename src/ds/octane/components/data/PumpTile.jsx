import React from 'react';
import {StatusLED} from '../core/StatusLED.jsx';
import {Icon} from '../core/Icon.jsx';
const LBL={free:['idle','Libre'],dispensing:['ok','En service'],authorized:['info','Autorisée'],fault:['alarm','Défaut'],offline:['idle','Hors ligne']};
export function PumpTile({id,grade,gradeColor,state='free',volume,amount,nozzle,selected,onClick,style}){
  const [s,label]=LBL[state]||LBL.free;
  return <button type="button" onClick={onClick} style={{textAlign:'left',display:'flex',flexDirection:'column',gap:'var(--sp-4)',padding:'var(--sp-5)',cursor:'pointer',
    background:selected?'var(--surface-row-selected)':'var(--surface-panel)',border:'1px solid '+(selected?'var(--border-focus)':'var(--border-hairline)'),
    borderTop:'var(--bw-accent) solid '+(gradeColor||'var(--carbon-500)'),borderRadius:'var(--radius-1)',
    boxShadow:state==='fault'?'var(--glow-alarm)':'none',transition:'var(--t-control)',...style}}>
    <div style={{display:'flex',alignItems:'center',gap:'var(--sp-4)'}}>
      <span style={{font:'700 15px/1 var(--font-data)',color:'var(--text-primary)'}}>P{id}</span>
      <span style={{font:'var(--fw-semibold) 10px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:gradeColor||'var(--text-secondary)'}}>{grade}</span>
      <span style={{marginLeft:'auto'}}><StatusLED state={s} blink={state==='fault'}/></span>
    </div>
    <div style={{display:'flex',alignItems:'baseline',gap:'var(--sp-3)'}}>
      <span style={{font:'600 22px/1 var(--font-data)',color:state==='dispensing'?'var(--state-ok)':'var(--text-primary)',whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{volume??'0,00'}</span>
      <span style={{font:'500 11px/1 var(--font-data)',color:'var(--text-muted)'}}>L</span>
      <span style={{marginLeft:'auto',font:'500 13px/1 var(--font-data)',color:'var(--text-secondary)'}}>{amount??'0'} F</span>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:'var(--sp-3)',paddingTop:'var(--sp-3)',borderTop:'1px solid var(--border-hairline)',
      font:'var(--fw-semibold) 10px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:'var(--text-muted)'}}>
      <Icon name="fuel" size={12}/>{label}{nozzle&&<span style={{marginLeft:'auto',fontFamily:'var(--font-data)',letterSpacing:0}}>{nozzle}</span>}
    </div>
  </button>;
}
