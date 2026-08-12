import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function Checkbox({checked,indeterminate,onChange,label,disabled,style}){
  return <label style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-4)',cursor:disabled?'not-allowed':'pointer',...style}} onClick={e=>{if(!disabled&&onChange){e.preventDefault();onChange(!checked)}}}>
    <span style={{width:14,height:14,display:'inline-flex',alignItems:'center',justifyContent:'center',flex:'0 0 auto',
      background:checked||indeterminate?'var(--accent)':'var(--surface-field)',border:'1px solid '+(checked||indeterminate?'var(--signal-orange-deep)':'var(--border-default)'),
      borderRadius:'var(--radius-1)',color:'#FFFFFF',boxShadow:checked?'none':'var(--well)',opacity:disabled?.5:1,transition:'var(--t-control)'}}>
      {indeterminate?<span style={{width:8,height:2,background:'var(--carbon-000)'}}/>:checked?<Icon name="check" size={11} strokeWidth={3}/>:null}
    </span>
    {label&&<span style={{font:'400 12px/1 var(--font-ui)',color:disabled?'var(--text-disabled)':'var(--text-body)'}}>{label}</span>}
  </label>;
}
