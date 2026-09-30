import useAuth from '../auth/useAuth'

function Login() {
  const { login } = useAuth()
  const hasAccessDeniedError = new URLSearchParams(window.location.search).get('authError') === 'access_denied'

  return <main className="login-page d-flex align-items-center justify-content-center p-4"><section className="card login-card border-0 shadow-sm"><div className="card-body p-4 p-md-5 text-center"><div className="login-mark mx-auto mb-4">PS</div><div className="login-company mb-2">Pareidolia Systems LLP</div><h1 className="h3 text-dark mb-2">Incident Management Portal</h1><p className="text-secondary mb-4">Sign in with your Pareidolia Workspace account</p>{hasAccessDeniedError && <div className="alert alert-warning text-start small" role="alert">Access is restricted to authorized Pareidolia Workspace accounts.</div>}<button className="btn btn-primary w-100" onClick={login}>Continue with Google</button><p className="text-secondary small mb-0 mt-4">Use your authorized Pareidolia Google Workspace account.</p></div></section></main>
}

export default Login
