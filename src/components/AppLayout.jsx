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
        <div className="d-flex align-items-center gap-2 mb-4 text-white"><span className="brand-mark">IM</span><div><div className="fw-semibold">Incident Management</div><small className="text-white-50">Operations Portal</small></div></div>
        <nav className="nav flex-column gap-1" aria-label="Primary navigation">
          {navigation.filter((item) => item.to !== '/incidents/new' || canCreateIncidents).map((item) => <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">{item.label}</NavLink>)}
        </nav>
      </aside>
      <div className="content-area flex-grow-1">
        <header className="app-header d-flex align-items-center justify-content-between gap-3 px-4 px-lg-5"><div><div className="fw-semibold text-dark">IT Service Operations</div><small className="text-secondary">Incident and IT Issue Management</small></div><div className="d-flex align-items-center gap-2"><div className="text-end d-none d-sm-block"><div className="small fw-semibold text-dark">{user.displayName}</div><div className="small text-secondary">{user.role}</div></div><button className="btn btn-sm btn-outline-secondary" onClick={handleLogout} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign Out'}</button></div></header>
        {signOutError && <div className="px-4 px-lg-5 pt-3"><div className="alert alert-danger mb-0" role="alert">{signOutError}</div></div>}
        <main className="page-content p-4 p-lg-5"><Outlet /></main>
      </div>
    </div>
  )
}

export default AppLayout
