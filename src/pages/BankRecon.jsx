import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate, today } from '../lib/format'

const N = (v) => (v ? Number(v) : 0)
const TOL = 200        // tolérance FCFA (timbre) pour l'appariement
const WIN = 7          // fenêtre en jours

export default function BankRecon() {
  const { session } = useAuth()
  const { stationId } = useStation()
  const [deposits, setDeposits] = useState([])
  const [bank, setBank] = useState([])
  const [nl, setNl] = useState({ date_operation: today(), montant: '', reference: '' })
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  async function load() {
    if (!stationId) return
    setDeposits((await supabase.from('deposits').select('*').eq('station_id', stationId).order('deposit_date', { ascending: false })).data || [])
    setBank((await supabase.from('bank_lines').select('*').eq('station_id', stationId).order('date_operation', { ascending: false })).data || [])
  }
  useEffect(() => { load() }, [stationId])

  async function addLine(e) {
    e.preventDefault(); setErr('')
    if (!nl.montant) return
    const { error } = await supabase.from('bank_lines').insert({
      station_id: stationId, date_operation: nl.date_operation, montant: Number(nl.montant),
      reference: nl.reference || null, created_by: session.user.id })
    if (error) setErr(error.message)
    else { setNl({ date_operation: today(), montant: '', reference: '' }); setMsg('Ligne ajoutée ✓'); setTimeout(() => setMsg(''), 2000); load() }
  }
  async function delLine(id) { await supabase.from('bank_lines').delete().eq('id', id); load() }

  // Appariement glouton : chaque ligne bancaire ↔ un versement déclaré (montant ± TOL, date ± WIN j)
  const recon = useMemo(() => {
    const deps = deposits.map(d => ({ ...d, _used: false }))
    const matched = [], unmatchedBank = []
    for (const b of bank) {
      const bd = b.date_operation
      let hit = null
      for (const d of deps) {
        if (d._used) continue
        const dd = d.deposit_date || d.report_date
        const days = Math.abs((new Date(bd) - new Date(dd)) / 86400000)
        if (Math.abs(N(b.montant) - N(d.montant)) <= TOL && days <= WIN) { hit = d; break }
      }
      if (hit) { hit._used = true; matched.push({ bank: b, dep: hit }) }
      else unmatchedBank.push(b)
    }
    const unmatchedDep = deps.filter(d => !d._used)
    return { matched, unmatchedBank, unmatchedDep }
  }, [deposits, bank])

  const totDecl = deposits.reduce((s, d) => s + N(d.montant), 0)
  const totBank = bank.reduce((s, b) => s + N(b.montant), 0)

  return (
    <div>
      {msg && <div className="ok">{msg}</div>}
      {err && <div className="err">{err}</div>}

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <K label="Versements déclarés" v={fcfa(totDecl)} />
        <K label="Crédits relevé banque" v={fcfa(totBank)} />
        <K label="Rapprochés" v={recon.matched.length} />
        <K label="Non rapprochés" v={recon.unmatchedDep.length + recon.unmatchedBank.length} danger={recon.unmatchedDep.length + recon.unmatchedBank.length > 0} />
      </div>

      <div className="card">
        <h2>➕ Saisir une ligne du relevé BOA</h2>
        <p className="hint">Reporte chaque crédit du relevé bancaire (date, montant). Le pointage est automatique.</p>
        <form onSubmit={addLine}>
          <div className="row-3">
            <div><label>Date opération</label><input type="date" value={nl.date_operation} onChange={e => setNl({ ...nl, date_operation: e.target.value })} /></div>
            <div><label>Montant crédité</label><input type="number" inputMode="decimal" value={nl.montant} onChange={e => setNl({ ...nl, montant: e.target.value })} /></div>
            <div><label>Référence</label><input value={nl.reference} onChange={e => setNl({ ...nl, reference: e.target.value })} /></div>
          </div>
          <div style={{ height: 10 }} />
          <button className="btn small">Ajouter la ligne</button>
        </form>
      </div>

      <div className="card">
        <h2>⚠️ Versements déclarés SANS crédit en banque ({recon.unmatchedDep.length})</h2>
        <p className="hint">Argent déclaré versé par le gérant, mais introuvable sur le relevé → à vérifier en priorité.</p>
        <Tbl rows={recon.unmatchedDep} cols={[['deposit_date', 'Date', frDate], ['pole', 'Pôle'], ['montant', 'Montant', fcfa], ['ref_bordereau', 'Réf']]} empty="Aucun — tout est couvert 🎉" danger />
      </div>

      <div className="card">
        <h2>❓ Crédits en banque SANS versement déclaré ({recon.unmatchedBank.length})</h2>
        <p className="hint">Argent arrivé en banque non déclaré dans un point → à rattacher.</p>
        <Tbl rows={recon.unmatchedBank} cols={[['date_operation', 'Date', frDate], ['montant', 'Montant', fcfa], ['reference', 'Réf']]} empty="Aucun"
          actions={b => <button className="btn sec small" onClick={() => delLine(b.id)}>Suppr.</button>} />
      </div>

      <div className="card">
        <h2>✅ Rapprochés ({recon.matched.length})</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date banque</th><th className="num">Montant banque</th><th>↔ Versement déclaré</th><th className="num">Montant déclaré</th></tr></thead>
            <tbody>
              {recon.matched.map((m, i) => (
                <tr key={i}>
                  <td>{frDate(m.bank.date_operation)}</td><td className="num">{fcfa(m.bank.montant)}</td>
                  <td>{frDate(m.dep.deposit_date || m.dep.report_date)} · {m.dep.pole}</td><td className="num">{fcfa(m.dep.montant)}</td>
                </tr>
              ))}
              {!recon.matched.length && <tr><td colSpan={4} className="muted">Rien encore rapproché.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Tbl({ rows, cols, empty, danger, actions }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{cols.map(c => <th key={c[0]} className={c[2] === fcfa ? 'num' : ''}>{c[1]}</th>)}{actions && <th></th>}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map(c => <td key={c[0]} className={c[2] === fcfa ? 'num' : ''} style={danger && c[2] === fcfa ? { color: 'var(--danger)' } : null}>{c[2] ? c[2](r[c[0]]) : (r[c[0]] || '—')}</td>)}
              {actions && <td>{actions(r)}</td>}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={cols.length + (actions ? 1 : 0)} className="muted">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
function K({ label, v, danger }) {
  return (<div className="kpi"><div className="label">{label}</div><div className="value" style={{ color: danger ? 'var(--danger)' : 'var(--primary)' }}>{v}</div></div>)
}
