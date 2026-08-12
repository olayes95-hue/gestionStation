import React from 'react';
import {Icon} from './Icon.jsx';
const TONE={
  primary:{bg:'var(--accent)',fg:'var(--text-inverse)',bd:'var(--signal-orange-deep)',hover:'var(--accent-hover)',press:'var(--accent-press)'},
  neutral:{bg:'var(--carbon-300)',fg:'var(--text-primary)',bd:'var(--border-default)',hover:'var(--carbon-400)',press:'var(--carbon-200)'},
  ghost:{bg:'transparent',fg:'var(--text-secondary)',bd:'transparent',hover:'var(--carbon-300)',press:'var(--carbon-200)'},
  outline:{bg:'transparent',fg:'var(--text-primary)',bd:'var(--border-default)',hover:'var(--carbon-300)',press:'var(--carbon-200)'},
  danger:{bg:'var(--signal-red)',fg:'#FFFFFF',bd:'var(--signal-red-deep)',hover:'var(--signal-red-deep)',press:'var(--signal-red-deep)'}
};
const SIZE={sm:{h:'var(--control-h-sm)',px:'var(--sp-4)',fs:'var(--fs-caption)',ic:13},md:{h:'var(--control-h)',px:'var(--sp-5)',fs:'var(--fs-label)',ic:14},lg:{h:'var(--control-h-lg)',px:'var(--sp-6)',fs:'var(--fs-body)',ic:16}};
export function Button({children,tone='neutral',size='md',icon,iconRight,disabled,block,active,type='button',style,...rest}){
  const t=TONE[tone]||TONE.neutral, s=SIZE[size]||SIZE.md;
  const [h,setH]=React.useState(false),[p,setP]=React.useState(false);
  const bg=disabled?'var(--carbon-200)':p||active?t.press:h?t.hover:t.bg;
  return (
    <button type={type} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>{setH(false);setP(false)}} onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)}
      style={{display:block?'flex':'inline-flex',width:block?'100%':'auto',alignItems:'center',justifyContent:'center',gap:'var(--sp-3)',height:s.h,padding:'0 '+s.px,
        font:'var(--fw-semibold) '+ (s.fs==='var(--fs-caption)'?'11px':s.fs==='var(--fs-label)'?'12px':'13px') +'/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',
        color:disabled?'var(--text-disabled)':t.fg,background:bg,border:'1px solid '+(disabled?'var(--carbon-400)':t.bd),borderRadius:'var(--radius-1)',
        cursor:disabled?'not-allowed':'pointer',transition:'var(--t-control)',boxShadow:tone==='primary'&&!disabled?'var(--edge-top)':'none',whiteSpace:'nowrap',...style}} {...rest}>
      {icon&&<Icon name={icon} size={s.ic}/>}{children}{iconRight&&<Icon name={iconRight} size={s.ic}/>}
    </button>
  );
}
