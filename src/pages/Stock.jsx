import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate, numFR, today } from '../lib/format'
import { STOCK_MOVEMENT_TONES } from '../lib/tones'
import { Panel, PanelEmpty } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { IconButton } from '../ds/octane/components/core/IconButton.jsx'
import { Badge } from '../ds/octane/components/core/Badge.jsx'
import { Tag } from '../ds/octane/components/core/Tag.jsx'
import { Icon } from '../ds/octane/components/core/Icon.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'
import { Kpi } from '../lib/Kpi.jsx'

const N = (v) => (v ? (numFR(v) ?? 0) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const CATS = [['gaz', 'Gaz'], ['lubrifiant', 'Lubrifiant'], ['superette', 'Supérette']]
const MOVEMENT_LABEL = { entree: 'Livraison', sortie: 'Sortie', ajustement: 'Inventaire' }

export default function Stock() {
  const { session, isAdmin, isVendeuse, isPompiste } = useAuth()
  const { stationId } = useStation()
  const [stock, setStock] = useState([])
  const [valeur, setValeur] = useState([])
  const [mvts, setMvts] = useState([])
  const [sorties, setSorties] = useState([])
  const [products, setProducts] = useState([])
  const [action, setAction] = useState(null)   // null | 'entree' | 'ajustement'
  const [nm, setNm] = useState(blank('entree'))
  const [fYear, setFYear] = useState('all'); const [fMonth, setFMonth] = useState('all')
  const [fProduit, setFProduit] = useState('')
  const [showCats, setShowCats] = useState(['gaz', 'lubrifiant'])  // pôles affichés dans "Stock restant" (admin)
  const [openSorties, setOpenSorties] = useState(false)
  const [openJournal, setOpenJournal] = useState(false)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const toggleCat = (c) => setShowCats(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])

  function blank(type) {
    return { categorie: isVendeuse ? 'superette' : 'gaz', produit: '', type, quantite: '', valeur: '', source: type === 'entree' ? 'achat' : 'inventaire', note: '', date_mouvement: today() }
  }
  function openAction(type) { setNm(blank(type)); setAction(type); setErr('') }

  async function load() {
    if (!stationId) return
    const [sp, sv, mv, so, pr] = await Promise.all([
      supabase.from('v_stock_produits').select('*').eq('station_id', stationId),
      supabase.from('v_stock_valeur').select('*').eq('station_id', stationId),
      supabase.from('stock_movements').select('*').eq('station_id', stationId).order('date_mouvement', { ascending: false }).limit(400),
      supabase.from('v_sorties_deduites').select('*').eq('station_id', stationId).order('report_date', { ascending: false }).limit(400),
      supabase.from('products').select('*').eq('actif', true).order('ordre'),
    ])
    setStock(sp.data || []); setValeur(sv.data || []); setMvts(mv.data || []); setSorties(so.data || []); setProducts(pr.data || [])
  }
  useEffect(() => { load() }, [stationId])
  const flash = (m) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500) }

  async function addMvt(e) {
    e.preventDefault(); setErr('')
    const row = { station_id: stationId, categorie: nm.categorie, type: nm.type, source: nm.source || null, note: nm.note || null, date_mouvement: nm.date_mouvement, created_by: session.user.id }
    if (nm.categorie === 'superette') { if (!nm.valeur) { setErr('Renseigne le montant (F).'); return } row.valeur = numFR(nm.valeur) }
    else { if (!nm.produit || !nm.quantite) { setErr('Choisis un produit et une quantité.'); return } row.produit = nm.produit; row.quantite = numFR(nm.quantite) }
    const { error } = await supabase.from('stock_movements').insert(row)
    if (error) setErr(error.message)
    else { setAction(null); flash(nm.type === 'entree' ? 'Livraison enregistrée' : 'Inventaire corrigé'); load() }
  }
  async function delMvt(id) { await supabase.from('stock_movements').delete().eq('id', id); load() }

  const valTotal = valeur.reduce((s, v) => s + N(v.valeur), 0)
  const stockByCat = useMemo(() => { const o = {}; stock.forEach(s => { (o[s.categorie] = o[s.categorie] || []).push(s) }); return o }, [stock])
  const cats = isVendeuse ? [['superette', 'Supérette']] : CATS

  // Produits sous seuil, toutes catégories comptées confondues (gaz + lubrifiant) — la
  // supérette est suivie en valeur, pas en quantité par produit, donc pas de seuil ici.
  const lowStockItems = useMemo(() => stock
    .map(s => ({ ...s, pr: products.find(p => p.categorie === s.categorie && p.nom === s.produit) }))
    .filter(s => s.pr && N(s.stock) < N(s.pr.seuil)), [stock, products])

  // Tendance = dernier écart (jour − veille) connu par produit, tiré de v_sorties_deduites
  // (déjà trié report_date desc) : le premier match par produit est donc le plus récent.
  const latestTrendByProduct = useMemo(() => {
    const o = {}
    for (const s of sorties) {
      const key = s.categorie + '|' + s.produit
      if (!(key in o)) o[key] = N(s.stock_jour) - N(s.stock_veille)
    }
    return o
  }, [sorties])

  const productColumns = (cat) => [
    { key: 'produit', header: 'Produit' },
    { key: 'stock', header: 'Reste', numeric: true, align: 'right', render: s => {
      const pr = products.find(p => p.categorie === cat && p.nom === s.produit)
      const low = pr && N(s.stock) < N(pr.seuil)
      const trend = latestTrendByProduct[cat + '|' + s.produit]
      return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{ fontWeight: 600 }}>{N(s.stock)}</span>{low && <Badge tone="alarm">Bas</Badge>}
        </span>
        {!!trend && <span style={{ font: '400 10px/1 var(--font-data)', color: trend < 0 ? 'var(--state-alarm)' : 'var(--state-ok)' }}>
          {trend < 0 ? '↓' : '↑'}{Math.abs(trend)} depuis hier
        </span>}
      </div>
    } },
    { key: 'seuil', header: 'Seuil', numeric: true, align: 'right', muted: true, render: s => { const pr = products.find(p => p.categorie === cat && p.nom === s.produit); return pr ? N(pr.seuil) : '—' } },
  ]

  const sortieColumns = [
    { key: 'report_date', header: 'Date', render: s => frDate(s.report_date) },
    { key: 'categorie', header: 'Catégorie' },
    { key: 'produit', header: 'Produit' },
    { key: 'stock_veille', header: 'Veille', numeric: true, align: 'right', muted: true, render: s => N(s.stock_veille) },
    { key: 'entrees', header: 'Entrées', numeric: true, align: 'right', muted: true, render: s => N(s.entrees) },
    { key: 'stock_jour', header: 'Jour', numeric: true, align: 'right', muted: true, render: s => N(s.stock_jour) },
    { key: 'sortie_deduite', header: 'Sortie déduite', numeric: true, align: 'right', render: s => <span style={{ fontWeight: 600, color: N(s.sortie_deduite) < 0 ? 'var(--state-alarm)' : 'inherit' }}>{N(s.sortie_deduite)}</span> },
  ]

  const journalColumns = [
    { key: 'date_mouvement', header: 'Date', render: m => frDate(m.date_mouvement) },
    { key: 'categorie', header: 'Catégorie' },
    { key: 'produit', header: 'Produit', render: m => m.produit || '—' },
    { key: 'type', header: 'Type', render: m => <Badge tone={STOCK_MOVEMENT_TONES[m.type] || 'idle'}>{m.type}</Badge> },
    { key: 'source', header: 'Source', muted: true, render: m => m.source || '—' },
    { key: 'valeur', header: 'Qté / Valeur', numeric: true, align: 'right', render: m => m.valeur != null ? fcfa(m.valeur) : N(m.quantite) },
    { key: 'actions', header: '', align: 'right', render: m => <Button size="sm" tone="danger" onClick={() => delMvt(m.id)}>✕</Button> },
  ]

  const recentColumns = [
    { key: 'date_mouvement', header: 'Date', render: m => frDate(m.date_mouvement) },
    { key: 'produit', header: 'Produit', render: m => m.produit || m.categorie },
    { key: 'type', header: 'Type', render: m => <Badge tone={STOCK_MOVEMENT_TONES[m.type] || 'idle'}>{MOVEMENT_LABEL[m.type] || m.type}</Badge> },
    { key: 'valeur', header: 'Qté / Montant', numeric: true, align: 'right', render: m => m.valeur != null ? fcfa(m.valeur) : N(m.quantite) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}

      {/* ===== STOCK BAS — résumé immédiat, gérant/pompiste/admin ===== */}
      {!isVendeuse && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
          <Kpi label="Produits sous seuil" value={lowStockItems.length} status={lowStockItems.length > 0 ? 'alarm' : 'ok'} />
        </div>
      )}
      {!isVendeuse && lowStockItems.length > 0 && (
        <AlertBanner tone="alarm" title="Stock bas">
          {lowStockItems.map(s => `${s.produit} (${N(s.stock)}/${N(s.pr.seuil)})`).join(' · ')}
        </AlertBanner>
      )}

      {/* ===== VALORISATION — admin ===== */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
          {valeur.map(v => <Kpi key={v.categorie} label={`Valeur stock ${v.categorie}`} value={fcfa(v.valeur)} />)}
          <Kpi label="VALEUR TOTALE" value={fcfa(valTotal)} status="accent" />
        </div>
      )}

      {/* ===== STOCK ACTUEL (gaz/lub) — gérant/pompiste/admin ===== */}
      {!isVendeuse && (
        <Panel title="Stock restant" actions={isAdmin && ['gaz', 'lubrifiant'].map(c => (
          <Button key={c} size="sm" tone={showCats.includes(c) ? 'primary' : 'outline'} onClick={() => toggleCat(c)} style={{ textTransform: 'capitalize' }}>{c}</Button>
        ))}>
          <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
            Ce qu'il reste, d'après le <b>dernier comptage déclaré dans la Saisie du jour</b>. Ici tu n'ajoutes que les <b>entrées</b> (livraisons) — les sorties/ventes sont calculées toutes seules.
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
            {(isAdmin ? ['gaz', 'lubrifiant'].filter(c => showCats.includes(c)) : ['gaz', 'lubrifiant']).map(cat => (
              <div key={cat} style={{ flex: '1 1 260px' }}>
                <div style={{ font: 'var(--fw-semibold) 10px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-micro)', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>{cat}</div>
                {(stockByCat[cat] || []).length
                  ? <DataTable columns={productColumns(cat)} rows={(stockByCat[cat] || []).map(s => ({ ...s, id: s.produit }))} />
                  : <p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 0 }}>Aucun comptage encore.</p>}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ===== ACTIONS GUIDÉES — tout le monde ===== */}
      <Panel title={isVendeuse ? 'Supérette' : 'Que veux-tu faire ?'}>
        {!action ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
            <ActionTile icon="download" title="J'ai reçu une livraison" desc="Ajouter au stock ce qui vient d'arriver" onClick={() => openAction('entree')} />
            <ActionTile icon="wrench" title="Corriger après inventaire" desc="Ajuster si le compte réel diffère" onClick={() => openAction('ajustement')} />
          </div>
        ) : (
          <form onSubmit={addMvt} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <AlertBanner tone={action === 'entree' ? 'ok' : 'warn'} title={action === 'entree' ? 'Livraison' : 'Correction'}>
              {action === 'entree'
                ? 'Livraison reçue — indique ce qui est entré en stock.'
                : "Correction d'inventaire — indique la quantité (ou le montant) réellement constaté."}
            </AlertBanner>
            {!isVendeuse && (
              <Field label="Type de produit">
                <Select value={nm.categorie} onChange={e => setNm({ ...nm, categorie: e.target.value, produit: '' })} options={cats.map(([v, l]) => ({ value: v, label: l }))} style={{ width: '100%' }} />
              </Field>
            )}
            {nm.categorie === 'superette' ? (
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label={`Montant (F)${action === 'ajustement' ? ' — stock réel' : ''}`} style={{ flex: '1 1 180px' }}>
                  <Input type="text" inputMode="decimal" numeric autoFocus value={nm.valeur} onChange={e => setNm({ ...nm, valeur: e.target.value })} />
                </Field>
                <Field label="Date" style={{ flex: '1 1 160px' }}>
                  <Input type="date" value={nm.date_mouvement} max={today()} onChange={e => setNm({ ...nm, date_mouvement: e.target.value })} />
                </Field>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Produit" style={{ flex: '2 1 200px' }}>
                  <Select value={nm.produit} onChange={e => setNm({ ...nm, produit: e.target.value })}
                    options={[{ value: '', label: '— choisir —' }, ...products.filter(p => p.categorie === nm.categorie).map(p => ({ value: p.nom, label: p.nom }))]} style={{ width: '100%' }} />
                </Field>
                <Field label={`Quantité${action === 'ajustement' ? ' (écart)' : ''}`} style={{ flex: '1 1 140px' }}>
                  <Input type="text" inputMode="decimal" numeric value={nm.quantite} onChange={e => setNm({ ...nm, quantite: e.target.value })} />
                </Field>
                <Field label="Date" style={{ flex: '1 1 160px' }}>
                  <Input type="date" value={nm.date_mouvement} max={today()} onChange={e => setNm({ ...nm, date_mouvement: e.target.value })} />
                </Field>
              </div>
            )}
            <Field label="Note (facultatif)">
              <Input value={nm.note} onChange={e => setNm({ ...nm, note: e.target.value })} placeholder={action === 'entree' ? 'ex. bon de livraison n°…' : 'ex. casse, écart constaté…'} />
            </Field>
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <Button type="submit" tone="primary">Enregistrer</Button>
              <Button type="button" onClick={() => setAction(null)}>Annuler</Button>
            </div>
          </form>
        )}
      </Panel>

      {/* ===== SORTIES DÉDUITES — admin seulement (analyse, repliée par défaut) ===== */}
      {isAdmin && (() => {
        const js = sorties.filter(s =>
          (fYear === 'all' || (s.report_date || '').slice(0, 4) === fYear)
          && (fMonth === 'all' || (s.report_date || '').slice(5, 7) === fMonth))
        return (
          <Panel title="Sorties déduites (consommation)" meta="calculé automatiquement" flush
            bodyStyle={openSorties ? undefined : { display: 'none' }}
            actions={<IconButton icon="chevron-down" size="sm" title={openSorties ? 'Masquer' : 'Afficher'}
              onClick={() => setOpenSorties(v => !v)} style={{ transform: openSorties ? 'rotate(180deg)' : 'none' }} />}>
            <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
              Sortie = stock déclaré la veille + entrées du jour − stock déclaré du jour. Négatif = entrée oubliée (à vérifier).
            </p>
            <div style={{ marginTop: 'var(--sp-4)' }}>
              {js.length ? <DataTable columns={sortieColumns} rows={js.map((s, i) => ({ ...s, id: i }))} /> : <PanelEmpty icon="package" label="Rien à afficher (il faut au moins deux relevés consécutifs)" />}
            </div>
          </Panel>
        )
      })()}

      {/* ===== JOURNAL — admin seulement (repliée par défaut) ===== */}
      {isAdmin ? (() => {
        const base = mvts
        const years = [...new Set(base.map(m => (m.date_mouvement || '').slice(0, 4)).filter(Boolean))].sort()
        const jm = base.filter(m =>
          (fYear === 'all' || (m.date_mouvement || '').slice(0, 4) === fYear)
          && (fMonth === 'all' || (m.date_mouvement || '').slice(5, 7) === fMonth)
          && (!fProduit || (m.produit || '').toLowerCase().includes(fProduit.toLowerCase())))
        const totVal = jm.reduce((s, m) => s + (m.valeur != null ? N(m.valeur) * (m.type === 'sortie' ? -1 : 1) : 0), 0)
        return (
          <Panel title="Journal des mouvements" meta={`${jm.length}`} flush
            bodyStyle={openJournal ? undefined : { display: 'none' }}
            actions={<IconButton icon="chevron-down" size="sm" title={openJournal ? 'Masquer' : 'Afficher'}
              onClick={() => setOpenJournal(v => !v)} style={{ transform: openJournal ? 'rotate(180deg)' : 'none' }} />}>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'center', padding: 'var(--gutter-panel)', paddingBottom: 0 }}>
              <Input size="sm" value={fProduit} onChange={e => setFProduit(e.target.value)} placeholder="Rechercher un produit…" style={{ flex: '1 1 180px' }} />
              <Select size="sm" value={fYear} onChange={e => setFYear(e.target.value)} options={[{ value: 'all', label: 'Toutes années' }, ...years.map(y => ({ value: y, label: y }))]} />
              <Select size="sm" value={fMonth} onChange={e => setFMonth(e.target.value)} options={[{ value: 'all', label: 'Tous mois' }, ...MONTHS.map(m => ({ value: m, label: m }))]} />
              {(fYear !== 'all' || fMonth !== 'all' || fProduit) && <Button size="sm" onClick={() => { setFYear('all'); setFMonth('all'); setFProduit('') }}>Réinit.</Button>}
              <Tag>Solde : {fcfa(totVal)}</Tag>
            </div>
            <div style={{ marginTop: 'var(--sp-4)' }}>
              {jm.length ? <DataTable columns={journalColumns} rows={jm} /> : <PanelEmpty icon="calendar-days" label="Aucun mouvement sur cette période" />}
            </div>
          </Panel>
        )
      })() : (() => {
        // gérant/pompiste/vendeuse : liste simple des dernières entrées (pas de filtres, pas de suppression)
        const recent = mvts.filter(m => !isVendeuse || m.categorie === 'superette').slice(0, 15)
        return (
          <Panel title="Mes dernières entrées" flush>
            {recent.length ? <DataTable columns={recentColumns} rows={recent} /> : <PanelEmpty icon="calendar-days" label="Rien enregistré pour l'instant" />}
          </Panel>
        )
      })()}
    </div>
  )
}

function ActionTile({ icon, title, desc, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-6)', textAlign: 'center', cursor: 'pointer', background: 'var(--surface-raised)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-1)', transition: 'var(--t-control)' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}>
      <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-quiet)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} />
      </span>
      <div style={{ font: 'var(--fw-semibold) 13px/1.2 var(--font-ui)', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ font: '400 12px/1.3 var(--font-ui)', color: 'var(--text-muted)' }}>{desc}</div>
    </div>
  )
}
