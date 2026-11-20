import { phase2Enabled } from '../phase2Feature'
import apiClient from './client'

export async function getIncidents() {
  const response = await apiClient.get('/api/incidents')
  return Array.isArray(response.data) ? response.data : response.data.content || []
}

export async function getIncident(id) {
  const response = await apiClient.get(`/api/incidents/${id}`)
  return response.data
}

const actionNames = ['canClassify', 'canAssign', 'canInvestigate', 'canResolve', 'canValidate', 'canRejectResolution', 'canClose']

export async function getIncidentMetadata(id) {
  const response = await apiClient.get(`/api/v2/incidents/${id}/metadata`)
  const metadata = response.data
  if (!metadata || !Number.isSafeInteger(metadata.id) || !Number.isSafeInteger(metadata.incidentVersion) ||
      typeof metadata.status !== 'string' || typeof metadata.routingState !== 'string' ||
      !(metadata.classification === null || typeof metadata.classification === 'string') ||
      !Array.isArray(metadata.responsibleDepartments) ||
      !metadata.responsibleDepartments.every(department => Number.isSafeInteger(department?.id) && typeof department.name === 'string') ||
      !(metadata.assignedHandler === null || (Number.isSafeInteger(metadata.assignedHandler?.id) && typeof metadata.assignedHandler.name === 'string')) ||
      !metadata.actions || !actionNames.every(action => typeof metadata.actions[action] === 'boolean')) {
    throw new Error('Incident authorization metadata is invalid')
  }
  return metadata
}

export async function getIncidentHistory(id) {
  const response = await apiClient.get(`/api/incidents/${id}/history`)
  return Array.isArray(response.data) ? response.data : response.data.content || []
}

export async function createIncident(payload) {
  const response = await apiClient.post(phase2Enabled ? '/api/v2/incidents' : '/api/incidents', payload)
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

export async function submitResolutionFeedback(id, payload) {
  const response = await apiClient.post(`/api/incidents/${id}/resolution-feedback`, payload)
  return response.data
}

export async function addWorkNote(id, payload) {
  return (await apiClient.post(`/api/incidents/${id}/work-notes`, payload)).data
}
