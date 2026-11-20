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

export async function previewEmployee(id, employee) {
  const { data } = await apiClient.post(`/api/admin/employees/${id}/preview`, employee)
  return data
}
