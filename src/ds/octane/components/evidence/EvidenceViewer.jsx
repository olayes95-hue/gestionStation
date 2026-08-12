import React from 'react';
import {Icon} from '../core/Icon.jsx';
import {IconButton} from '../core/IconButton.jsx';
import {Button} from '../core/Button.jsx';
export function EvidenceViewer({open,item,index,count,onPrev,onNext,onClose,onValidate,onReject,fields=[],style}){
  const [zoom,setZoom]=React.useState(1);
  React.useEffect(()=>setZoom(1),[item]);
  if(!open||!item)return null;
  return <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:90,display:'flex',flexDirection:'column',background:'var(--scrim)',...style}}>
    <div onClick={e=>e.stopPropagation()} style={{margin:'auto',display:'flex',maxWidth:'92vw',maxHeight:'92vh',
      background:'var(--surface-panel)',border:'1px solid var(--border-default)',borderTop:'var(--bw-accent) solid var(--accent)',boxShadow:'var(--lift)'}}>
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',alignItems:'center',gap:'var(--sp-4)',height:'var(--topbar-h)',padding:'0 var(--sp-5)',
          background:'var(--surface-raised)',borderBottom:'1px solid var(--border-hairline)'}}>
          <span style={{font:'var(--fw-semibold) 12px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:'var(--text-primary)'}}>{item.label||'Pièce jointe'}</span>
          <span style={{font:'400 11px/1 var(--font-data)',color:'var(--text-muted)'}}>{index!=null&&count?(index+1)+' / '+count:''}</span>
          <span style={{marginLeft:'auto',display:'flex',gap:'var(--sp-2)'}}>
            <IconButton icon="zoom-out" size="sm" title="Réduire" onClick={()=>setZoom(z=>Math.max(1,z-.25))}/>
            <IconButton icon="zoom-in" size="sm" title="Agrandir" onClick={()=>setZoom(z=>Math.min(4,z+.25))}/>
            <IconButton icon="download" size="sm" title="Télécharger"/>
            <IconButton icon="x" size="sm" title="Fermer" onClick={onClose}/>
          </span>
        </div>
        <div style={{position:'relative',flex:1,minHeight:320,minWidth:420,overflow:'auto',display:'flex',alignItems:'center',justifyContent:'center',
          background:'var(--surface-sunken)',
          backgroundImage:'repeating-linear-gradient(0deg,var(--grid-line) 0 1px,transparent 1px 24px),repeating-linear-gradient(90deg,var(--grid-line) 0 1px,transparent 1px 24px)'}}>
          {item.src?<img src={item.src} alt={item.label||''} style={{transform:'scale('+zoom+')',transformOrigin:'center',maxWidth:'60vw',maxHeight:'62vh',display:'block'}}/>
            :<span style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'var(--sp-4)',color:'var(--text-muted)'}}>
              <Icon name="image-off" size={22}/><span className="eyebrow">Image indisponible</span></span>}
          {onPrev&&<span style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)'}}><IconButton icon="chevron-left" tone="solid" title="Précédente" onClick={onPrev}/></span>}
          {onNext&&<span style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)'}}><IconButton icon="chevron-right" tone="solid" title="Suivante" onClick={onNext}/></span>}
        </div>
      </div>
      <aside style={{width:260,flex:'0 0 auto',display:'flex',flexDirection:'column',borderLeft:'1px solid var(--border-hairline)'}}>
        <div style={{flex:1,padding:'var(--sp-5)',overflow:'auto'}}>
          {[{label:'Horodatage',value:item.timestamp},{label:'Auteur',value:item.author},...fields].filter(x=>x.value).map(x=>
            <div key={x.label} style={{display:'flex',flexDirection:'column',gap:2,padding:'var(--sp-4) 0',borderBottom:'1px solid var(--border-hairline)'}}>
              <span style={{font:'var(--fw-semibold) 9px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-micro)',color:'var(--text-muted)'}}>{x.label}</span>
              <span style={{font:'500 12px/1.3 var(--font-data)',color:'var(--text-primary)'}}>{x.value}</span>
            </div>)}
        </div>
        {(onValidate||onReject)&&<div style={{flex:'0 0 auto',display:'flex',gap:'var(--sp-4)',padding:'var(--sp-5)',background:'var(--carbon-050)',borderTop:'1px solid var(--border-hairline)'}}>
          <Button size="sm" tone="outline" icon="x" onClick={onReject} block>Rejeter</Button>
          <Button size="sm" tone="primary" icon="check" onClick={onValidate} block>Valider</Button>
        </div>}
      </aside>
    </div>
  </div>;
}
