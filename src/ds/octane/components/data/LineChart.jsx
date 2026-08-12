import React from 'react';
export function LineChart({series=[],labels=[],height=200,width=640,unit='',style}){
  const all=series.flatMap(s=>s.data);
  const max=Math.max(1,...all),min=Math.min(0,...all),span=(max-min)||1;
  const pad={l:52,r:8,t:8,b:20};
  const iw=width-pad.l-pad.r,ih=height-pad.t-pad.b;
  const x=i=>pad.l+(i/((labels.length||series[0]?.data.length||2)-1))*iw;
  const y=v=>pad.t+ih-((v-min)/span)*ih;
  const ticks=[0,.25,.5,.75,1].map(t=>min+span*t);
  return <div style={style}>
    <svg width="100%" viewBox={'0 0 '+width+' '+height} style={{display:'block'}}>
      {ticks.map((t,i)=><g key={i}>
        <line x1={pad.l} x2={width-pad.r} y1={y(t)} y2={y(t)} stroke="var(--border-hairline)" strokeWidth="1"/>
        <text x={pad.l-8} y={y(t)+3} textAnchor="end" style={{font:'400 10px var(--font-data)',fill:'var(--text-muted)'}}>{Math.round(t).toLocaleString('fr-FR').replace(/\u202f|,/g,' ')}</text>
      </g>)}
      {series.map(s=><polyline key={s.label} fill="none" stroke={s.color||'var(--accent)'} strokeWidth="1.75" strokeLinejoin="miter"
        points={s.data.map((v,i)=>x(i)+','+y(v)).join(' ')}/>)}
      {labels.map((l,i)=><text key={i} x={x(i)} y={height-6} textAnchor="middle" style={{font:'400 10px var(--font-data)',fill:'var(--text-muted)'}}>{l}</text>)}
    </svg>
  </div>;
}
