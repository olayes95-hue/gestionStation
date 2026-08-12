import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function NumericStepper({value=0,onChange,step=1,min,max,suffix,disabled,decimals=0,style}){
  const clamp=n=>{if(min!=null&&n<min)n=min;if(max!=null&&n>max)n=max;return n;};
  const fmt=n=>Number(n).toFixed(decimals).replace('.',',');
  const bump=d=>!disabled&&onChange&&onChange(clamp(Number(value)+d*step));
  const btn={width:26,height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--carbon-300)',
    border:0,borderLeft:'1px solid var(--border-default)',color:disabled?'var(--text-disabled)':'var(--text-secondary)',cursor:disabled?'not-allowed':'pointer'};
  return <div style={{display:'inline-flex',alignItems:'stretch',height:'var(--control-h)',background:'var(--surface-field)',
    border:'1px solid var(--border-default)',borderRadius:'var(--radius-1)',boxShadow:'var(--well)',overflow:'hidden',...style}}>
    <button type="button" onClick={()=>bump(-1)} disabled={disabled} style={{...btn,borderLeft:0,borderRight:'1px solid var(--border-default)'}}><Icon name="minus" size={13}/></button>
    <input value={fmt(value)} onChange={e=>onChange&&onChange(Number(String(e.target.value).replace(',','.'))||0)} disabled={disabled}
      style={{width:88,minWidth:0,textAlign:'right',padding:'0 var(--sp-4)',background:'transparent',border:0,outline:'none',
        font:'500 13px/1 var(--font-data)',fontVariantNumeric:'tabular-nums',color:disabled?'var(--text-disabled)':'var(--text-primary)'}}/>
    {suffix&&<span style={{display:'flex',alignItems:'center',paddingRight:'var(--sp-3)',font:'500 11px/1 var(--font-data)',color:'var(--text-muted)'}}>{suffix}</span>}
    <button type="button" onClick={()=>bump(1)} disabled={disabled} style={btn}><Icon name="plus" size={13}/></button>
  </div>;
}
