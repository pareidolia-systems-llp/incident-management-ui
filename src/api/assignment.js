import apiClient from './client'

export const employeeAssignmentEnabled = () => import.meta.env.VITE_INCIDENT_ASSIGNMENT_ENABLED === 'true'
const base = '/api/incident-assignment'
export async function searchHandlers(search, incidentId) { return (await apiClient.get(`${base}/handlers`, { params: { search, ...(incidentId ? { incidentId } : {}) } })).data }
export async function getAssignment(id) { return (await apiClient.get(`${base}/${id}`)).data }
export async function getAssignmentHistory(id) { return (await apiClient.get(`${base}/${id}/history`)).data }
export async function saveAssignment(id, payload) { return (await apiClient.post(`${base}/${id}`, payload)).data }
export async function getAssignmentTriage() { return (await apiClient.get(`${base}/triage`)).data }
export async function getTriageDetail(id) { return (await apiClient.get(`${base}/triage/${id}`)).data }
