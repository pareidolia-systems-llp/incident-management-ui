import apiClient from './client'

export async function getWorkLogs() { return (await apiClient.get('/api/work-logs')).data }
export async function createWorkLog(payload) { return (await apiClient.post('/api/work-logs', payload)).data }
