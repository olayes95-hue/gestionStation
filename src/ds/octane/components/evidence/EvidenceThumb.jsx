import React from 'react';
import {Icon} from '../core/Icon.jsx';
const ST={pending:['warn','À vérifier'],valid:['ok','Validée'],rejected:['alarm','Rejetée'],none:[null,null]};
export function EvidenceThumb({src,label,timestamp,author,status='pending',size=96,onClick,onRemove,style}){
  const [tone,stLabel]=ST[status]||ST.none;
  return <figure style={{margin:0,width:size,display:'flex',flexDirection:'column',gap:'var(--sp-2)',...style}}>
    <div onClick={onClick} style={{position:'relative',height:size,background:'var(--surface-sunken)',cursor:onClick?'zoom-in':'default',
      border:'1px solid var(--border-default)',borderTop:tone?'var(--bw-accent) solid var(--state-'+tone+')':'1px solid var(--border-default)',
      overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
      {src?<img src={src} alt={label||''} style={{width:'100%',height:'100%',objectFit:'cover',display:'block',filter:'saturate(.85) contrast(1.05)'}}/>
        :<Icon name="image" size={18} color="var(--text-disabled)"/>}
      {onRemove&&<button type="button" onClick={e=>{e.stopPropagation();onRemove()}} title="Retirer"
        style={{position:'absolute',top:2,right:2,width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',
          background:'var(--carbon-999)',color:'var(--carbon-000)',border:0,cursor:'pointer'}}><Icon name="x" size={11}/></button>}
    </div>
    <figcaption style={{display:'flex',flexDirection:'column',gap:1}}>
      {label&&<span style={{font:'var(--fw-semibold) 9px/1.2 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',
        color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span>}
      {timestamp&&<span style={{font:'400 9px/1.2 var(--font-data)',color:'var(--text-muted)'}}>{timestamp}</span>}
      {author&&<span style={{font:'400 9px/1.2 var(--font-data)',color:'var(--text-muted)'}}>{author}</span>}
      {stLabel&&<span style={{font:'var(--fw-semibold) 9px/1.2 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:'var(--state-'+tone+')'}}>{stLabel}</span>}
    </figcaption>
  </figure>;
}
export function EvidenceStrip({items=[],size=96,onOpen,style}){
  return <div style={{display:'flex',flexWrap:'wrap',gap:'var(--sp-5)',...style}}>
    {items.map((it,i)=><EvidenceThumb key={it.id??i} src={it.src} label={it.label} timestamp={it.timestamp}
      author={it.author} status={it.status} size={size} onClick={()=>onOpen&&onOpen(it,i)} onRemove={it.onRemove}/>)}
  </div>;
}
