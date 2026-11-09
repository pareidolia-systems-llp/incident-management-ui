import apiClient from './client'
export async function createEmployee(employee) {
  const { data } = await apiClient.post('/api/admin/employees', employee)
  return data
}
export async function listEmployees(params, options = {}) {
  const { data } = await apiClient.get('/api/admin/employees', { params, ...options })
  return data
}
export async function updateEmployee(id, employee) {
  const { data } = await apiClient.put(`/api/admin/employees/${id}`, employee)
  return data
}
export async function updateEmployeeStatus(id, payload) {
  const { data } = await apiClient.put(`/api/admin/employees/${id}/status`, payload)
  return data
}
export async function getEmployeeHistory(id) {
  const { data } = await apiClient.get(`/api/admin/employees/${id}/history`)
  if (!Array.isArray(data)) throw new Error('Invalid employee history')
  return data
}

export async function previewEmployee(id, employee) {
  const { data } = await apiClient.post(`/api/admin/employees/${id}/preview`, employee)
  return data
}

// Server authorizes this lookup; the browser never supplies an authorization identity.
export async function searchActiveEmployeeEmails(search, options = {}) {
  const { data } = await apiClient.get('/api/admin/employees/active-email-search', { params: { search }, ...options })
  if (!Array.isArray(data)) throw new Error('Invalid employee search response')
  return data.filter(item => Number.isSafeInteger(item.id) && item.id > 0 && typeof item.name === 'string' && typeof item.email === 'string')
}

export async function getHeadDepartments() {
  const { data } = await apiClient.get('/api/admin/department-head-designations/departments')
  if (!Array.isArray(data)) throw new Error('Invalid departments response')
  return data
}
export async function getHeadDesignations() {
  const { data } = await apiClient.get('/api/admin/department-head-designations')
  if (!Array.isArray(data)) throw new Error('Invalid designations response')
  return data
}
export async function updateHeadDesignation(departmentId, userId, payload) {
  const { data } = await apiClient.put(`/api/admin/department-head-designations/${departmentId}/${userId}`, payload)
  return data
}

export async function getHeadDesignationHistory(departmentId, userId) {
  const { data } = await apiClient.get(`/api/admin/department-head-designations/${departmentId}/${userId}/history`)
  if (!Array.isArray(data)) throw new Error('Invalid designation history response')
  return data
}

export async function listHandlerEligibility() {
  const { data } = await apiClient.get('/api/admin/handler-eligibility')
  if (!Array.isArray(data)) throw new Error('Invalid eligibility response')
  return data
}
export async function updateHandlerEligibility(userId, payload) {
  const { data } = await apiClient.put(`/api/admin/handler-eligibility/${userId}`, payload)
  return data
}
export async function getHandlerEligibilityHistory(userId) {
  const { data } = await apiClient.get(`/api/admin/handler-eligibility/${userId}/history`)
  if (!Array.isArray(data)) throw new Error('Invalid eligibility history')
  return data
}
