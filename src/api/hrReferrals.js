import apiClient from './client'
import { employeeAssignmentEnabled } from './assignment'

const base = '/api/incident-assignment/hr-referrals'
const opaqueId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const version = value => Number.isSafeInteger(value) && value >= 0

export const hrReferralsEnabled = () => employeeAssignmentEnabled() && import.meta.env.VITE_HR_REFERRALS_ENABLED === 'true'

export async function submitHrReferral(incidentReference) {
  const { status } = await apiClient.post(base, { incidentReference })
  if (status !== 202) throw new Error('Unexpected referral response')
}

export async function getPendingHrReferrals() {
  const { data } = await apiClient.get(base)
  if (!Array.isArray(data) || !data.every(id => typeof id === 'string' && opaqueId.test(id))) {
    throw new Error('Unexpected pending referral response')
  }
  return data
}

export async function getHrReferral(id) {
  const { data } = await apiClient.get(base + '/' + encodeURIComponent(id))
  if (data?.referralId !== id || !Number.isSafeInteger(data.incidentId) || data.incidentId <= 0
      || !version(data.assignmentVersion) || !version(data.classificationVersion)
      || ![null, 'REJECTED', 'REASSIGNED', 'TRANSFERRED'].includes(data.outcome)) {
    throw new Error('Unexpected referral response')
  }
  const { incidentId, assignmentVersion, classificationVersion, outcome } = data
  return { incidentId, assignmentVersion, classificationVersion, outcome }
}

export async function decideHrReferral(id, decision) {
  const { status } = await apiClient.put(base + '/' + encodeURIComponent(id) + '/decision', decision)
  if (status !== 204) throw new Error('Unexpected decision response')
}
