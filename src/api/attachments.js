import apiClient from './client'

export async function getAttachments(id) {
  return (await apiClient.get(`/api/incidents/${id}/attachments`)).data
}

export async function uploadAttachments(id, files, expectedVersion) {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  if (expectedVersion !== undefined) form.append('expectedVersion', String(expectedVersion))
  return (await apiClient.post(`/api/incidents/${id}/attachments`, form)).data
}

export async function downloadAttachment(id, attachmentId) {
  return (await apiClient.get(`/api/incidents/${id}/attachments/${attachmentId}`, { responseType: 'blob' })).data
}
