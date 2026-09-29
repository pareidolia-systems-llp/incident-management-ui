import { NavLink, Outlet } from 'react-router-dom'

const navigation = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/incidents', label: 'Incidents' },
  { to: '/incidents/new', label: 'Create Incident' },
]

function AppLayout() {
  return (
    <div className="app-shell d-md-flex">
      <aside className="sidebar p-3 p-md-4">
        <div className="d-flex align-items-center gap-2 mb-4 text-white"><span className="brand-mark">IM</span><div><div className="fw-semibold">Incident Management</div><small className="text-white-50">Operations Portal</small></div></div>
        <nav className="nav flex-column gap-1" aria-label="Primary navigation">
          {navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">{item.label}</NavLink>)}
        </nav>
      </aside>
      <div className="content-area flex-grow-1">
        <header className="app-header d-flex align-items-center justify-content-between px-4 px-lg-5"><div><div className="fw-semibold text-dark">IT Service Operations</div><small className="text-secondary">Incident and IT Issue Management</small></div><span className="badge text-bg-light border text-secondary fw-normal">Internal</span></header>
        <main className="page-content p-4 p-lg-5"><Outlet /></main>
      </div>
    </div>
  )
}

export default AppLayout
