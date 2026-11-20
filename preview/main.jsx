import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthContext from '../src/auth/AuthContext'
import IncidentDetails from '../src/pages/IncidentDetails'
import apiClient from '../src/api/client'
import { createPreviewAdapter } from './mock'
import '../src/index.css'
import '../src/App.css'

if (!import.meta.env.DEV || window.location.hostname !== '127.0.0.1') throw new Error('Synthetic preview requires a localhost development server.')
// All Axios requests, including unknown ones, terminate in this adapter. No auth bootstrap or telemetry runs.
apiClient.defaults.baseURL = window.location.origin
apiClient.defaults.adapter = createPreviewAdapter()
const user = { role: 'REPORTER', email: 'preview-user@example.test', name: 'Synthetic user' }
createRoot(document.getElementById('root')).render(<>
  <div role="status" style={{ background: '#7a3800', color: 'white', padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>
    LOCAL SYNTHETIC PREVIEW — sample data only; changes stay in this browser tab. Do not enter real incident information.
  </div>
  <main className="container py-4"><AuthContext.Provider value={{ user, isAuthenticated: true }}>
    <MemoryRouter initialEntries={['/incidents/42']}><Routes><Route path="/incidents/:id" element={<IncidentDetails />} /><Route path="*" element={<p>Reload this page to return to the synthetic incident.</p>} /></Routes></MemoryRouter>
  </AuthContext.Provider></main>
</>)
