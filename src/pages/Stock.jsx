import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useStation } from '../lib/station.jsx'
import { fcfa, frDate, numFR, today } from '../lib/format'
import { STOCK_MOVEMENT_TONES, STOCK_SOURCE_TONES } from '../lib/tones'
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
import { Tabs } from '../ds/octane/components/navigation/Tabs.jsx'
import { Kpi } from '../lib/Kpi.jsx'

const N = (v) => (v ? (numFR(v) ?? 0) : 0)
const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const CATS = [['gaz', 'Gaz'], ['lubrifiant', 'Lubrifiant'], ['superette', 'Supérette']]
const MOVEMENT_LABEL = { entree: 'Livraison', sortie: 'Sortie', ajustement: 'Inventaire' }

// Raisons proposées dans la tuile "Autre mouvement" — le sens (+/-) est dérivé
// automatiquement du type associé, l'utilisateur ne choisit jamais de signe.
const AUTRE_MOUVEMENT_SOURCES = [
  { source: 'casse', type: 'sortie' },
  { source: 'perte', type: 'sortie' },
  { source: 'consommation_interne', type: 'sortie' },
  { source: 'retour_fournisseur', type: 'sortie' },
  { source: 'retour_client', type: 'entree' },
  { source: 'vente', type: 'sortie' },
]

export default function Stock() {
  const { session, isAdmin, isVendeuse, isPompiste } = useAuth()
  const { stationId } = useStation()
  const [stock, setStock] = useState([])
  const [valeur, setValeur] = useState([])
  const [mvts, setMvts] = useState([])
  const [sorties, setSorties] = useState([])
  const [theorique, setTheorique] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [reorderLub, setReorderLub] = useState([])
  const [products, setProducts] = useState([])
  const [lubTab, setLubTab] = useState('ecart')   // onglet actif du bloc "Lubrifiant — détail" (écart / historique / réappro)
  const [histProduit, setHistProduit] = useState('')
  const [action, setAction] = useState(null)   // null | 'entree' | 'ajustement'
  const [nm, setNm] = useState(blank('entree'))
  const [fYear, setFYear] = useState('all'); const [fMonth, setFMonth] = useState('all')
  const [fProduit, setFProduit] = useState('')
  const [stockTab, setStockTab] = useState('gaz')   // onglet actif de "Stock restant" (détail par produit)
  const [openSorties, setOpenSorties] = useState(false)
  const [openJournal, setOpenJournal] = useState(false)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  function openAction(action, overrides) { setNm({ ...blank(action), ...overrides }); setAction(action); setErr('') }
  function blank(action) {
    const base = { categorie: isVendeuse ? 'superette' : 'gaz', produit: '', quantite: '', qteCartons: '', qteUnites: '', valeur: '', note: '', date_mouvement: today() }
    if (action === 'sortie') return { ...base, type: 'sortie', source: 'casse' }
    if (action === 'ajustement') return { ...base, type: 'ajustement', source: 'inventaire' }
    if (action === 'correction') return { ...base, type: 'ajustement', source: 'correction_inventaire' }
    return { ...base, type: 'entree', source: 'achat' }
  }

  async function load() {
    if (!stationId) return
    const [sp, sv, mv, so, pr, th, sn, ro] = await Promise.all([
      supabase.from('v_stock_produits').select('*').eq('station_id', stationId),
      supabase.from('v_stock_valeur').select('*').eq('station_id', stationId),
      supabase.from('stock_movements').select('*').eq('station_id', stationId).order('date_mouvement', { ascending: false }).limit(400),
      supabase.from('v_sorties_deduites').select('*').eq('station_id', stationId).order('report_date', { ascending: false }).limit(400),
      supabase.from('products').select('*').eq('actif', true).order('ordre'),
      supabase.from('v_stock_theorique').select('*').eq('station_id', stationId),
      supabase.from('stock_declarations_snapshot').select('*').eq('station_id', stationId).order('report_date', { ascending: false }).limit(200),
      supabase.from('v_reorder_lubrifiant').select('*').eq('station_id', stationId),
    ])
    setStock(sp.data || []); setValeur(sv.data || []); setMvts(mv.data || []); setSorties(so.data || []); setProducts(pr.data || [])
    setTheorique(th.data || []); setSnapshots(sn.data || []); setReorderLub(ro.data || [])
  }
  useEffect(() => { load() }, [stationId])
  const flash = (m) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500) }

  async function addMvt(e) {
    e.preventDefault(); setErr('')
    if (action === 'correction' && !nm.note.trim()) { setErr("Motif obligatoire pour une correction d'inventaire."); return }
    const row = { station_id: stationId, categorie: nm.categorie, type: nm.type, source: nm.source || null, note: nm.note || null, date_mouvement: nm.date_mouvement, created_by: session.user.id }
    if (nm.categorie === 'superette') {
      if (!nm.valeur) { setErr('Renseigne le montant (F).'); return }
      row.valeur = numFR(nm.valeur)
    } else {
      if (!nm.produit) { setErr('Choisis un produit.'); return }
      const pr = products.find(p => p.categorie === nm.categorie && p.nom === nm.produit)
      const hasCondit = pr && N(pr.conditionnement_qte) > 0
      row.produit = nm.produit
      if (hasCondit) {
        const cartons = N(nm.qteCartons), unites = N(nm.qteUnites)
        const total = cartons * N(pr.conditionnement_qte) + unites
        if (!total) { setErr('Renseigne une quantité.'); return }
        row.quantite = total
        row.facteur_conversion = N(pr.conditionnement_qte)
        if (cartons && unites) {
          row.unite_saisie = 'mixte'; row.qte_saisie = total
          row.detail_saisie = `${cartons} ${pr.conditionnement_nom || 'carton'}${cartons > 1 ? 's' : ''} + ${unites} ${pr.unite || 'unité'}${unites > 1 ? 's' : ''}`
        } else if (cartons) { row.unite_saisie = pr.conditionnement_nom || 'carton'; row.qte_saisie = cartons }
        else { row.unite_saisie = pr.unite || 'unite'; row.qte_saisie = unites }
      } else {
        if (!nm.quantite) { setErr('Renseigne une quantité.'); return }
        row.quantite = numFR(nm.quantite)
        row.unite_saisie = pr?.unite || 'unite'; row.qte_saisie = row.quantite
      }
    }
    const { error } = await supabase.from('stock_movements').insert(row)
    if (error) setErr(error.message)
    else {
      setAction(null)
      flash({ entree: 'Livraison enregistrée', sortie: 'Mouvement enregistré', ajustement: 'Inventaire corrigé', correction: "Correction d'inventaire enregistrée" }[action] || 'Mouvement enregistré')
      load()
    }
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

  // Théorique vs déclaré (points 7-9 du cahier des charges lubrifiant) : le stock déclaré
  // reste la référence affichée ailleurs (Stock restant) — ce panneau compare en plus au
  // stock reconstruit depuis les mouvements, pour faire apparaître un écart à justifier.
  const ecartRows = useMemo(() => theorique
    .filter(t => t.categorie === 'lubrifiant')
    .map(t => ({ ...t, ecart: N(t.stock_declare) - N(t.stock_theorique) })), [theorique])

  const REGUL_SOURCES = ['casse', 'perte', 'consommation_interne', 'retour_fournisseur', 'retour_client', 'vente', 'correction_inventaire']
  const histRows = useMemo(() => snapshots
    .filter(s => s.categorie === 'lubrifiant' && (!histProduit || s.produit === histProduit))
    .map(s => {
      const regularisations = mvts.filter(m => m.categorie === s.categorie && m.produit === s.produit && m.date_mouvement === s.report_date && REGUL_SOURCES.includes(m.source)).length
      const cur = theorique.find(t => t.categorie === s.categorie && t.produit === s.produit)
      const isLatest = cur && cur.date_declare === s.report_date
      return { ...s, id: s.id, regularisations, ecartFinal: isLatest ? N(cur.stock_declare) - N(cur.stock_theorique) : null }
    }), [snapshots, mvts, theorique, histProduit])

  const ecartColumns = [
    { key: 'produit', header: 'Produit' },
    { key: 'stock_declare', header: 'Déclaré', numeric: true, align: 'right', render: t => N(t.stock_declare) },
    { key: 'stock_theorique', header: 'Théorique', numeric: true, align: 'right', muted: true, render: t => N(t.stock_theorique) },
    { key: 'ecart', header: 'Écart', numeric: true, align: 'right', render: t => (
      <span style={{ fontWeight: 600, color: Math.abs(t.ecart) < 0.5 ? 'var(--state-ok)' : 'var(--state-alarm)' }}>{t.ecart > 0 ? '+' : ''}{t.ecart}</span>
    ) },
    { key: 'actions', header: '', align: 'right', render: t => Math.abs(t.ecart) >= 0.5 && !isVendeuse ? (
      <Button size="sm" tone="alarm" onClick={() => openAction('sortie', { categorie: 'lubrifiant', produit: t.produit })}>Expliquer l'écart</Button>
    ) : null },
  ]

  const reorderColumns = [
    { key: 'produit', header: 'Produit' },
    { key: 'stock_theorique_actuel', header: 'Stock', numeric: true, align: 'right', render: r => N(r.stock_theorique_actuel) },
    { key: 'conso_moy_jour', header: 'Conso/jour', numeric: true, align: 'right', muted: true, render: r => N(r.conso_moy_jour).toFixed(1) },
    { key: 'stock_cible', header: 'Cible', numeric: true, align: 'right', muted: true, render: r => N(r.stock_cible) },
    { key: 'quantite_a_commander', header: 'À commander', numeric: true, align: 'right', render: r => {
      if (r.commande_en_cours) return <Badge tone="info">Déjà en cours</Badge>
      if (N(r.quantite_a_commander) <= 0) return <span style={{ color: 'var(--state-ok)' }}>—</span>
      return <span style={{ fontWeight: 600, color: 'var(--state-alarm)' }}>{N(r.quantite_a_commander)} {r.conditionnement_qte ? '(' + N(r.cartons_a_commander) + ' ' + (r.conditionnement_nom || 'carton') + '(s))' : ''}</span>
    } },
    { key: 'cout_estimatif', header: 'Coût estimé', numeric: true, align: 'right', muted: true, render: r => r.quantite_a_commander > 0 && !r.commande_en_cours ? fcfa(r.cout_estimatif) : '—' },
  ]

  const histColumns = [
    { key: 'report_date', header: 'Date', render: s => frDate(s.report_date) },
    { key: 'produit', header: 'Produit' },
    { key: 'stock_theorique_a_la_declaration', header: 'Théorique', numeric: true, align: 'right', muted: true, render: s => N(s.stock_theorique_a_la_declaration) },
    { key: 'stock_declare', header: 'Déclaré', numeric: true, align: 'right', render: s => N(s.stock_declare) },
    { key: 'ecart_initial', header: 'Écart initial', numeric: true, align: 'right', render: s => <span style={{ color: Math.abs(N(s.ecart_initial)) < 0.5 ? 'var(--state-ok)' : 'var(--state-alarm)' }}>{N(s.ecart_initial) > 0 ? '+' : ''}{N(s.ecart_initial)}</span> },
    { key: 'regularisations', header: 'Mvts régul.', numeric: true, align: 'right', muted: true, render: s => s.regularisations || '—' },
    { key: 'ecartFinal', header: 'Écart final', numeric: true, align: 'right', render: s => s.ecartFinal == null ? <span style={{ color: 'var(--text-muted)' }}>figé</span> : <span style={{ fontWeight: 600, color: Math.abs(s.ecartFinal) < 0.5 ? 'var(--state-ok)' : 'var(--state-alarm)' }}>{s.ecartFinal > 0 ? '+' : ''}{s.ecartFinal}</span> },
  ]

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
    { key: 'source', header: 'Source', render: m => m.source ? <Badge tone={STOCK_SOURCE_TONES[m.source]?.tone || 'idle'}>{STOCK_SOURCE_TONES[m.source]?.label || m.source}</Badge> : '—' },
    { key: 'valeur', header: 'Qté / Valeur', numeric: true, align: 'right', render: m => m.valeur != null ? fcfa(m.valeur) : N(m.quantite) },
    { key: 'actions', header: '', align: 'right', render: m => <Button size="sm" tone="danger" onClick={() => delMvt(m.id)}>✕</Button> },
  ]

  const recentColumns = [
    { key: 'date_mouvement', header: 'Date', render: m => frDate(m.date_mouvement) },
    { key: 'produit', header: 'Produit', render: m => m.produit || m.categorie },
    { key: 'type', header: 'Type', render: m => <Badge tone={STOCK_MOVEMENT_TONES[m.type] || 'idle'}>{STOCK_SOURCE_TONES[m.source]?.label || MOVEMENT_LABEL[m.type] || m.type}</Badge> },
    { key: 'valeur', header: 'Qté / Montant', numeric: true, align: 'right', render: m => m.valeur != null ? fcfa(m.valeur) : N(m.quantite) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}

      {/* ===== ACTIONS GUIDÉES — tout le monde, en premier ===== */}
      <Panel title={isVendeuse ? 'Supérette' : 'Que veux-tu faire ?'}>
        {!action ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-4)' }}>
            <ActionTile icon="download" title="J'ai reçu une livraison" desc="Ajouter au stock ce qui vient d'arriver" onClick={() => openAction('entree')} />
            <ActionTile icon="rotate-ccw" title="Autre mouvement" desc="Casse, perte, consommation interne, retour…" onClick={() => openAction('sortie')} />
            <ActionTile icon="wrench" title="Corriger après inventaire" desc="Ajuster si le compte réel diffère" onClick={() => openAction('ajustement')} />
            {isAdmin && <ActionTile icon="shield-alert" title="Correction d'inventaire" desc="Dernier recours — écart inexpliqué, motif obligatoire" onClick={() => openAction('correction')} />}
          </div>
        ) : (
          <form onSubmit={addMvt} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <AlertBanner tone={action === 'entree' ? 'ok' : action === 'correction' ? 'alarm' : 'warn'} title={{ entree: 'Livraison', sortie: 'Autre mouvement', ajustement: 'Correction', correction: "Correction d'inventaire" }[action]}>
              {{
                entree: 'Livraison reçue — indique ce qui est entré en stock.',
                sortie: 'Choisis la raison : le sens (+/-) est appliqué automatiquement.',
                ajustement: "Correction d'inventaire — indique la quantité (ou le montant) réellement constaté.",
                correction: "Dernier recours si l'écart ne s'explique par aucun mouvement normal — motif obligatoire, mouvement identifié distinctement.",
              }[action]}
            </AlertBanner>
            {!isVendeuse && (
              <Field label="Type de produit">
                <Select value={nm.categorie} onChange={e => setNm({ ...nm, categorie: e.target.value, produit: '', quantite: '', qteCartons: '', qteUnites: '' })} options={cats.map(([v, l]) => ({ value: v, label: l }))} style={{ width: '100%' }} />
              </Field>
            )}
            {action === 'sortie' && (
              <Field label="Raison">
                <Select value={nm.source} onChange={e => {
                  const s = AUTRE_MOUVEMENT_SOURCES.find(s => s.source === e.target.value)
                  setNm({ ...nm, source: e.target.value, type: s?.type || 'sortie' })
                }} options={AUTRE_MOUVEMENT_SOURCES.map(s => ({ value: s.source, label: STOCK_SOURCE_TONES[s.source]?.label || s.source }))} style={{ width: '100%' }} />
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
                  <Select value={nm.produit} onChange={e => setNm({ ...nm, produit: e.target.value, quantite: '', qteCartons: '', qteUnites: '' })}
                    options={[{ value: '', label: '— choisir —' }, ...products.filter(p => p.categorie === nm.categorie).map(p => ({ value: p.nom, label: p.nom }))]} style={{ width: '100%' }} />
                </Field>
                {(() => {
                  const pr = products.find(p => p.categorie === nm.categorie && p.nom === nm.produit)
                  const hasCondit = pr && N(pr.conditionnement_qte) > 0
                  if (!hasCondit) {
                    return (
                      <Field label={`Quantité${action === 'ajustement' ? ' (écart)' : ''}`} style={{ flex: '1 1 140px' }}>
                        <Input type="text" inputMode="decimal" numeric value={nm.quantite} onChange={e => setNm({ ...nm, quantite: e.target.value })} />
                      </Field>
                    )
                  }
                  const total = N(nm.qteCartons) * N(pr.conditionnement_qte) + N(nm.qteUnites)
                  return (
                    <>
                      <Field label={`Nb. ${pr.conditionnement_nom || 'carton'}s`} style={{ flex: '1 1 120px' }}>
                        <Input type="text" inputMode="decimal" numeric value={nm.qteCartons} onChange={e => setNm({ ...nm, qteCartons: e.target.value })} />
                      </Field>
                      <Field label={`Nb. ${pr.unite || 'unité'}s`} style={{ flex: '1 1 120px' }}>
                        <Input type="text" inputMode="decimal" numeric value={nm.qteUnites} onChange={e => setNm({ ...nm, qteUnites: e.target.value })} />
                      </Field>
                      <div style={{ flex: '1 1 140px', display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
                        <Tag>= {total} {pr.unite || 'unité'}{total > 1 ? 's' : ''}</Tag>
                      </div>
                    </>
                  )
                })()}
                <Field label="Date" style={{ flex: '1 1 160px' }}>
                  <Input type="date" value={nm.date_mouvement} max={today()} onChange={e => setNm({ ...nm, date_mouvement: e.target.value })} />
                </Field>
              </div>
            )}
            <Field label={action === 'correction' ? 'Motif (obligatoire)' : 'Note (facultatif)'}>
              <Input value={nm.note} onChange={e => setNm({ ...nm, note: e.target.value })} placeholder={action === 'entree' ? 'ex. bon de livraison n°…' : action === 'correction' ? "ex. écart d'inventaire du 18/08/2026" : 'ex. casse, écart constaté…'} />
            </Field>
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <Button type="submit" tone="primary">Enregistrer</Button>
              <Button type="button" onClick={() => setAction(null)}>Annuler</Button>
            </div>
          </form>
        )}
      </Panel>

      {/* ===== MÉTRIQUES — stock bas + valorisation, une seule ligne — gérant/pompiste/admin ===== */}
      {!isVendeuse && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
          <Kpi label="Produits sous seuil" value={lowStockItems.length} status={lowStockItems.length > 0 ? 'alarm' : 'ok'} />
          {isAdmin && valeur.map(v => <Kpi key={v.categorie} label={`Valeur stock ${v.categorie}`} value={fcfa(v.valeur)} />)}
          {isAdmin && <Kpi label="VALEUR TOTALE" value={fcfa(valTotal)} status="accent" />}
        </div>
      )}
      {!isVendeuse && lowStockItems.length > 0 && (
        <AlertBanner tone="alarm" title="Stock bas">
          {lowStockItems.map(s => `${s.produit} (${N(s.stock)}/${N(s.pr.seuil)})`).join(' · ')}
        </AlertBanner>
      )}

      {/* ===== STOCK ACTUEL (gaz/lub) — détail par produit dans un onglet — gérant/pompiste/admin ===== */}
      {!isVendeuse && (
        <Panel title="Stock restant" flush>
          <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
            Ce qu'il reste, d'après le <b>dernier comptage déclaré dans la Saisie du jour</b>. Ici tu n'ajoutes que les <b>entrées</b> (livraisons) — les sorties/ventes sont calculées toutes seules.
          </p>
          <Tabs items={[{ value: 'gaz', label: 'Gaz' }, { value: 'lubrifiant', label: 'Lubrifiant' }]} value={stockTab} onChange={setStockTab} />
          <div style={{ marginTop: 'var(--sp-4)' }}>
            {(stockByCat[stockTab] || []).length
              ? <DataTable columns={productColumns(stockTab)} rows={(stockByCat[stockTab] || []).map(s => ({ ...s, id: s.produit }))} />
              : <p style={{ font: '400 12px/1 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--gutter-panel)' }}>Aucun comptage encore.</p>}
          </div>
        </Panel>
      )}

      {/* ===== LUBRIFIANT — DÉTAIL — regroupe écart / historique / réappro en un seul bloc à onglets
          (auparavant 3 panneaux séparés dispersés sur la page) — gérant/pompiste/admin ===== */}
      {!isVendeuse && (ecartRows.length > 0 || reorderLub.length > 0 || (isAdmin && snapshots.length > 0)) && (() => {
        const tabs = [
          ecartRows.length > 0 && { value: 'ecart', label: 'Théorique vs déclaré' },
          isAdmin && snapshots.length > 0 && { value: 'historique', label: 'Historique quotidien' },
          reorderLub.length > 0 && { value: 'reappro', label: 'Suggestions de commande' },
        ].filter(Boolean)
        const active = tabs.some(t => t.value === lubTab) ? lubTab : tabs[0].value
        return (
          <Panel title="Lubrifiant — détail" flush>
            <Tabs items={tabs} value={active} onChange={setLubTab} />
            {active === 'ecart' && (<>
              <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
                Théorique = dernier stock déclaré + mouvements enregistrés depuis. Si l'écart n'est pas nul, cherche la cause (casse, perte…) avant de recourir à une correction d'inventaire.
              </p>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <DataTable columns={ecartColumns} rows={ecartRows.map((r, i) => ({ ...r, id: i }))} />
              </div>
            </>)}
            {active === 'historique' && (<>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', padding: 'var(--gutter-panel)', paddingBottom: 0 }}>
                <Select size="sm" value={histProduit} onChange={e => setHistProduit(e.target.value)}
                  options={[{ value: '', label: 'Tous les produits' }, ...products.filter(p => p.categorie === 'lubrifiant').map(p => ({ value: p.nom, label: p.nom }))]} />
              </div>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                {histRows.length ? <DataTable columns={histColumns} rows={histRows} /> : <PanelEmpty icon="calendar-days" label="Aucune déclaration figée pour l'instant" />}
              </div>
            </>)}
            {active === 'reappro' && (<>
              <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
                Cible = seuil ou consommation moyenne × (délai livraison + jours de sécurité), selon le plus élevé. Le nombre de cartons est calculé automatiquement.
              </p>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <DataTable columns={reorderColumns} rows={reorderLub.map((r, i) => ({ ...r, id: i }))} />
              </div>
            </>)}
          </Panel>
        )
      })()}

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
