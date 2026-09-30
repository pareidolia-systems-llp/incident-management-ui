import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import useAuth from '../auth/useAuth'
import { getErrorMessage } from '../utils/incident'

const navigation = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/incidents', label: 'Incidents' },
  { to: '/incidents/new', label: 'Create Incident' },
]

function AppLayout() {
  const { user, logout } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const canCreateIncidents = ['REPORTER', 'ADMIN'].includes(user.role)

  async function handleLogout() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError('')
    try { await logout() } catch (requestError) { setSignOutError(getErrorMessage(requestError, 'Sign out could not be completed. Please try again.')); setSigningOut(false) }
  }

  return (
    <div className="app-shell d-md-flex">
      <aside className="sidebar p-3 p-md-4">
        <div className="sidebar-brand d-flex align-items-start gap-3 mb-4 text-white"><span className="brand-mark">PS</span><div><div className="brand-company">Pareidolia Systems LLP</div><div className="brand-application">Incident Management</div><div className="brand-subtitle">IT Service Operations</div></div></div>
        <nav className="nav flex-column gap-1" aria-label="Primary navigation">
          {navigation.filter((item) => item.to !== '/incidents/new' || canCreateIncidents).map((item) => <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">{item.label}</NavLink>)}
        </nav>
      </aside>
      <div className="content-area flex-grow-1 d-flex flex-column">
        <header className="app-header d-flex align-items-center justify-content-between gap-3 px-4 px-lg-5"><div className="header-title">Incident &amp; Information Security Management</div><div className="d-flex align-items-center gap-3"><div className="text-end d-none d-sm-block"><div className="small fw-semibold text-dark">{user.displayName}</div><div className="header-role">{user.role}</div></div><button className="btn btn-sm btn-outline-secondary" onClick={handleLogout} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign Out'}</button></div></header>
        {signOutError && <div className="px-4 px-lg-5 pt-3"><div className="alert alert-danger mb-0" role="alert">{signOutError}</div></div>}
        <main className="page-content flex-grow-1 p-4 p-lg-5"><Outlet /></main>
        <footer className="app-footer px-4 px-lg-5">© Pareidolia Systems LLP</footer>
      </div>
    </div>
  )
}

export default AppLayout
