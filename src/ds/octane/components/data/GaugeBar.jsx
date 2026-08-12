import React from 'react';
export function GaugeBar({value=0,max=100,label,valueLabel,tone,threshold,segments=40,height=10,style}){
  const pct=Math.max(0,Math.min(1,value/max));
  const auto=pct<.15?'alarm':pct<.3?'warn':'ok';
  const c='var(--state-'+(tone||auto)+')';
  return <div style={{display:'flex',flexDirection:'column',gap:'var(--sp-2)',...style}}>
    {(label||valueLabel)&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
      <span style={{font:'var(--fw-semibold) 10px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:'var(--text-muted)'}}>{label}</span>
      <span style={{font:'500 11px/1 var(--font-data)',color:'var(--text-primary)'}}>{valueLabel}</span></div>}
    <div style={{position:'relative',height,background:'var(--surface-sunken)',border:'1px solid var(--border-hairline)',boxShadow:'var(--well)'}}>
      <div style={{position:'absolute',inset:0,width:(pct*100)+'%',background:c,
        maskImage:'repeating-linear-gradient(90deg,#000 0 '+(100/segments*.72)+'%,transparent '+(100/segments*.72)+'% '+(100/segments)+'%)',
        WebkitMaskImage:'repeating-linear-gradient(90deg,#000 0 '+(100/segments*.72)+'%,transparent '+(100/segments*.72)+'% '+(100/segments)+'%)',
        maskSize:(100/pct)+'% 100%',WebkitMaskSize:(100/pct)+'% 100%',transition:'width var(--dur-slow) var(--ease-sharp)'}}/>
      {threshold!=null&&<div style={{position:'absolute',top:-2,bottom:-2,left:(threshold/max*100)+'%',width:1,background:'var(--state-warn)'}}/>}
    </div>
  </div>;
}
