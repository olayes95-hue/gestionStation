import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function Stepper({steps=[],current=0,onStep,style}){
  return <div style={{display:'flex',alignItems:'stretch',border:'1px solid var(--border-hairline)',background:'var(--surface-panel)',...style}}>
    {steps.map((s,i)=>{const done=i<current,on=i===current;
      const label=typeof s==='string'?s:s.label;
      return <button key={label} type="button" onClick={()=>onStep&&onStep(i)}
        style={{flex:1,display:'flex',alignItems:'center',gap:'var(--sp-4)',height:40,padding:'0 var(--sp-5)',cursor:onStep?'pointer':'default',
          background:on?'var(--accent-quiet)':'transparent',border:0,borderRight:i<steps.length-1?'1px solid var(--border-hairline)':0,
          boxShadow:on?'inset 0 -2px 0 var(--accent)':'none',textAlign:'left'}}>
        <span style={{width:20,height:20,flex:'0 0 auto',display:'inline-flex',alignItems:'center',justifyContent:'center',
          background:done?'var(--state-ok)':on?'var(--accent)':'var(--carbon-300)',border:'1px solid '+(done?'var(--state-ok)':on?'var(--accent)':'var(--border-default)'),
          color:done||on?'#FFFFFF':'var(--text-muted)',font:'600 10px/1 var(--font-data)'}}>
          {done?<Icon name="check" size={12} strokeWidth={3}/>:i+1}</span>
        <span style={{font:'var(--fw-semibold) 11px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',
          color:on?'var(--text-primary)':done?'var(--text-secondary)':'var(--text-muted)'}}>{label}</span>
      </button>;})}
  </div>;
}
