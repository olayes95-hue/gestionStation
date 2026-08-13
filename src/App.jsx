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
const Entries = lazy(() => import('./pages/Entries.jsx'))
const Aide = lazy(() => import('./pages/Aide.jsx'))
const Journal = lazy(() => import('./pages/Journal.jsx'))

function StationPicker() {
  const { stations, stationId, setStationId, isAdmin, current } = useStation()
  if (!isAdmin) return <Tag><Icon name="map-pin" size={11} /> {current?.nom || 'Ma station'}</Tag>
  return (
    <Select size="sm" value={stationId || ''} onChange={e => setStationId(Number(e.target.value))}
      options={stations.map(s => ({ value: s.id, label: s.nom }))} />
  )
}

function Shell({ children }) {
  const { profile, isAdmin, isPompiste, isVendeuse, signOut } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const roleLabel = isAdmin ? 'Administrateur' : isPompiste ? 'Pompiste' : 'Gérant'

  const items = [
    { section: 'Exploitation' },
    ...(!isVendeuse && !isPompiste ? [{ to: '/journal', icon: 'clipboard-list', label: 'Journal de bord' }] : []),
    { to: '/saisie', icon: 'file-pen-line', label: isVendeuse ? 'Saisie supérette' : 'Saisie du jour' },
    { to: '/aide', icon: 'circle-question-mark', label: 'Aide' },
    { to: '/stock', icon: isVendeuse ? 'shopping-cart' : 'package', label: isVendeuse ? 'Supérette' : 'Stock & mouvements' },
    ...(!isVendeuse && !isPompiste ? [{ to: '/commandes', icon: 'truck', label: 'Commandes' }] : []),
    ...(!isPompiste && !isVendeuse ? [{ to: '/controles', icon: 'shield-check', label: 'Contrôles ANM' }] : []),
    ...(isAdmin ? [
      { section: 'Pilotage' },
      { to: '/tableau', icon: 'layout-dashboard', label: 'Tableau de bord' },
      { to: '/historique', icon: 'calendar-days', label: 'Historique des points' },
      { to: '/saisies', icon: 'folder-open', label: 'Saisies & photos' },
      { to: '/alertes', icon: 'bell', label: 'Alertes' },
      { section: 'Finance' },
      { to: '/finance', icon: 'chart-column', label: 'Point financier' },
      { to: '/rapprochement', icon: 'landmark', label: 'Rapprochement' },
      { to: '/verif-photos', icon: 'camera', label: 'Vérif bordereaux' },
      { section: 'Administration' },
      { to: '/audit', icon: 'search', label: "Journal d'audit" },
      { to: '/produits', icon: 'book-open', label: 'Produits & prix' },
      { to: '/fournisseurs', icon: 'factory', label: 'Fournisseurs' },
      { to: '/stations', icon: 'building-2', label: 'Stations & équipe' },
    ] : []),
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

export default function App() {
  const { session, loading, isAdmin, isVendeuse, isPompiste } = useAuth()
  if (loading) return <div className="center">Chargement…</div>
  if (!session) return <Login />
  return (
    <StationProvider>
      <Shell>
        <Suspense fallback={<div className="center">Chargement…</div>}>
        <Routes>
          <Route path="/saisie" element={<Submit />} />
          <Route path="/journal" element={isVendeuse || isPompiste ? <Navigate to="/saisie" /> : <Journal />} />
          <Route path="/aide" element={<Aide />} />
          <Route path="/commandes" element={isPompiste ? <Navigate to="/saisie" /> : <Orders />} />
          <Route path="/controles" element={<Inspections />} />
          <Route path="/historique" element={isAdmin ? <History /> : <Navigate to="/saisie" />} />
          <Route path="/tableau" element={isAdmin ? <Dashboard /> : <Navigate to="/saisie" />} />
          <Route path="/saisies" element={isAdmin ? <Entries /> : <Navigate to="/saisie" />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/alertes" element={isAdmin ? <AlertsPage /> : <Navigate to="/saisie" />} />
          <Route path="/rapprochement" element={isAdmin ? <BankRecon /> : <Navigate to="/saisie" />} />
          <Route path="/verif-photos" element={isAdmin ? <OcrCheck /> : <Navigate to="/saisie" />} />
          <Route path="/audit" element={isAdmin ? <AuditLog /> : <Navigate to="/saisie" />} />
          <Route path="/finance" element={isAdmin ? <Finance /> : <Navigate to="/saisie" />} />
          <Route path="/produits" element={isAdmin ? <Products /> : <Navigate to="/saisie" />} />
          <Route path="/fournisseurs" element={isAdmin ? <Suppliers /> : <Navigate to="/saisie" />} />
          <Route path="/stations" element={isAdmin ? <Stations /> : <Navigate to="/saisie" />} />
          <Route path="*" element={<Navigate to={isAdmin ? '/tableau' : isVendeuse ? '/stock' : '/saisie'} />} />
        </Routes>
        </Suspense>
      </Shell>
    </StationProvider>
  )
}
