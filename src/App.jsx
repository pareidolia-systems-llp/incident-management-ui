import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AuthProvider from './auth/AuthProvider'
import useAuth from './auth/useAuth'
import AppLayout from './components/AppLayout'
import CreateIncident from './pages/CreateIncident'
import Dashboard from './pages/Dashboard'
import IncidentDetails from './pages/IncidentDetails'
import IncidentList from './pages/IncidentList'
import Help from './pages/Help'
import MyWorkLog from './pages/MyWorkLog'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

function App({ RoutesComponent = Routes }) {
  return (
    <BrowserRouter>
      <AuthProvider><AuthenticatedApplication RoutesComponent={RoutesComponent} /></AuthProvider>
    </BrowserRouter>
  )
}

function AuthenticatedApplication({ RoutesComponent }) {
  const { isAuthenticated, loading, error, refreshUser } = useAuth()
  const location = useLocation()
  if (loading) return <AuthLoading />
  if (error) return <AuthFailure onRetry={refreshUser} />
  if (!isAuthenticated) return location.pathname === '/login' ? <Login /> : <Navigate to={'/login' + location.search} replace />
  if (location.pathname === '/login') return <Navigate to={'/'} replace />
  return <RoutesComponent><Route element={<AppLayout />}><Route path="/" element={<Dashboard />} /><Route path="/incidents" element={<IncidentList />} /><Route path="/incidents/new" element={<CreateIncident />} /><Route path="/incidents/:id" element={<IncidentDetails />} /><Route path="/work-logs" element={<MyWorkLog />} /><Route path="/help" element={<Help />} /><Route path="*" element={<NotFound />} /></Route></RoutesComponent>
}

function AuthLoading() { return <main className="login-page d-flex align-items-center justify-content-center p-4"><div className="text-center text-secondary"><div className="spinner-border text-primary mb-3" role="status" /><div>Checking your sign-in status…</div></div></main> }
function AuthFailure({ onRetry }) { return <main className="login-page d-flex align-items-center justify-content-center p-4"><section className="card login-card border-0 shadow-sm"><div className="card-body p-4 p-md-5 text-center"><h1 className="h4 text-dark">Unable to complete sign-in check</h1><p className="text-secondary">Please verify your connection and try again.</p><button className="btn btn-primary" onClick={onRetry}>Try again</button></div></section></main> }

export default App
