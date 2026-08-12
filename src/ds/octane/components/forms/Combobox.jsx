import React from 'react';
import {Icon} from '../core/Icon.jsx';
export function Combobox({value='',onChange,options=[],placeholder,icon='search',disabled,emptyLabel='Aucun résultat',style}){
  const [open,setOpen]=React.useState(false);const [q,setQ]=React.useState(value);const box=React.useRef(null);
  React.useEffect(()=>setQ(value),[value]);
  React.useEffect(()=>{const h=e=>{if(box.current&&!box.current.contains(e.target))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[]);
  const norm=options.map(o=>typeof o==='string'?{value:o,label:o}:o);
  const hits=norm.filter(o=>!q||(o.label+' '+(o.meta||'')).toLowerCase().includes(String(q).toLowerCase()));
  return <div ref={box} style={{position:'relative',...style}}>
    <div style={{display:'flex',alignItems:'center',gap:'var(--sp-3)',height:'var(--control-h)',padding:'0 var(--sp-4)',
      background:disabled?'var(--carbon-200)':'var(--surface-field)',border:'1px solid '+(open?'var(--border-focus)':'var(--border-default)'),
      borderRadius:'var(--radius-1)',boxShadow:open?'var(--focus-ring)':'var(--well)'}}>
      <Icon name={icon} size={14} color="var(--text-muted)"/>
      <input value={q} disabled={disabled} placeholder={placeholder} onFocus={()=>setOpen(true)} onChange={e=>{setQ(e.target.value);setOpen(true)}}
        style={{flex:1,minWidth:0,background:'transparent',border:0,outline:'none',font:'400 13px/1 var(--font-ui)',color:'var(--text-primary)'}}/>
      <Icon name="chevron-down" size={13} color="var(--text-muted)"/>
    </div>
    {open&&<div style={{position:'absolute',zIndex:50,top:'calc(100% + 2px)',left:0,right:0,maxHeight:212,overflow:'auto',
      background:'var(--surface-panel)',border:'1px solid var(--border-default)',borderRadius:'var(--radius-1)',boxShadow:'var(--lift)'}}>
      {hits.length===0&&<div style={{padding:'var(--sp-5)',font:'600 10px/1 var(--font-ui)',letterSpacing:'var(--ls-micro)',textTransform:'uppercase',color:'var(--text-muted)'}}>{emptyLabel}</div>}
      {hits.map(o=><button key={o.value} type="button" onClick={()=>{setQ(o.label);setOpen(false);onChange&&onChange(o.value,o)}}
        style={{width:'100%',display:'flex',alignItems:'center',gap:'var(--sp-4)',height:'var(--row-h)',padding:'0 var(--sp-4)',textAlign:'left',
          background:'transparent',border:0,borderBottom:'1px solid var(--border-hairline)',cursor:'pointer',font:'400 12px/1 var(--font-ui)',color:'var(--text-body)'}}
        onMouseEnter={e=>e.currentTarget.style.background='var(--surface-row-hover)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        <span>{o.label}</span>{o.meta&&<span style={{marginLeft:'auto',font:'400 11px/1 var(--font-data)',color:'var(--text-muted)'}}>{o.meta}</span>}
      </button>)}
    </div>}
  </div>;
}
