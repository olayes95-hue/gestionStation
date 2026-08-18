import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Panel } from '../ds/octane/components/core/Panel.jsx'
import { Button } from '../ds/octane/components/core/Button.jsx'
import { Field } from '../ds/octane/components/forms/Field.jsx'
import { Input } from '../ds/octane/components/forms/Input.jsx'
import { Select } from '../ds/octane/components/forms/Select.jsx'
import { Checkbox } from '../ds/octane/components/forms/Checkbox.jsx'
import { AlertBanner } from '../ds/octane/components/feedback/AlertBanner.jsx'
import { DataTable } from '../ds/octane/components/data/DataTable.jsx'
import { Tabs } from '../ds/octane/components/navigation/Tabs.jsx'

const ROLE_OPTIONS = [
  { value: 'pompiste', label: 'Pompiste' },
  { value: 'vendeuse', label: 'Vendeuse' },
  { value: 'gerant', label: 'Gérant' },
  { value: 'admin', label: 'Admin' },
]

const TABS = [
  { value: 'stations', label: 'Stations' },
  { value: 'equipe', label: 'Équipe' },
  { value: 'parametres', label: 'Paramètres' },
]

export default function Stations() {
  const [stations, setStations] = useState([])
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState(null)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const [newName, setNewName] = useState('')
  const [tab, setTab] = useState('stations')

  async function load() {
    const [s, u, st] = await Promise.all([
      supabase.from('stations').select('*').order('id'),
      supabase.from('profiles').select('id, full_name, role, station_id').order('full_name'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ])
    setStations(s.data || []); setUsers(u.data || []); setSettings(st.data || null)
  }
  useEffect(() => { load() }, [])

  const flash = (m) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 2500) }
  const fail = (e) => { setErr(e.message || String(e)) }

  async function saveStation(s) {
    const { error } = await supabase.from('stations').update({
      nom: s.nom, compte_bancaire: s.compte_bancaire,
      seuil_essence: num(s.seuil_essence), seuil_gasoil: num(s.seuil_gasoil),
      seuil_gaz: num(s.seuil_gaz), seuil_lubrifiant: num(s.seuil_lubrifiant),
      capacite_essence: num(s.capacite_essence) ?? 20000, capacite_gasoil: num(s.capacite_gasoil) ?? 20000,
      nombre_machines: Math.min(10, Math.max(1, num(s.nombre_machines) ?? 4)),
    }).eq('id', s.id)
    error ? fail(error) : flash('Station enregistrée')
  }
  async function addStation(e) {
    e.preventDefault(); if (!newName) return
    const { error } = await supabase.from('stations').insert({ nom: newName })
    if (error) fail(error); else { setNewName(''); load(); flash('Station ajoutée') }
  }
  async function saveUser(u) {
    const { error } = await supabase.from('profiles').update({
      role: u.role, station_id: u.station_id ? Number(u.station_id) : null,
    }).eq('id', u.id)
    error ? fail(error) : flash('Membre mis à jour')
  }
  async function savePrices(e) {
    e.preventDefault()
    const { error } = await supabase.from('settings').update({
      essence_pv: num(settings.essence_pv), gasoil_pv: num(settings.gasoil_pv), marge_unitaire: num(settings.marge_unitaire),
      essence_pa: num(settings.essence_pa), gasoil_pa: num(settings.gasoil_pa),
      taux_gaz: num(settings.taux_gaz), taux_superette: num(settings.taux_superette),
      seuil_rupture: num(settings.seuil_rupture),
      bons_utilisables_commande: !!settings.bons_utilisables_commande,
      pompe_inactive_apres: num(settings.pompe_inactive_apres) ?? 5,
      jours_correction_gerant: Math.max(0, num(settings.jours_correction_gerant) ?? 2),
      deconnexion_auto_heures: Math.max(1, num(settings.deconnexion_auto_heures) ?? 24),
    }).eq('id', 1)
    error ? fail(error) : flash('Prix enregistrés')
  }

  const upS = (id, k, v) => setStations(p => p.map(s => s.id === id ? { ...s, [k]: v } : s))
  const upU = (id, k, v) => setUsers(p => p.map(u => u.id === id ? { ...u, [k]: v } : u))

  const stationOptions = [{ value: '', label: '— toutes / aucune —' }, ...stations.map(s => ({ value: s.id, label: s.nom }))]

  const userColumns = [
    { key: 'full_name', header: 'Nom' },
    { key: 'role', header: 'Rôle', render: u => <Select size="sm" value={u.role} onChange={e => upU(u.id, 'role', e.target.value)} options={ROLE_OPTIONS} style={{ width: '100%' }} /> },
    { key: 'station_id', header: 'Station', render: u => <Select size="sm" value={u.station_id || ''} onChange={e => upU(u.id, 'station_id', e.target.value)} options={stationOptions} style={{ width: '100%' }} /> },
    { key: 'actions', header: '', align: 'right', render: u => <Button size="sm" tone="primary" onClick={() => saveUser(u)}>OK</Button> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {msg && <AlertBanner tone="ok" title="Succès">{msg}</AlertBanner>}
      {err && <AlertBanner tone="alarm" title="Erreur">{err}</AlertBanner>}

      <Tabs items={TABS} value={tab} onChange={setTab} />

      {tab === 'stations' && (
      <Panel title="Stations">
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
          Nom, compte bancaire et seuils d'alerte de stock bas (en litres).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {stations.map(s => (
            <div key={s.id} style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Nom" style={{ flex: '1 1 160px' }}><Input value={s.nom || ''} onChange={e => upS(s.id, 'nom', e.target.value)} /></Field>
                <Field label="Compte bancaire" style={{ flex: '1 1 160px' }}><Input value={s.compte_bancaire || ''} onChange={e => upS(s.id, 'compte_bancaire', e.target.value)} /></Field>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Seuil essence (L)" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={s.seuil_essence ?? ''} onChange={e => upS(s.id, 'seuil_essence', e.target.value)} /></Field>
                <Field label="Seuil gasoil (L)" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={s.seuil_gasoil ?? ''} onChange={e => upS(s.id, 'seuil_gasoil', e.target.value)} /></Field>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Seuil gaz (bouteilles/type)" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={s.seuil_gaz ?? ''} onChange={e => upS(s.id, 'seuil_gaz', e.target.value)} /></Field>
                <Field label="Seuil lubrifiant (unités)" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={s.seuil_lubrifiant ?? ''} onChange={e => upS(s.id, 'seuil_lubrifiant', e.target.value)} /></Field>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Capacité cuve essence (L)" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={s.capacite_essence ?? 20000} onChange={e => upS(s.id, 'capacite_essence', e.target.value)} /></Field>
                <Field label="Capacité cuve gasoil (L)" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={s.capacite_gasoil ?? 20000} onChange={e => upS(s.id, 'capacite_gasoil', e.target.value)} /></Field>
                <Field label="Nombre de machines" hint="1 à 10 — chaque machine a une pompe essence + une gasoil" style={{ flex: '1 1 140px' }}>
                  <Input type="number" numeric min={1} max={10} value={s.nombre_machines ?? 4} onChange={e => upS(s.id, 'nombre_machines', e.target.value)} />
                </Field>
              </div>
              <Button tone="primary" onClick={() => saveStation(s)} style={{ alignSelf: 'flex-start' }}>Enregistrer</Button>
            </div>
          ))}
        </div>
        <form onSubmit={addStation} style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nouvelle station…" style={{ flex: 1 }} />
          <Button type="submit" tone="primary">+ Ajouter</Button>
        </form>
      </Panel>
      )}

      {tab === 'equipe' && (
      <Panel title="Équipe" flush>
        <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', margin: 'var(--sp-4) var(--gutter-panel) 0' }}>
          Rattache chaque gérant à sa station. Un admin voit toutes les stations.
        </p>
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <DataTable columns={userColumns} rows={users} />
        </div>
      </Panel>
      )}

      {tab === 'parametres' && settings && (
        <Panel title="Prix & marge">
          <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
            Prix de vente (pré-remplis dans la saisie), prix d'achat (coût des commandes) et marge, en FCFA/L.
          </p>
          <form onSubmit={savePrices} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            <FormSection title="Prix de vente">
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Essence" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={settings.essence_pv} onChange={e => setSettings({ ...settings, essence_pv: e.target.value })} /></Field>
                <Field label="Gasoil" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={settings.gasoil_pv} onChange={e => setSettings({ ...settings, gasoil_pv: e.target.value })} /></Field>
                <Field label="Marge (F/L)" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={settings.marge_unitaire} onChange={e => setSettings({ ...settings, marge_unitaire: e.target.value })} /></Field>
              </div>
            </FormSection>
            <FormSection title="Prix d'achat">
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Essence" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={settings.essence_pa ?? ''} onChange={e => setSettings({ ...settings, essence_pa: e.target.value })} /></Field>
                <Field label="Gasoil" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={settings.gasoil_pa ?? ''} onChange={e => setSettings({ ...settings, gasoil_pa: e.target.value })} /></Field>
              </div>
            </FormSection>
            <FormSection title="Taux de commission autres pôles (%)">
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                <Field label="Gaz + lubrifiant" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={settings.taux_gaz ?? ''} onChange={e => setSettings({ ...settings, taux_gaz: e.target.value })} /></Field>
                <Field label="Supérette" style={{ flex: '1 1 140px' }}><Input type="number" numeric value={settings.taux_superette ?? ''} onChange={e => setSettings({ ...settings, taux_superette: e.target.value })} /></Field>
              </div>
            </FormSection>
            <FormSection title="Seuil de rupture cuve (L)">
              <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
                Niveau physique en dessous duquel il n'y a plus de ventes normales (crépine de la pompe). Sert de base aux prédictions (jours d'autonomie, date de rupture, alerte « commander maintenant ») — le stock utile = stock en cuve − ce seuil.
              </p>
              <Field label="Essence + Gasoil" style={{ maxWidth: 160 }}><Input type="number" numeric value={settings.seuil_rupture ?? 250} onChange={e => setSettings({ ...settings, seuil_rupture: e.target.value })} /></Field>
            </FormSection>
            <FormSection title="Financement des commandes">
              <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
                Quand les bons seront virés directement en banque, désactive cette option : le formulaire de commande n'affichera plus que le chèque comme mode de paiement (carburant + gaz/lubrifiant).
              </p>
              <Checkbox label="Les bons peuvent financer une commande" checked={settings.bons_utilisables_commande !== false} onChange={v => setSettings({ ...settings, bons_utilisables_commande: v })} />
            </FormSection>
            <FormSection title="Correction des saisies par le gérant">
              <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
                Nombre de jours en arrière pendant lesquels le gérant (et la vendeuse) peuvent créer ou corriger le point d'une journée — au-delà, la journée est verrouillée et seul l'admin peut intervenir.
              </p>
              <Field label="N — jours en arrière" style={{ maxWidth: 160 }}>
                <Input type="number" numeric value={settings.jours_correction_gerant ?? 2} onChange={e => setSettings({ ...settings, jours_correction_gerant: e.target.value })} />
              </Field>
            </FormSection>
            <FormSection title="Déconnexion automatique">
              <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
                Tout utilisateur est déconnecté automatiquement N heures après sa connexion, même si l'onglet reste ouvert — utile sur les téléphones partagés en station.
              </p>
              <Field label="N — heures" hint="1 jour = 24" style={{ maxWidth: 160 }}>
                <Input type="number" numeric value={settings.deconnexion_auto_heures ?? 24} onChange={e => setSettings({ ...settings, deconnexion_auto_heures: e.target.value })} />
              </Field>
            </FormSection>
            <FormSection title="Détection pompes inactives">
              <p style={{ font: '400 12px/1.4 var(--font-ui)', color: 'var(--text-muted)', marginTop: 0 }}>
                Une pompe (E1-E4, G1-G4) est signalée « hors service » dans le Journal de bord si son relevé 16h n'a pas bougé sur les N dernières saisies où elle a été renseignée.
              </p>
              <Field label="N — nombre de saisies" style={{ maxWidth: 160 }}>
                <Input type="number" numeric value={settings.pompe_inactive_apres ?? 5} onChange={e => setSettings({ ...settings, pompe_inactive_apres: e.target.value })} />
              </Field>
            </FormSection>
            <Button type="submit" tone="primary" style={{ alignSelf: 'flex-start' }}>Enregistrer les prix</Button>
          </form>
        </Panel>
      )}
    </div>
  )
}

function FormSection({ title, children }) {
  return (
    <div style={{ padding: 'var(--sp-4)', background: 'var(--surface-raised)', borderRadius: 'var(--radius-1)', border: '1px solid var(--border-hairline)' }}>
      <div style={{ font: 'var(--fw-semibold) 11px/1 var(--font-ui)', textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }}>{title}</div>
      {children}
    </div>
  )
}

const num = (v) => (v === '' || v == null || isNaN(v) ? null : Number(v))
