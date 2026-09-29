import apiClient from './client'

export async function getIncidents() {
  const response = await apiClient.get('/api/incidents')
  return Array.isArray(response.data) ? response.data : response.data.content || []
}

export async function getIncident(id) {
  const response = await apiClient.get(`/api/incidents/${id}`)
  return response.data
}

export async function getIncidentHistory(id) {
  const response = await apiClient.get(`/api/incidents/${id}/history`)
  return Array.isArray(response.data) ? response.data : response.data.content || []
}

export async function createIncident(payload) {
  const response = await apiClient.post('/api/incidents', payload)
  return response.data
}
