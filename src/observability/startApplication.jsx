import { StrictMode } from 'react'
import App from '../App'
import { initializeObservability } from './faro'

export async function startApplication(root, env) {
  const integration = await initializeObservability(env)
  const application = <App RoutesComponent={integration?.Routes} />
  const Boundary = integration?.ErrorBoundary
  root.render(
    <StrictMode>
      {Boundary ? <Boundary fallback={<main className="p-4" role="alert">
        <h1>Something went wrong</h1>
        <p>Please reload the portal and try again.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload portal</button>
      </main>}>{application}</Boundary> : application}
    </StrictMode>,
  )
}
