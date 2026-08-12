import React from 'react';
import {Icon} from './Icon.jsx';
const S={sm:{b:'var(--control-h-sm)',i:14},md:{b:'var(--control-h)',i:16},lg:{b:'var(--control-h-lg)',i:18}};
export function IconButton({icon,size='md',tone='ghost',active,disabled,title,style,...rest}){
  const s=S[size]||S.md;const [h,setH]=React.useState(false);
  const bg=disabled?'transparent':active?'var(--accent-quiet)':h?'var(--carbon-300)':tone==='solid'?'var(--carbon-200)':'transparent';
  return <button type="button" title={title} aria-label={title||icon} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{width:s.b,height:s.b,display:'inline-flex',alignItems:'center',justifyContent:'center',background:bg,
      border:'1px solid '+(tone==='solid'||active?'var(--border-default)':'transparent'),borderRadius:'var(--radius-1)',
      color:disabled?'var(--text-disabled)':active?'var(--accent)':h?'var(--text-primary)':'var(--text-secondary)',cursor:disabled?'not-allowed':'pointer',transition:'var(--t-control)',...style}} {...rest}>
    <Icon name={icon} size={s.i}/>
  </button>;
}
