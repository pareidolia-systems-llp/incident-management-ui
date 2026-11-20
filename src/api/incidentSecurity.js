import apiClient from './client'

export const incidentSecurityEnabled = () => import.meta.env.VITE_INCIDENT_SECURITY_ADMIN_ENABLED === 'true'

const base = '/api/admin/incident-security'
export async function getTriage() { const { data } = await apiClient.get(`${base}/triage`); return data }
export async function searchCaseEmployees(search) { const { data } = await apiClient.get(`${base}/employees`, { params: { search } }); return data }
export async function getIncidentClassification(id) { const { data } = await apiClient.get(`${base}/${id}/classification`); return data }
export async function setClassification(id, payload) { const { data } = await apiClient.put(`${base}/${id}/classification`, payload); return data }
export async function getClassificationHistory(id) { const { data } = await apiClient.get(`${base}/${id}/classification/history`); return data }
export async function getCaseGrants(id) { const { data } = await apiClient.get(`${base}/${id}/grants`); return data }
export async function setCaseGrant(incidentId, userId, permission, payload) { const { data } = await apiClient.put(`${base}/${incidentId}/grants/${userId}/${permission}`, payload); return data }
export async function getCaseGrantHistory(incidentId, userId, permission) { const { data } = await apiClient.get(`${base}/${incidentId}/grants/${userId}/${permission}/history`); return data }
export async function getSecurityCapabilities() { const { data } = await apiClient.get(`${base}/capabilities`); return data }
export async function searchCapabilityEmployees(search) { const { data } = await apiClient.get(`${base}/capabilities/employees`, { params: { search } }); return data }
export async function setSecurityCapability(userId, capability, payload) { const { data } = await apiClient.put(`${base}/capabilities/${userId}/${capability}`, payload); return data }
export async function getSecurityCapabilityHistory(userId, capability) { const { data } = await apiClient.get(`${base}/capabilities/${userId}/${capability}/history`); return data }
