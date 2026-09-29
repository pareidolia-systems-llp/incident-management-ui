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

export async function assignIncident(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/assign`, payload)
  return response.data
}

export async function updateInvestigation(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/investigation`, payload)
  return response.data
}

export async function resolveIncident(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/resolve`, payload)
  return response.data
}

export async function validateIncident(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/validate`, payload)
  return response.data
}

export async function closeIncident(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/close`, payload)
  return response.data
}

export async function reviewIncident(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/review`, payload)
  return response.data
}

export async function reclassifyIncident(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/reclassify`, payload)
  return response.data
}

export async function changeIncidentSeverity(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/severity`, payload)
  return response.data
}

export async function changeIncidentPriority(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/priority`, payload)
  return response.data
}

export async function escalateIncident(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/escalate`, payload)
  return response.data
}

export async function updateEvidenceReference(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/evidence`, payload)
  return response.data
}
