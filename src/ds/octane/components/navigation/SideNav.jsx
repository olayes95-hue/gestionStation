import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../core/Icon.jsx';

// Fork local (v43) : la version d'origine pilote la navigation via onClick/value
// (pas de vrai lien) — cassait le clic droit / ouverture en nouvel onglet et le
// surlignage de route actif natif. Ce fork rend un <NavLink> React Router pour
// chaque entrée (prop `to` au lieu de `value`), en gardant le style OCTANE identique.
// `items` : [{section:string} | {to, icon, label, badge?}]
export function SideNav({ items = [], brand = 'OCTANE', site, overlay, open, onClose, style }) {
  return <nav className={overlay ? 'oct-rail' : undefined} data-open={open ? 'true' : 'false'} style={{ width: 'var(--sidebar-w)', flex: '0 0 auto', display: 'flex', flexDirection: 'column', background: 'var(--carbon-000)', borderRight: '1px solid var(--border-hairline)', ...style }}>
    <div style={{ height: 'var(--topbar-h)', flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', padding: '0 var(--sp-5)', borderBottom: '1px solid var(--border-hairline)' }}>
      <span style={{ width: 14, height: 14, background: 'var(--accent)', clipPath: 'polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)' }} />
      <span style={{ font: '700 14px/1 var(--font-ui)', letterSpacing: '.14em', color: 'var(--text-primary)' }}>{brand}</span>
      {onClose && <button type="button" onClick={onClose} aria-label="Fermer le menu" className="oct-only-sm"
        style={{ marginLeft: 'auto', width: 'var(--control-h-sm)', height: 'var(--control-h-sm)', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 0, color: 'var(--text-muted)', cursor: 'pointer', font: '400 18px/1 var(--font-ui)' }}>×</button>}
    </div>
    {site && <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-hairline)' }}>
      <div style={{ font: 'var(--fw-semibold) 10px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-micro)', color: 'var(--text-muted)', marginBottom: 4 }}>Station</div>
      <div style={{ font: '500 12px/1 var(--font-data)', color: 'var(--text-primary)' }}>{site}</div></div>}
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--sp-4) 0' }}>
      {items.map((it, i) => it.section
        ? <div key={it.section + i} style={{ padding: 'var(--sp-5) var(--sp-5) var(--sp-3)', font: 'var(--fw-semibold) 10px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-micro)', color: 'var(--text-disabled)' }}>{it.section}</div>
        : <NavLink key={it.to} to={it.to} onClick={onClose}
            style={({ isActive }) => ({ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', height: 'var(--row-h)', minHeight: 30, padding: '0 var(--sp-5)', border: 0, cursor: 'pointer', textAlign: 'left', textDecoration: 'none',
              background: isActive ? 'var(--accent-quiet)' : 'transparent', boxShadow: isActive ? 'inset 3px 0 0 var(--accent)' : 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', font: '400 12px/1 var(--font-ui)', transition: 'var(--t-control)' })}
            onMouseEnter={e => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.background = 'var(--carbon-100)' }}
            onMouseLeave={e => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.background = '' }}>
            {({ isActive }) => <>
              <Icon name={it.icon || 'circle'} size={14} color={isActive ? 'var(--accent)' : 'currentColor'} />{it.label}
              {it.badge && <span style={{ marginLeft: 'auto', font: '600 10px/1 var(--font-data)', color: 'var(--state-warn)' }}>{it.badge}</span>}
            </>}
          </NavLink>)}
    </div>
  </nav>;
}
