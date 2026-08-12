import React from 'react';
export function BarChart({data=[],height=180,unit='',stacked,style}){
  const max=Math.max(1,...data.map(d=>d.series?d.series.reduce((a,s)=>a+s.value,0):d.value));
  const ticks=[0,.25,.5,.75,1].map(t=>Math.round(max*t));
  return <div style={{display:'flex',gap:'var(--sp-4)',...style}}>
    <div style={{display:'flex',flexDirection:'column-reverse',justifyContent:'space-between',height,
      font:'400 10px/1 var(--font-data)',color:'var(--text-muted)',textAlign:'right'}}>
      {ticks.map(t=><span key={t}>{t.toLocaleString('fr-FR').replace(/\u202f|,/g,' ')}</span>)}
    </div>
    <div style={{flex:1,position:'relative',height,borderLeft:'1px solid var(--border-default)',borderBottom:'1px solid var(--border-default)',
      backgroundImage:'repeating-linear-gradient(0deg,var(--grid-line) 0 1px,transparent 1px '+(height/4)+'px)'}}>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'flex-end',gap:'var(--sp-4)',padding:'0 var(--sp-4)'}}>
        {data.map((d,i)=><div key={i} style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',height:'100%',gap:1}}>
          {(d.series||[{value:d.value,color:d.color||'var(--accent)'}]).map((s,j)=>
            <div key={j} title={s.label} style={{height:(s.value/max*100)+'%',background:s.color||'var(--accent)',transition:'height var(--dur-slow) var(--ease-sharp)'}}/>)}
        </div>)}
      </div>
    </div>
    <div style={{position:'absolute'}}/>
    <div style={{display:'none'}}>{unit}</div>
  </div>;
}
export function BarChartLegend({items=[],style}){
  return <div style={{display:'flex',flexWrap:'wrap',gap:'var(--sp-6)',...style}}>
    {items.map(i=><span key={i.label} style={{display:'inline-flex',alignItems:'center',gap:'var(--sp-3)',
      font:'var(--fw-semibold) 10px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:'var(--text-muted)'}}>
      <span style={{width:10,height:10,background:i.color}}/>{i.label}</span>)}
  </div>;
}
