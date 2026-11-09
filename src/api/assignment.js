import apiClient from './client'

export const employeeAssignmentEnabled = () => import.meta.env.VITE_INCIDENT_ASSIGNMENT_ENABLED === 'true'
const base = '/api/incident-assignment'
export async function searchHandlers(search, incidentId) { return (await apiClient.get(`${base}/handlers`, { params: { search, ...(incidentId ? { incidentId } : {}) } })).data }
export async function getAssignment(id) { return (await apiClient.get(`${base}/${id}`)).data }
export async function getAssignmentHistory(id) { return (await apiClient.get(`${base}/${id}/history`)).data }
export async function saveAssignment(id, payload) { return (await apiClient.post(`${base}/${id}`, payload)).data }
export async function getAssignmentTriage() { return (await apiClient.get(`${base}/triage`)).data }
export async function getTriageDetail(id) { return (await apiClient.get(`${base}/triage/${id}`)).data }

export async function getTransferOptions(id) {
  return (await apiClient.get(`${base}/${id}/transfer/options`)).data
}

export async function searchTransferHandlers(id, destinationDepartmentId, search) {
  return (await apiClient.get(`${base}/${id}/transfer/handlers`, { params: { destinationDepartmentId, search } })).data
}

export async function transferIncident(id, payload) {
  return (await apiClient.post(`${base}/${id}/transfer`, payload)).data
}

const handoffPath = id => base + '/' + id + '/transfer/handoffs'
export async function getTransferHandoffs(id) {
  const { data } = await apiClient.get(handoffPath(id))
  if (!Array.isArray(data)) throw new Error('Invalid transfer handoff response')
  return data
}
export const requestTransferHandoff = (id, payload) => apiClient.post(handoffPath(id), payload)
export const decideTransferHandoff = (id, reference, payload) => apiClient.put(handoffPath(id) + '/' + encodeURIComponent(reference), payload)
export async function getTransferHandoffHistory(id, reference) {
  const { data } = await apiClient.get(handoffPath(id) + '/' + encodeURIComponent(reference) + '/history')
  if (!Array.isArray(data)) throw new Error('Invalid handoff history response')
  return data
}
