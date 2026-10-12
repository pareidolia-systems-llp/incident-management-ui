import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState } from 'react'
import useAuth from '../auth/useAuth'
import { getErrorMessage } from '../utils/incident'

const navigation = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/incidents', label: 'Incidents', icon: 'incidents' },
  { to: '/incidents/new', label: 'Create Incident', icon: 'create' },
  { to: '/help', label: 'How to Use', icon: 'help' },
]

function AppLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('incidentSidebarCollapsed')
      if (stored !== null) return stored === 'true'
    } catch { /* A blocked storage preference must not prevent access. */ }
    return window.innerWidth < 1200
  })
  function toggleSidebar() {
    setCollapsed((current) => {
      try { localStorage.setItem('incidentSidebarCollapsed', String(!current)) } catch { /* UI-only preference. */ }
      return !current
    })
  }
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
    <div className={`app-shell d-md-flex${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar p-3 p-md-4"><button type="button" className="sidebar-toggle" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSidebar} aria-expanded={!collapsed} aria-controls="sidebar-navigation" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={collapsed ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} /></svg></button>
        <div className="sidebar-brand d-flex align-items-start gap-3 mb-4 text-white"><span className="brand-mark" title="Pareidolia Systems LLP">PS</span><div className="brand-copy"><div className="brand-company">Pareidolia Systems LLP</div><div className="brand-application">Incident Management</div><div className="brand-subtitle">IT Service Operations</div></div></div>
        <nav id="sidebar-navigation" className="nav flex-column gap-1" aria-label="Primary navigation">
          {navigation.filter((item) => item.to !== '/incidents/new' || canCreateIncidents).map((item) => <NavLink key={item.to} to={item.to} end={item.end || (item.to === '/incidents' && pathname === '/incidents/new')} className="nav-link" title={item.label} aria-label={item.label}><NavigationIcon name={item.icon} /><span className="nav-full-label">{item.label}</span></NavLink>)}
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

function NavigationIcon({ name }) {
  return <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'dashboard' ? <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>
      : name === 'help' ? <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01" /></> : name === 'incidents' ? <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>
        : <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>}
  </svg>
}

export default AppLayout
