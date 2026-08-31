import { useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import { StationProvider, useStation } from './lib/station.jsx'
import Login from './pages/Login.jsx'
import NotifBanner from './components/NotifBanner.jsx'
import { SideNav } from './ds/octane/components/navigation/SideNav.jsx'
import { Toolbar } from './ds/octane/components/navigation/Toolbar.jsx'
import { IconButton } from './ds/octane/components/core/IconButton.jsx'
import { Select } from './ds/octane/components/forms/Select.jsx'
import { Tag } from './ds/octane/components/core/Tag.jsx'
import { Icon } from './ds/octane/components/core/Icon.jsx'
import { Viewport } from './ds/octane/components/core/Viewport.jsx'
import { Button } from './ds/octane/components/core/Button.jsx'

// Chargées à la demande : réduit fortement le bundle initial (surtout pour gérant/vendeuse).
const Submit = lazy(() => import('./pages/Submit.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const AlertsPage = lazy(() => import('./pages/Alerts.jsx'))
const History = lazy(() => import('./pages/History.jsx'))
const Suppliers = lazy(() => import('./pages/Suppliers.jsx'))
const Stations = lazy(() => import('./pages/Stations.jsx'))
const BankRecon = lazy(() => import('./pages/BankRecon.jsx'))
const Orders = lazy(() => import('./pages/Orders.jsx'))
const Inspections = lazy(() => import('./pages/Inspections.jsx'))
const OcrCheck = lazy(() => import('./pages/OcrCheck.jsx'))
const AuditLog = lazy(() => import('./pages/AuditLog.jsx'))
const Finance = lazy(() => import('./pages/Finance.jsx'))
const Products = lazy(() => import('./pages/Products.jsx'))
const Stock = lazy(() => import('./pages/Stock.jsx'))
const Aide = lazy(() => import('./pages/Aide.jsx'))
const Journal = lazy(() => import('./pages/Journal.jsx'))

function StationPicker() {
  const { stations, stationId, setStationId, current } = useStation()
  if (stations.length <= 1) return <Tag><Icon name="map-pin" size={11} /> {current?.nom || 'Ma station'}</Tag>
  return (
    <Select size="sm" value={stationId || ''} onChange={e => setStationId(Number(e.target.value))}
      options={stations.map(s => ({ value: s.id, label: s.nom }))} />
  )
}

function Shell({ children }) {
  const { profile, roleLabel, isAdmin, isPompiste, isVendeuse, can, signOut } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  // Rôles historiques (gérant/pompiste/vendeuse/admin) gardent l'accès opérationnel qu'ils
  // ont toujours eu ; tout autre rôle (directeur/comptable, ou un futur rôle créé depuis
  // l'écran Rôles) ne le reçoit que via la permission manage_orders — pas de Saisie du jour /
  // Stock / Journal / Contrôles pour un profil purement analytique ou financier.
  const hasOperationalAccess = isAdmin || profile?.role === 'gerant' || isPompiste || isVendeuse || can('manage_orders')

  const pilotage = [
    can('view_dashboard') && { to: '/tableau', icon: 'layout-dashboard', label: 'Tableau de bord' },
    can('view_history') && { to: '/historique', icon: 'calendar-days', label: 'Historique' },
    can('view_alerts') && { to: '/alertes', icon: 'bell', label: 'Alertes' },
  ].filter(Boolean)
  const finance = [
    can('view_finance') && { to: '/finance', icon: 'chart-column', label: 'Point financier' },
    can('view_bank_recon') && { to: '/rapprochement', icon: 'landmark', label: 'Rapprochement' },
    can('view_ocr_check') && { to: '/verif-photos', icon: 'camera', label: 'Vérif bordereaux' },
  ].filter(Boolean)
  const administration = [
    can('view_audit_log') && { to: '/audit', icon: 'search', label: "Journal d'audit" },
    can('manage_products') && { to: '/produits', icon: 'book-open', label: 'Produits & prix' },
    can('manage_suppliers') && { to: '/fournisseurs', icon: 'factory', label: 'Fournisseurs' },
    (can('manage_stations_config') || can('manage_team')) && { to: '/stations', icon: 'building-2', label: 'Stations & équipe' },
  ].filter(Boolean)

  const items = [
    { section: 'Exploitation' },
    ...((hasOperationalAccess || can('view_journal')) ? [{ to: '/journal', icon: 'clipboard-list', label: 'Journal de bord' }] : []),
    ...(hasOperationalAccess ? [{ to: '/saisie', icon: 'file-pen-line', label: isVendeuse ? 'Saisie supérette' : 'Saisie du jour' }] : []),
    { to: '/aide', icon: 'circle-question-mark', label: 'Aide' },
    ...(hasOperationalAccess ? [{ to: '/stock', icon: isVendeuse ? 'shopping-cart' : 'package', label: isVendeuse ? 'Supérette' : 'Stock & mouvements' }] : []),
    ...((hasOperationalAccess || can('validate_orders')) ? [{ to: '/commandes', icon: 'truck', label: 'Commandes' }] : []),
    ...(hasOperationalAccess ? [{ to: '/controles', icon: 'shield-check', label: 'Contrôles ANM' }] : []),
    ...(pilotage.length ? [{ section: 'Pilotage' }, ...pilotage] : []),
    ...(finance.length ? [{ section: 'Finance' }, ...finance] : []),
    ...(administration.length ? [{ section: 'Administration' }, ...administration] : []),
  ]

  return (
    <Viewport>
      <div style={{ display: 'flex', minHeight: '100dvh' }}>
        {open && <div className="oct-rail-scrim" onClick={close} />}
        <SideNav items={items} brand="Gestion station" overlay open={open} onClose={close} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Toolbar
            left={<IconButton icon="menu" title="Menu" className="oct-only-sm" onClick={() => setOpen(true)} />}
            right={<>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--accent-quiet)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 11px/1 var(--font-ui)' }}>
                  {(profile?.full_name || '?').slice(0, 1).toUpperCase()}
                </span>
                <Tag>{roleLabel}</Tag>
              </span>
              <IconButton icon="log-out" title="Déconnexion" onClick={() => signOut().then(() => nav('/'))} />
            </>}
          >
            <StationPicker />
          </Toolbar>
          <div className="content"><NotifBanner />{children}</div>
        </div>
      </div>
    </Viewport>
  )
}

// Compte créé (auth.users + profils existent) mais pas encore validé par un admin — ou
// validé mais sans station attribuée (le trigger d'inscription ne fixe jamais station_id).
// Bloque tout accès opérationnel : mieux vaut un message clair qu'une appli vide/cassée.
function PendingApproval() {
  const { session, signOut } = useAuth()
  return (
    <div className="center" style={{ flexDirection: 'column', gap: 'var(--sp-4)', textAlign: 'center', padding: 'var(--sp-6)' }}>
      <h2 style={{ font: 'var(--fw-semibold) 18px/1.3 var(--font-ui)', color: 'var(--text-primary)', margin: 0 }}>Compte en attente de validation</h2>
      <p style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--text-muted)', maxWidth: 420, margin: 0 }}>
        Ton compte{session?.user?.email ? ` (${session.user.email})` : ''} a bien été créé, mais un administrateur doit encore le valider et t'attribuer une station avant que tu puisses accéder à l'application. Reviens plus tard, ou préviens l'administrateur.
      </p>
      <Button onClick={signOut}>Se déconnecter</Button>
    </div>
  )
}

export default function App() {
  const { session, loading, profileLoading, profile, isAdmin, isVendeuse, isPompiste, can } = useAuth()
  if (loading) return <div className="center">Chargement…</div>
  if (!session) return <Login />
  // profileLoading (pas juste `!profile`) : à chaque connexion, la session est connue avant
  // que le profil ait fini de charger — sans ce garde-fou, l'écran "en attente de validation"
  // s'affichait brièvement même pour un compte déjà validé, le temps que profile arrive.
  if (profileLoading) return <div className="center">Chargement…</div>
  if (!profile?.approved) return <PendingApproval />

  const hasOperationalAccess = isAdmin || profile?.role === 'gerant' || isPompiste || isVendeuse || can('manage_orders')
  const opRoute = (el) => hasOperationalAccess ? el : <Navigate to={defaultRoute()} />
  // Première page visible dans l'ordre de priorité "Exploitation > Pilotage > Finance" —
  // utilisée pour toute route à laquelle le profil courant n'a pas accès.
  function defaultRoute() {
    if (hasOperationalAccess) return isVendeuse ? '/stock' : '/saisie'
    if (can('validate_orders')) return '/commandes'
    if (can('view_dashboard')) return '/tableau'
    if (can('view_finance')) return '/finance'
    if (can('view_history')) return '/historique'
    return '/aide'
  }

  return (
    <StationProvider>
      <Shell>
        <Suspense fallback={<div className="center">Chargement…</div>}>
        <Routes>
          <Route path="/saisie" element={opRoute(<Submit />)} />
          <Route path="/journal" element={(hasOperationalAccess || can('view_journal')) ? <Journal /> : <Navigate to={defaultRoute()} />} />
          <Route path="/aide" element={<Aide />} />
          <Route path="/commandes" element={(hasOperationalAccess || can('validate_orders')) ? <Orders /> : <Navigate to={defaultRoute()} />} />
          <Route path="/controles" element={opRoute(<Inspections />)} />
          <Route path="/historique" element={can('view_history') ? <History /> : <Navigate to={defaultRoute()} />} />
          <Route path="/tableau" element={can('view_dashboard') ? <Dashboard /> : <Navigate to={defaultRoute()} />} />
          <Route path="/saisies" element={<Navigate to="/historique" />} />
          <Route path="/stock" element={opRoute(<Stock />)} />
          <Route path="/alertes" element={can('view_alerts') ? <AlertsPage /> : <Navigate to={defaultRoute()} />} />
          <Route path="/rapprochement" element={can('view_bank_recon') ? <BankRecon /> : <Navigate to={defaultRoute()} />} />
          <Route path="/verif-photos" element={can('view_ocr_check') ? <OcrCheck /> : <Navigate to={defaultRoute()} />} />
          <Route path="/audit" element={can('view_audit_log') ? <AuditLog /> : <Navigate to={defaultRoute()} />} />
          <Route path="/finance" element={can('view_finance') ? <Finance /> : <Navigate to={defaultRoute()} />} />
          <Route path="/produits" element={can('manage_products') ? <Products /> : <Navigate to={defaultRoute()} />} />
          <Route path="/fournisseurs" element={can('manage_suppliers') ? <Suppliers /> : <Navigate to={defaultRoute()} />} />
          <Route path="/stations" element={(can('manage_stations_config') || can('manage_team')) ? <Stations /> : <Navigate to={defaultRoute()} />} />
          <Route path="*" element={<Navigate to={defaultRoute()} />} />
        </Routes>
        </Suspense>
      </Shell>
    </StationProvider>
  )
}
