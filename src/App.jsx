import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AuthProvider from './auth/AuthProvider'
import useAuth from './auth/useAuth'
import AppLayout from './components/AppLayout'
import CreateIncident from './pages/CreateIncident'
import Dashboard from './pages/Dashboard'
import IncidentDetails from './pages/IncidentDetails'
import IncidentList from './pages/IncidentList'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider><AuthenticatedApplication /></AuthProvider>
    </BrowserRouter>
  )
}

function AuthenticatedApplication() {
  const { isAuthenticated, loading, error, refreshUser } = useAuth()
  if (loading) return <AuthLoading />
  if (error) return <AuthFailure onRetry={refreshUser} />
  if (!isAuthenticated) return <Login />
  return <Routes><Route element={<AppLayout />}><Route path="/" element={<Dashboard />} /><Route path="/incidents" element={<IncidentList />} /><Route path="/incidents/new" element={<CreateIncident />} /><Route path="/incidents/:id" element={<IncidentDetails />} /><Route path="*" element={<NotFound />} /></Route></Routes>
}

function AuthLoading() { return <main className="login-page d-flex align-items-center justify-content-center p-4"><div className="text-center text-secondary"><div className="spinner-border text-primary mb-3" role="status" /><div>Checking your sign-in status…</div></div></main> }
function AuthFailure({ onRetry }) { return <main className="login-page d-flex align-items-center justify-content-center p-4"><section className="card login-card border-0 shadow-sm"><div className="card-body p-4 p-md-5 text-center"><h1 className="h4 text-dark">Unable to complete sign-in check</h1><p className="text-secondary">Please verify your connection and try again.</p><button className="btn btn-primary" onClick={onRetry}>Try again</button></div></section></main> }

export default App
