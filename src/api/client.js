import axios from 'axios'
import { getCsrfToken } from './csrf'

export const backendBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
const apiClient = axios.create({
  baseURL: backendBaseUrl,
  withCredentials: true,
  withXSRFToken: false,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: { Accept: 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const csrfToken = getCsrfToken()
  const method = config.method?.toLowerCase()
  if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(method)) {
    config.headers.set(csrfToken.headerName, csrfToken.token)
  }
  return config
})

export default apiClient
