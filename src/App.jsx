import { useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './lib/auth.jsx'
import { StationProvider, useStation } from './lib/station.jsx'
import Login from './pages/Login.jsx'
import NotifBanner from './components/NotifBanner.jsx'

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

function StationPicker() {
  const { stations, stationId, setStationId, isAdmin, current } = useStation()
  if (!isAdmin) return <span className="chip">📍 {current?.nom || 'Ma station'}</span>
  return (
    <select className="station-select" value={stationId || ''} onChange={e => setStationId(Number(e.target.value))}>
      {stations.map(s => <option key={s.id} value={s.id}>📍 {s.nom}</option>)}
    </select>
  )
}

function Shell({ children }) {
  const { profile, isAdmin, isPompiste, isVendeuse, signOut } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const Item = ({ to, ic, label }) => (
    <NavLink to={to} onClick={close}><span className="ic">{ic}</span><span>{label}</span></NavLink>
  )
  const roleLabel = isAdmin ? 'Administrateur' : isPompiste ? 'Pompiste' : 'Gérant'
  return (
    <div className="app">
      {open && <div className="overlay" onClick={close} />}
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">🛠️ <span>Gestion station</span></div>
        <nav>
          <div className="nav-group">Exploitation</div>
          <Item to="/saisie" ic="📝" label={isVendeuse ? 'Saisie supérette' : 'Saisie du jour'} />
          <Item to="/aide" ic="❓" label="Aide" />
          <Item to="/stock" ic={isVendeuse ? '🛒' : '📦'} label={isVendeuse ? 'Supérette' : 'Stock & mouvements'} />
          {!isVendeuse && !isPompiste && <Item to="/commandes" ic="🚚" label="Commandes" />}
          {!isPompiste && !isVendeuse && <Item to="/controles" ic="🛂" label="Contrôles ANM" />}
          {isAdmin && <>
            <div className="nav-group">Pilotage</div>
            <Item to="/tableau" ic="📊" label="Tableau de bord" />
            <Item to="/historique" ic="📅" label="Historique des points" />
            <Item to="/saisies" ic="🗂️" label="Saisies & photos" />
            <Item to="/alertes" ic="🔔" label="Alertes" />
            <div className="nav-group">Finance</div>
            <Item to="/finance" ic="📊" label="Point financier" />
            <Item to="/rapprochement" ic="🏦" label="Rapprochement" />
            <Item to="/verif-photos" ic="📷" label="Vérif bordereaux" />
            <div className="nav-group">Administration</div>
            <Item to="/audit" ic="🕵️" label="Journal d'audit" />
            <Item to="/produits" ic="📚" label="Produits & prix" />
            <Item to="/fournisseurs" ic="🚛" label="Fournisseurs" />
            <Item to="/stations" ic="🏢" label="Stations & équipe" />
          </>}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{(profile?.full_name || '?').slice(0, 1).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="uname">{profile?.full_name}</div>
            <div className="role">{roleLabel}</div>
          </div>
          <button className="iconbtn" title="Déconnexion" onClick={() => signOut().then(() => nav('/'))}>⏻</button>
        </div>
      </aside>

      <div className="main">
        <header className="appbar">
          <button className="hamburger" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
          <StationPicker />
          <div className="appbar-spacer" />
          <span className="chip role-chip">{roleLabel}</span>
        </header>
        <div className="content"><NotifBanner />{children}</div>
      </div>
    </div>
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
