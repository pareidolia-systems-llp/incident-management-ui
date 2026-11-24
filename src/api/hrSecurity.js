import apiClient from './client'

const base = '/api/hr/security'

export const hrSecurityEnabled = () =>
  import.meta.env.VITE_HR_SECURITY_COMMAND_ENABLED === 'true'

const validVersion = value =>
  Number.isSafeInteger(value) && value >= 0

const validId = value =>
  Number.isSafeInteger(value) && value > 0

export async function getHrSecurityQueue() {
  const { data } = await apiClient.get(`${base}/queue`)

  if (!Array.isArray(data)) {
    throw new Error('Invalid HR security queue response')
  }

  const seen = new Set()

  return data.map(item => {
    if (!item || !validId(item.incidentId)
        || !validId(item.targetUserId)
        || typeof item.incidentNumber !== 'string'
        || !item.incidentNumber.trim()
        || !['UNCLASSIFIED', 'STANDARD', 'RESTRICTED'].includes(item.classification)
        || !validVersion(item.classificationVersion)
        || !validVersion(item.scopeVersion)
        || !validVersion(item.viewVersion)
        || !validVersion(item.assignVersion)
        || typeof item.canClassify !== 'boolean'
        || typeof item.canAuthorizeHead !== 'boolean'
        || (item.classification === 'UNCLASSIFIED'
              ? item.classificationVersion !== 0
              : item.classificationVersion === 0)
        || (item.canClassify && item.classification === 'RESTRICTED')
        || (item.canAuthorizeHead && item.classification !== 'RESTRICTED')
        || item.canClassify === item.canAuthorizeHead
        || seen.has(item.incidentId)) {
      throw new Error('Invalid HR security queue item')
    }

    seen.add(item.incidentId)

    const {
      incidentId, incidentNumber, classification,
      classificationVersion, targetUserId, scopeVersion,
      viewVersion, assignVersion, canClassify, canAuthorizeHead
    } = item

    return {
      incidentId, incidentNumber, classification,
      classificationVersion, targetUserId, scopeVersion,
      viewVersion, assignVersion, canClassify, canAuthorizeHead
    }
  })
}

export async function classifyHrIncident(item, reason) {
  if (!item.canClassify) throw new Error('Classification unavailable')

  await apiClient.put(
    `${base}/${item.incidentId}/classification/restricted`,
    {
      expectedVersion: item.classificationVersion,
      reason: reason.trim()
    }
  )
}

export async function authorizeHrHead(item, reason) {
  if (!item.canAuthorizeHead) throw new Error('Authorization unavailable')

  await apiClient.put(
    `${base}/${item.incidentId}/head-access`,
    {
      targetUserId: item.targetUserId,
      classificationVersion: item.classificationVersion,
      scopeVersion: item.scopeVersion,
      viewVersion: item.viewVersion,
      assignVersion: item.assignVersion,
      reason: reason.trim()
    }
  )
}
