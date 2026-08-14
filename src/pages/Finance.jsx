import { useEffect, useMemo, useState } from 'react'
import { supabase, BORDEREAUX_BUCKET } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate, today } from '../lib/format'
import { compressImage } from '../lib/image'
import { exportRowsToCsv } from '../lib/csv'
import { Panel, PanelEmpty } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { IconButton } from '../ds/octane/components/core/IconButton.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'
import { EvidenceUpload } from '../ds/octane/components/evidence/EvidenceUpload.jsx'
import { Kpi } from '../lib/Kpi.jsx'

const N = (v) => (v ? Number(v) : 0)
// charges saisies à la main (les récurrentes se reportent d'un mois sur l'autre)
const MANUAL_CATS = ['LOYER','SALAIRES','PRELEVEMENT_GERANT','IMPOTS','HONORAIRES','PRESTATIONS','PERTE_VENTE_CARBURANT','SONEB','TELEPHONE','AUTRE']
const REVENU_CAT = 'AUTRES_PRODUITS'
const CAT_OPTIONS = [...MANUAL_CATS.map(c => ({ value: c, label: c.replace(/_/g, ' ') })), { value: REVENU_CAT, label: '+ AUTRES PRODUITS (revenu)' }]
const STATUT_OPTIONS = [{ value: 'a_payer', label: 'À payer' }, { value: 'paye', label: 'Payé' }]
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const ML = { '01':'Janv','02':'Févr','03':'Mars','04':'Avril','05':'Mai','06':'Juin','07':'Juil','08':'Août','09':'Sept','10':'Oct','11':'Nov','12':'Déc' }
const blankCharge = () => ({ categorie: 'LOYER', montant: '', note: '', statut: 'a_payer', date_paiement: '', code_comptable: '', _file: null })

export default function Finance() {
  const { session } = useAuth()
  const { stationId } = useStation()
  const [ventes, setVentes] = useState([])
  const [charges, setCharges] = useState([])
  const [expenses, setExpenses] = useState([])
  const [pertes, setPertes] = useState([])
  const [stockVal, setStockVal] = useState([])
  const [bonsRestant, setBonsRestant] = useState(0)
  const [settings, setSettings] = useState({ taux_gaz: 8, taux_superette: 8 })
  const [profiles, setProfiles] = useState({})     // {id: full_name} — traçabilité
  const [locked, setLocked] = useState(new Set())  // mois verrouillés ('YYYY-MM')
  const [openAnnuel, setOpenAnnuel] = useState(false)
  // Par défaut, mois en cours (pas le dernier mois avec des données, qui peut être ancien).
  const [annee, setAnnee] = useState(today().slice(0, 4))
  const [mois, setMois] = useState(today().slice(0, 7))
  const [nc, setNc] = useState(blankCharge())
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  async function load() {
    if (!stationId) return
    const [v, c, e, st, p, sv, ls, pr, fv] = await Promise.all([
      supabase.from('v_ventes_mensuelles').select('*').eq('station_id', stationId).order('mois'),
      supabase.from('charges').select('*').eq('station_id', stationId),
      supabase.from('expenses').select('report_date,categorie,montant').eq('station_id', stationId),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('v_pertes_mensuelles').select('*').eq('station_id', stationId),
      supabase.from('v_stock_valeur').select('*').eq('station_id', stationId),
      supabase.from('v_latest_stock').select('bons_restant').eq('station_id', stationId).maybeSingle(),
      supabase.from('profiles').select('id,full_name'),
      supabase.from('finance_periodes_verrouillees').select('mois').eq('station_id', stationId),
    ])
    setVentes(v.data || []); setCharges(c.data || []); setExpenses(e.data || [])
    if (st.data) setSettings(st.data)
    setPertes(p.data || []); setStockVal(sv.data || [])
    setBonsRestant(N(ls.data?.bons_restant))
    const pm = {}; for (const x of (pr.data || [])) pm[x.id] = x.full_name; setProfiles(pm)
    setLocked(new Set((fv.data || []).map(x => x.mois)))
  }
  useEffect(() => { load() }, [stationId])

  const annees = useMemo(() => [...new Set([...ventes.map(v => v.mois.slice(0, 4)), today().slice(0, 4)])].sort(), [ventes])

  const inPeriod = (m) => mois ? m === mois : (m || '').startsWith(annee)
  const V = ventes.filter(v => inPeriod(v.mois))
  const sum = (k) => V.reduce((s, v) => s + N(v[k]), 0)
  const commCarb = sum('commission_carburant')
  // commissions AUTO des autres pôles = ventes × taux
  const commGazLub = (sum('ventes_gaz') + sum('ventes_lubrifiant')) * N(settings.taux_gaz) / 100
  const commSuperette = sum('ventes_superette') * N(settings.taux_superette) / 100

  // charges AUTO depuis les dépenses quotidiennes (SBEE, carburant) — factorisé pour être
  // réutilisable sur n'importe quel prédicat de mois (période courante, précédente, un mois donné).
  function autoChargesFor(predicate) {
    const m = {}
    for (const e of expenses) {
      const em = (e.report_date || '').slice(0, 7)
      if (!predicate(em)) continue
      if (e.categorie === 'SBEE' || e.categorie === 'CARBURANT') m[e.categorie] = (m[e.categorie] || 0) + N(e.montant)
    }
    return m
  }
  const autoCharges = autoChargesFor(inPeriod)
  const totAuto = Object.values(autoCharges).reduce((s, v) => s + v, 0)

  // charges MANUELLES
  const chP = charges.filter(c => inPeriod(c.mois))
  const autresProduits = chP.filter(c => c.categorie === REVENU_CAT).reduce((s, c) => s + N(c.montant), 0)
  const totManuel = chP.filter(c => c.categorie !== REVENU_CAT).reduce((s, c) => s + N(c.montant), 0)
  const chargesAPayer = chP.filter(c => c.categorie !== REVENU_CAT && c.statut !== 'paye').reduce((s, c) => s + N(c.montant), 0)

  // pertes livraison non acceptables sur la période
  const pertesP = pertes.filter(p => inPeriod(p.mois))
  const perteNaMontant = pertesP.reduce((s, p) => s + N(p.perte_na_montant), 0)
  const perteNaLitres = pertesP.reduce((s, p) => s + N(p.perte_na_litres), 0)

  const totCharges = totAuto + totManuel
  const produits = commCarb + commGazLub + commSuperette + autresProduits
  const resultat = produits - totCharges

  // Comparaison à la période précédente (mois précédent si un mois précis est sélectionné,
  // sinon année précédente) — repère les anomalies comme le ferait un comptable.
  const prevLabel = mois
    ? (() => { const [y, m] = mois.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` })()
    : (annee ? String(Number(annee) - 1) : null)
  const prevInPeriod = (m) => prevLabel && (mois ? m === prevLabel : (m || '').startsWith(prevLabel))
  const Vprev = ventes.filter(v => prevInPeriod(v.mois))
  const sumPrev = (k) => Vprev.reduce((s, v) => s + N(v[k]), 0)
  const commCarbPrev = sumPrev('commission_carburant')
  const commGazLubPrev = (sumPrev('ventes_gaz') + sumPrev('ventes_lubrifiant')) * N(settings.taux_gaz) / 100
  const commSuperettePrev = sumPrev('ventes_superette') * N(settings.taux_superette) / 100
  const autoChargesPrev = autoChargesFor(prevInPeriod)
  const totAutoPrev = Object.values(autoChargesPrev).reduce((s, v) => s + v, 0)
  const chPprev = charges.filter(c => prevInPeriod(c.mois))
  const autresProduitsPrev = chPprev.filter(c => c.categorie === REVENU_CAT).reduce((s, c) => s + N(c.montant), 0)
  const totManuelPrev = chPprev.filter(c => c.categorie !== REVENU_CAT).reduce((s, c) => s + N(c.montant), 0)
  const produitsPrev = commCarbPrev + commGazLubPrev + commSuperettePrev + autresProduitsPrev
  const totChargesPrev = totAutoPrev + totManuelPrev
  const resultatPrev = produitsPrev - totChargesPrev
  function cmp(curr, prev) {
    if (!prevLabel || !prev) return {}
    const pct = Math.round(100 * (curr - prev) / Math.abs(prev))
    return { delta: `${pct > 0 ? '+' : ''}${pct}%`, direction: curr === prev ? 'flat' : curr > prev ? 'up' : 'down' }
  }

  // Bilan simplifié : actif/passif CUMULÉS depuis le début des données jusqu'à la fin de la
  // période affichée (pas juste le flux de la période, comme le compte de résultat ci-dessus).
  const periodeFinBilan = mois || (annee ? `${annee}-12` : null)
  const cashCumule = periodeFinBilan
    ? ventes.filter(v => v.mois <= periodeFinBilan).reduce((s, v) => s + N(v.recettes_especes) - N(v.total_depense) - N(v.total_verse), 0)
    : 0
  const chargesAPayerCumule = periodeFinBilan
    ? charges.filter(c => c.categorie !== REVENU_CAT && c.statut !== 'paye' && c.mois <= periodeFinBilan).reduce((s, c) => s + N(c.montant), 0)
    : 0
  const stockTotal = stockVal.reduce((s, v) => s + N(v.valeur), 0)
  const totalActif = stockTotal + bonsRestant + cashCumule
  const totalPassif = chargesAPayerCumule
  const situationNette = totalActif - totalPassif

  const isLocked = mois && locked.has(mois)

  const flash = (m) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500) }

  async function addCharge(e) {
    e.preventDefault(); setErr('')
    if (!mois) { setErr('Choisis un mois précis pour saisir une charge.'); return }
    if (locked.has(mois)) { setErr('Ce mois est verrouillé — déverrouille-le pour ajouter une charge.'); return }
    if (!nc.montant) return
    let photo_path = null
    if (nc._file) {
      const path = `${stationId}/charges/${mois}/${Date.now()}_${nc._file.name.replace(/[^\w.\-]/g, '_')}`
      const { error: up } = await supabase.storage.from(BORDEREAUX_BUCKET).upload(path, await compressImage(nc._file))
      if (up) { setErr(up.message); return }
      photo_path = path
    }
    const { error } = await supabase.from('charges').insert({
      station_id: stationId, mois, categorie: nc.categorie, montant: Number(nc.montant), note: nc.note || null,
      statut: nc.statut, date_paiement: nc.statut === 'paye' ? (nc.date_paiement || today()) : null,
      code_comptable: nc.code_comptable || null, photo_path, created_by: session.user.id })
    if (error) setErr(error.message); else { setNc(blankCharge()); flash('Charge ajoutée'); load() }
  }
  async function delCharge(c) {
    if (locked.has(c.mois)) { setErr('Ce mois est verrouillé.'); return }
    await supabase.from('charges').delete().eq('id', c.id); load()
  }
  async function togglePaye(c) {
    if (locked.has(c.mois)) { setErr('Ce mois est verrouillé.'); return }
    const nextStatut = c.statut === 'paye' ? 'a_payer' : 'paye'
    const { error } = await supabase.from('charges').update({ statut: nextStatut, date_paiement: nextStatut === 'paye' ? today() : null }).eq('id', c.id)
    if (error) setErr(error.message); else load()
  }
  async function toggleLock() {
    if (!mois) return
    if (isLocked) {
      await supabase.from('finance_periodes_verrouillees').delete().eq('station_id', stationId).eq('mois', mois)
      flash('Mois déverrouillé')
    } else {
      const { error } = await supabase.from('finance_periodes_verrouillees').insert({ station_id: stationId, mois, verrouille_by: session.user.id })
      if (error) { setErr(error.message); return }
      flash('Mois verrouillé')
    }
    load()
  }
  // proposer : copier les charges récurrentes du mois précédent
  async function reporterMoisPrecedent() {
    if (!mois) return
    if (locked.has(mois)) { setErr('Ce mois est verrouillé.'); return }
    const [y, m] = mois.split('-').map(Number)
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    const prevRows = charges.filter(c => c.mois === prev && c.categorie !== REVENU_CAT && c.categorie !== 'PERTE_VENTE_CARBURANT')
    if (!prevRows.length) { setErr(`Aucune charge sur ${prev} à reporter.`); return }
    const rows = prevRows.map(c => ({
      station_id: stationId, mois, categorie: c.categorie, montant: c.montant, note: 'proposé (report ' + prev + ')',
      code_comptable: c.code_comptable || null, statut: 'a_payer', created_by: session.user.id }))
    const { error } = await supabase.from('charges').insert(rows)
    if (error) setErr(error.message); else { flash(`${rows.length} charge(s) reportée(s) de ${prev}`); load() }
  }

  function exportCompteResultat() {
    const columns = [['Poste', 'poste'], ['Montant', 'montant']]
    const data = [
      { poste: 'Commission carburant', montant: Math.round(commCarb) },
      { poste: `Commission gaz + lubrifiant (${settings.taux_gaz}%)`, montant: Math.round(commGazLub) },
      { poste: `Commission supérette (${settings.taux_superette}%)`, montant: Math.round(commSuperette) },
      { poste: 'Autres produits', montant: Math.round(autresProduits) },
      { poste: '= PRODUITS', montant: Math.round(produits) },
      { poste: 'SBEE (auto)', montant: Math.round(N(autoCharges.SBEE)) },
      { poste: 'Carburant / déplacement (auto)', montant: Math.round(N(autoCharges.CARBURANT)) },
      { poste: 'Charges fixes', montant: Math.round(totManuel) },
      { poste: '= CHARGES', montant: Math.round(totCharges) },
      { poste: 'RÉSULTAT', montant: Math.round(resultat) },
    ]
    exportRowsToCsv(`compte-resultat-${mois || annee}.csv`, columns, data)
  }
  function exportChargesFixes() {
    const columns = [['Mois', 'mois'], ['Catégorie', 'categorie'], ['Code comptable', 'code'], ['Statut', 'statut'],
      ['Date paiement', 'date_paiement'], ['Montant', 'montant'], ['Note', 'note'], ['Saisi par', 'par'], ['Le', 'le']]
    const data = chP.map(c => ({
      mois: c.mois, categorie: c.categorie === REVENU_CAT ? 'Autres produits' : c.categorie, code: c.code_comptable || '',
      statut: c.statut === 'paye' ? 'Payé' : 'À payer', date_paiement: c.date_paiement || '',
      montant: Math.round(N(c.montant)), note: c.note || '', par: profiles[c.created_by] || '', le: c.created_at ? frDate(c.created_at) : '',
    }))
    exportRowsToCsv(`charges-fixes-${mois || annee}.csv`, columns, data)
  }

  const anneeOptions = annees.map(a => ({ value: a, label: a }))
  const moisOptions = [{ value: '', label: 'Année entière' }, ...MONTHS.map(m => ({ value: `${annee}-${m}`, label: `${annee}-${m}` }))]
  const photoUrl = (p) => supabase.storage.from(BORDEREAUX_BUCKET).getPublicUrl(p).data.publicUrl

  const chargesColumns = [
    { key: 'mois', header: 'Mois' },
    { key: 'categorie', header: 'Catégorie', render: c => `${c.categorie === REVENU_CAT ? 'Autres produits' : c.categorie.replace(/_/g, ' ')}${c.note ? ` · ${c.note}` : ''}` },
    { key: 'code_comptable', header: 'Code', muted: true, render: c => c.code_comptable || '—' },
    { key: 'statut', header: 'Statut', render: c => c.categorie === REVENU_CAT ? '—' : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <Badge tone={c.statut === 'paye' ? 'ok' : 'idle'}>{c.statut === 'paye' ? `Payé${c.date_paiement ? ' ' + frDate(c.date_paiement) : ''}` : 'À payer'}</Badge>
        <Button size="sm" onClick={() => togglePaye(c)} disabled={locked.has(c.mois)}>{c.statut === 'paye' ? 'Marquer à payer' : 'Marquer payé'}</Button>
      </div>) },
    { key: 'photo', header: 'Justif.', render: c => c.photo_path ? <a href={photoUrl(c.photo_path)} target="_blank" rel="noreferrer">Voir</a> : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'par', header: 'Saisi par', muted: true, render: c => <span title={c.created_at ? frDate(c.created_at) : ''}>{profiles[c.created_by] || '—'}</span> },
    { key: 'montant', header: 'Montant', numeric: true, align: 'right', render: c => <span style={{ color: c.categorie === REVENU_CAT ? 'var(--state-ok)' : 'inherit' }}>{fcfa(c.montant)}</span> },
    { key: 'actions', header: '', align: 'right', render: c => <Button size="sm" tone="danger" onClick={() => delCharge(c)} disabled={locked.has(c.mois)}>Suppr.</Button> },
  ]

  // Compte de résultat annuel ventilé par mois — pivot type "grand livre", lourd (12 × tout
  // recalculé) donc replié par défaut et calculé seulement si ouvert.
  const LEDGER_LINES = [
    { key: 'commCarb', label: 'Commission carburant' },
    { key: 'commGL', label: 'Commission gaz + lubrifiant' },
    { key: 'commSup', label: 'Commission supérette' },
    { key: 'autresProduits', label: 'Autres produits' },
    { key: 'produits', label: '= PRODUITS', bold: true },
    { key: 'sbee', label: 'SBEE (auto)' },
    { key: 'carbDepl', label: 'Carburant / déplacement (auto)' },
    { key: 'chargesFixes', label: 'Charges fixes' },
    { key: 'charges', label: '= CHARGES', bold: true },
    { key: 'resultat', label: 'RÉSULTAT', bold: true },
  ]
  function monthMetrics(m) {
    const Vm = ventes.filter(v => v.mois === m)
    const s = (k) => Vm.reduce((sum, v) => sum + N(v[k]), 0)
    const cCarb = s('commission_carburant')
    const cGL = (s('ventes_gaz') + s('ventes_lubrifiant')) * N(settings.taux_gaz) / 100
    const cSup = s('ventes_superette') * N(settings.taux_superette) / 100
    const auto = autoChargesFor(em => em === m)
    const totA = Object.values(auto).reduce((sum, v) => sum + v, 0)
    const cM = charges.filter(c => c.mois === m)
    const autresP = cM.filter(c => c.categorie === REVENU_CAT).reduce((sum, c) => sum + N(c.montant), 0)
    const totMan = cM.filter(c => c.categorie !== REVENU_CAT).reduce((sum, c) => sum + N(c.montant), 0)
    const prod = cCarb + cGL + cSup + autresP
    const tot = totA + totMan
    return { commCarb: cCarb, commGL: cGL, commSup: cSup, autresProduits: autresP, sbee: N(auto.SBEE), carbDepl: N(auto.CARBURANT), chargesFixes: totMan, produits: prod, charges: tot, resultat: prod - tot }
  }
  const yearMonths = annee ? MONTHS.map(m => `${annee}-${m}`) : []
  const monthly = openAnnuel ? yearMonths.map(monthMetrics) : []
  const annualColumns = [
    { key: 'label', header: 'Poste' },
    ...MONTHS.map((m, i) => ({ key: m, header: ML[m], numeric: true, align: 'right', render: row => fcfa(monthly[i]?.[row.key] ?? 0) })),
    { key: 'total', header: 'Total', numeric: true, align: 'right', render: row => <b>{fcfa(monthly.reduce((s, mm) => s + N(mm[row.key]), 0))}</b> },
  ]
  const annualRows = LEDGER_LINES.map(l => ({ id: l.key, label: l.bold ? <b>{l.label}</b> : l.label, key: l.key }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}

      <Panel title="Point financier" bodyStyle={{ display: 'none' }} actions={<>
        <Select size="sm" value={annee} onChange={e => { setAnnee(e.target.value); setMois('') }} options={anneeOptions} />
        <Select size="sm" value={mois} onChange={e => setMois(e.target.value)} options={moisOptions} />
        {mois && <Button size="sm" tone={isLocked ? 'danger' : 'outline'} onClick={toggleLock}>{isLocked ? 'Déverrouiller le mois' : 'Verrouiller le mois'}</Button>}
      </>} />

      {isLocked && (
        <AlertBanner tone="info" title="Mois verrouillé">
          Ce mois a été clôturé — aucune charge fixe ne peut y être ajoutée, modifiée ou supprimée tant qu'il n'est pas déverrouillé.
        </AlertBanner>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
        <Kpi label="Litres carburant" value={Math.round(sum('litres_carburant')).toLocaleString('fr-FR')} unit="L" />
        <Kpi label="Commission carburant" value={fcfa(commCarb)} sub="litres × marge" {...cmp(commCarb, commCarbPrev)} />
        <Kpi label="Ventes gaz + lubrifiant" value={fcfa(sum('ventes_gaz') + sum('ventes_lubrifiant'))} />
        <Kpi label="Ventes supérette" value={fcfa(sum('ventes_superette'))} />
        <Kpi label="Total charges" value={fcfa(totCharges)} {...cmp(totCharges, totChargesPrev)} />
        <Kpi label="Charges à payer" value={fcfa(chargesAPayer)} status={chargesAPayer > 0 ? 'warn' : 'ok'} />
        <Kpi label="Valeur du stock" value={fcfa(stockTotal)} sub="gaz + lubrifiant + supérette" />
        <Kpi label="RÉSULTAT" value={fcfa(resultat)} status={resultat < 0 ? 'alarm' : 'ok'} {...cmp(resultat, resultatPrev)} />
      </div>

      <Panel title="Pertes sur livraisons" meta={mois || annee} status={perteNaMontant > 0 ? 'alarm' : 'ok'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
          <Kpi label="Pertes NON acceptables" value={Math.round(perteNaLitres).toLocaleString('fr-FR')} unit="L" status={perteNaLitres > 0 ? 'alarm' : 'ok'} sub={`au-delà de ${settings.taux_perte_acceptable || 5}%`} />
          <Kpi label="Montant (base retenue)" value={fcfa(perteNaMontant)} status={perteNaMontant > 0 ? 'alarm' : 'ok'} />
        </div>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 'var(--sp-4)', marginBottom: 0 }}>
          Total des pertes au-delà du seuil de tolérance sur les livraisons réceptionnées. Sert de base à une éventuelle retenue sur le salaire du gérant si non justifiées.
        </p>
      </Panel>

      <Panel title="Compte de résultat" meta={mois || annee} actions={<Button size="sm" onClick={exportCompteResultat}>Exporter (CSV)</Button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <LedgerHead>Produits (commissions, auto)</LedgerHead>
          <LedgerRow label="Commission carburant" value={fcfa(commCarb)} />
          <LedgerRow label={`Commission gaz + lubrifiant (${settings.taux_gaz}%)`} value={fcfa(commGazLub)} />
          <LedgerRow label={`Commission supérette (${settings.taux_superette}%)`} value={fcfa(commSuperette)} />
          {autresProduits > 0 && <LedgerRow label="Autres produits (saisis)" value={fcfa(autresProduits)} />}
          <LedgerHead>Charges</LedgerHead>
          <LedgerRow label="SBEE (auto, depuis dépenses)" value={fcfa(autoCharges.SBEE)} />
          <LedgerRow label="Carburant / déplacement (auto)" value={fcfa(autoCharges.CARBURANT)} />
          <LedgerRow label="Charges fixes (saisies)" value={fcfa(totManuel)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--sp-3)', borderTop: '2px solid var(--border-default)', font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)', color: 'var(--text-primary)' }}>
            <span>RÉSULTAT</span>
            <span style={{ color: resultat < 0 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>{fcfa(resultat)}</span>
          </div>
        </div>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 'var(--sp-4)', marginBottom: 0 }}>
          SBEE et carburant/déplacement sont <b>déduits automatiquement</b> des dépenses saisies au quotidien. Les charges fixes se <b>reportent d'un mois sur l'autre</b> (bouton ci-dessous), tout reste modifiable.
        </p>
      </Panel>

      <Panel title="Compte de résultat annuel" meta={`${annee} — par mois`} flush
        bodyStyle={openAnnuel ? undefined : { display: 'none' }}
        actions={<IconButton icon="chevron-down" size="sm" title={openAnnuel ? 'Masquer' : 'Afficher'}
          onClick={() => setOpenAnnuel(v => !v)} style={{ transform: openAnnuel ? 'rotate(180deg)' : 'none' }} />}>
        {openAnnuel && <DataTable columns={annualColumns} rows={annualRows} />}
      </Panel>

      <Panel title="Bilan simplifié" meta={`au ${periodeFinBilan || '—'}`}>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
          Ce que la station possède / doit, cumulé depuis le début des données jusqu'à la fin de la période — pas un flux du mois comme le compte de résultat ci-dessus.
        </p>
        <div style={{ display: 'flex', gap: 'var(--sp-6)', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <LedgerHead>Actif</LedgerHead>
            <LedgerRow label="Stock (gaz + lubrifiant + supérette)" value={fcfa(stockTotal)} />
            <LedgerRow label="Bons en cours (créance, à ce jour)" value={fcfa(bonsRestant)} />
            <LedgerRow label="Cash non encore versé (cumulé)" value={fcfa(cashCumule)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 'var(--sp-5)', paddingTop: 'var(--sp-2)', borderTop: '1px solid var(--border-hairline)', font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)' }}>
              <span>Total actif</span><span>{fcfa(totalActif)}</span>
            </div>
          </div>
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <LedgerHead>Passif</LedgerHead>
            <LedgerRow label="Charges à payer (cumulées)" value={fcfa(chargesAPayerCumule)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 'var(--sp-5)', paddingTop: 'var(--sp-2)', borderTop: '1px solid var(--border-hairline)', font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)' }}>
              <span>Total passif</span><span>{fcfa(totalPassif)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--sp-3)', marginTop: 'var(--sp-3)', borderTop: '2px solid var(--border-default)', font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)', color: 'var(--text-primary)' }}>
              <span>Situation nette</span>
              <span style={{ color: situationNette < 0 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>{fcfa(situationNette)}</span>
            </div>
          </div>
        </div>
        <p style={{ font: '400 11px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 'var(--sp-4)', marginBottom: 0 }}>
          "Bons en cours" reflète la valeur à aujourd'hui (pas d'historique disponible pour une date passée).
        </p>
      </Panel>

      <Panel title="Charges fixes" meta={mois || undefined} flush
        actions={chP.length > 0 && <Button size="sm" onClick={exportChargesFixes}>Exporter (CSV)</Button>}>
        <div style={{ padding: 'var(--gutter-panel)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {!mois && <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Sélectionne un <b>mois précis</b> pour saisir/reporter les charges.</p>}
          {mois && !isLocked && <>
            <Button size="sm" onClick={reporterMoisPrecedent} style={{ alignSelf: 'flex-start' }}>Reporter le mois précédent</Button>
            <form onSubmit={addCharge} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Catégorie" style={{ flex: '1 1 200px' }}>
                  <Select value={nc.categorie} onChange={e => setNc({ ...nc, categorie: e.target.value })} options={CAT_OPTIONS} style={{ width: '100%' }} />
                </Field>
                <Field label="Montant" style={{ flex: '1 1 150px' }}>
                  <Input type="number" inputMode="decimal" numeric value={nc.montant} onChange={e => setNc({ ...nc, montant: e.target.value })} />
                </Field>
                <Field label="Code comptable (optionnel)" style={{ flex: '1 1 150px' }} hint="ex. plan SYSCOHADA : 613, 641...">
                  <Input value={nc.code_comptable} onChange={e => setNc({ ...nc, code_comptable: e.target.value })} />
                </Field>
              </div>
              {nc.categorie !== REVENU_CAT && <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', alignItems: 'end' }}>
                <Field label="Statut" style={{ flex: '1 1 150px' }}>
                  <Select value={nc.statut} onChange={e => setNc({ ...nc, statut: e.target.value })} options={STATUT_OPTIONS} style={{ width: '100%' }} />
                </Field>
                {nc.statut === 'paye' && <Field label="Date de paiement" style={{ flex: '1 1 150px' }}>
                  <Input type="date" value={nc.date_paiement || today()} max={today()} onChange={e => setNc({ ...nc, date_paiement: e.target.value })} />
                </Field>}
                <Field label="Justificatif (facture, bulletin...)" style={{ flex: '1 1 220px' }}>
                  <EvidenceUpload label={nc._file ? nc._file.name : 'Déposer la photo'} multiple={false} onFiles={files => setNc({ ...nc, _file: files[0] })} />
                </Field>
              </div>}
              <Button type="submit" tone="primary" style={{ alignSelf: 'flex-start' }}>Ajouter</Button>
            </form>
          </>}
        </div>
        {chP.length
          ? <DataTable columns={chargesColumns} rows={[...chP].sort((a, b) => (a.mois + a.categorie).localeCompare(b.mois + b.categorie))} />
          : <PanelEmpty icon="landmark" label="Aucune charge fixe pour cette période" />}
      </Panel>
    </div>
  )
}

function LedgerHead({ children }) {
  return <div style={{ font: 'var(--fw-semibold) 11px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>{children}</div>
}
function LedgerRow({ label, value }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 'var(--sp-5)', font: '400 13px/1.3 var(--font-ui)', color: 'var(--text-body)' }}>
    <span>{label}</span><span style={{ font: '500 13px/1 var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
}
