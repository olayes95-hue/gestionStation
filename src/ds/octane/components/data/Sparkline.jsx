import React from 'react';
export function Sparkline({data=[],width=120,height=28,color='var(--accent)',fill=true,style}){
  if(!data.length)return null;
  const max=Math.max(...data),min=Math.min(...data),span=(max-min)||1;
  const pts=data.map((v,i)=>[i/(data.length-1||1)*width,height-((v-min)/span)*(height-2)-1]);
  const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  return <svg width={width} height={height} viewBox={'0 0 '+width+' '+height} style={{display:'block',...style}} aria-hidden="true">
    {fill&&<path d={d+' L '+width+' '+height+' L 0 '+height+' Z'} fill={color} opacity=".12"/>}
    <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="miter"/>
  </svg>;
}
