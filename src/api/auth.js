import apiClient from './client'
import { clearCsrfToken, setCsrfToken } from './csrf'

export async function initializeCsrf() {
  const response = await apiClient.get('/api/auth/csrf')
  const { headerName, token } = response.data || {}
  if (!headerName || !token) throw new Error('CSRF token was not provided by the server.')
  setCsrfToken({ headerName, token })
  return response.data
}

export async function getCurrentUser() {
  const response = await apiClient.get('/api/auth/me')
  return response.data
}

export async function logout() {
  await apiClient.post('/api/auth/logout')
  clearCsrfToken()
}
