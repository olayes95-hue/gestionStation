import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStation } from '../lib/station.jsx'

const TABLE_LABELS = {
  daily_reports: 'Point journalier', deposits: 'Versement', expenses: 'Dépense',
  deliveries: 'Achat', fuel_orders: 'Commande', inspections: 'Contrôle ANM',
}
const ACTION_LABELS = { INSERT: { l: 'Création', c: '#16a34a' }, UPDATE: { l: 'Modification', c: '#d97706' }, DELETE: { l: 'Suppression', c: '#dc2626' } }
// champs à surveiller pour le diff lisible
const WATCH = ['ess_litres','gas_litres','ess_bon','ess_espece','gas_bon','gas_espece','montant','quantite_commandee','cuve_avant','cuve_apres','statut','e1_m','e2_m','e3_m','e4_m','e1','e2','e3','e4','g1','g2','g3','g4','ess_stock','gas_stock']

export default function AuditLog() {
  const { stationId } = useStation()
  const [rows, setRows] = useState([])
  const [table, setTable] = useState('all')
  const [action, setAction] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!stationId) return; (async () => {
    setLoading(true)
    const { data } = await supabase.from('audit_log').select('*').eq('station_id', stationId).order('changed_at', { ascending: false }).limit(500)
    setRows(data || [])
    setLoading(false)
  })() }, [stationId])

  const shown = useMemo(() => rows.filter(r =>
    (table === 'all' || r.table_name === table) && (action === 'all' || r.action === action)), [rows, table, action])

  if (loading) return <div className="center">Chargement…</div>

  return (
    <div className="card">
      <h2>🕵️ Journal d'audit — {shown.length} événement(s)</h2>
      <p className="hint">Toute création / modification / suppression est tracée (qui, quand, quoi). Journal immuable.</p>
      <div className="toolbar">
        <select value={table} onChange={e => setTable(e.target.value)}>
          <option value="all">Toutes les données</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)}>
          <option value="all">Toutes les actions</option>
          <option value="INSERT">Créations</option><option value="UPDATE">Modifications</option><option value="DELETE">Suppressions</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Quand</th><th>Qui</th><th>Donnée</th><th>Action</th><th>Détail</th></tr></thead>
          <tbody>
            {shown.map(r => {
              const a = ACTION_LABELS[r.action] || { l: r.action, c: '#666' }
              return (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmt(r.changed_at)}</td>
                  <td>{r.changed_by_email || '—'}</td>
                  <td>{TABLE_LABELS[r.table_name] || r.table_name}</td>
                  <td><span className="badge" style={{ background: a.c }}>{a.l}</span></td>
                  <td style={{ fontSize: 12 }}>{diff(r)}</td>
                </tr>
              )
            })}
            {!shown.length && <tr><td colSpan={5} className="muted">Aucun événement.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function fmt(ts) { if (!ts) return '—'; const d = new Date(ts); return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }

function diff(r) {
  const o = r.old_data || {}, n = r.new_data || {}
  if (r.action === 'INSERT') {
    const parts = WATCH.filter(k => n[k] != null && n[k] !== '' && n[k] !== 0).slice(0, 4).map(k => `${k}=${n[k]}`)
    return parts.join(' · ') || `#${r.row_id}`
  }
  if (r.action === 'DELETE') return `supprimé #${r.row_id}`
  // UPDATE : montre les champs surveillés qui ont changé
  const changed = WATCH.filter(k => JSON.stringify(o[k]) !== JSON.stringify(n[k]))
  if (!changed.length) return '—'
  return changed.slice(0, 5).map(k => <span key={k}>{k}: <b style={{ color: 'var(--danger)' }}>{fmtv(o[k])}→{fmtv(n[k])}</b>{' '}</span>)
}
function fmtv(v) { return v == null || v === '' ? '∅' : String(v) }
