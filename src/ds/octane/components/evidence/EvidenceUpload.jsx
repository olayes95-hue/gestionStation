import React from 'react';
import {Icon} from '../core/Icon.jsx';
// capture=false par défaut : forcer capture="environment" lance directement l'appareil photo natif
// en plein écran, un changement d'activité plus lourd que le sélecteur standard (qui propose aussi
// galerie/fichiers) — sur téléphone bas de gamme/mémoire faible, c'est ce qui déclenche le plus
// souvent un rechargement de l'onglet en arrière-plan pendant la prise de vue (photo perdue, tout
// disparaît). Laisser le choix à l'utilisateur réduit la fréquence de ce changement d'activité lourd.
export function EvidenceUpload({label='Déposer la photo',hint,required,capture=false,multiple=true,onFiles,disabled,style}){
  const [over,setOver]=React.useState(false);
  const input=React.useRef(null);
  const pick=files=>{if(files&&files.length&&onFiles)onFiles(Array.from(files));};
  return <div style={style}>
    <div onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)}
      onDrop={e=>{e.preventDefault();setOver(false);pick(e.dataTransfer.files)}}
      onClick={()=>!disabled&&input.current&&input.current.click()}
      style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'var(--sp-3)',minHeight:96,padding:'var(--sp-6)',
        cursor:disabled?'not-allowed':'pointer',background:over?'var(--accent-quiet)':'var(--surface-sunken)',
        border:'1px dashed '+(over?'var(--accent)':'var(--border-default)'),borderRadius:'var(--radius-1)',
        backgroundImage:over?'none':'repeating-linear-gradient(0deg,var(--grid-line) 0 1px,transparent 1px 24px),repeating-linear-gradient(90deg,var(--grid-line) 0 1px,transparent 1px 24px)',
        transition:'var(--t-control)'}}>
      <Icon name="camera" size={20} color={over?'var(--accent)':'var(--text-muted)'}/>
      <span style={{font:'var(--fw-semibold) 11px/1 var(--font-ui)',textTransform:'uppercase',letterSpacing:'var(--ls-label)',color:over?'var(--accent)':'var(--text-secondary)'}}>
        {label}{required&&<span style={{color:'var(--accent)'}}> *</span>}</span>
      <span style={{font:'400 10px/1.3 var(--font-data)',color:'var(--text-muted)',textAlign:'center'}}>{hint||'JPEG / PNG · 8 Mo max · glisser-déposer ou appareil photo'}</span>
    </div>
    <input ref={input} type="file" accept="image/*" multiple={multiple} {...(capture?{capture:'environment'}:{})}
      onChange={e=>pick(e.target.files)} style={{display:'none'}}/>
  </div>;
}
