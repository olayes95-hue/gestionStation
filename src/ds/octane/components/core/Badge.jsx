import React from 'react';
const T={ok:['var(--state-ok)','var(--state-ok-bg)'],warn:['var(--state-warn)','var(--state-warn-bg)'],alarm:['var(--state-alarm)','var(--state-alarm-bg)'],info:['var(--state-info)','var(--state-info-bg)'],idle:['var(--text-muted)','var(--state-idle-bg)'],accent:['var(--accent)','var(--accent-quiet)']};
export function Badge({children,tone='idle',solid,style,...rest}){
  const [fg,bg]=T[tone]||T.idle;
  return <span style={{display:'inline-flex',alignItems:'center',height:18,padding:'0 var(--sp-3)',background:solid?fg:bg,color:solid?'#FFFFFF':fg,
    border:'1px solid '+(solid?fg:'color-mix(in srgb,'+fg+' 40%,transparent)'),borderRadius:'var(--radius-1)',
    font:'var(--fw-semibold) 10px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',whiteSpace:'nowrap',...style}} {...rest}>{children}</span>;
}
