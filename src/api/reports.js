import apiClient from './client'
import { reportRangeParams } from '../utils/reportRange'

export async function downloadMonthlyReport(period) {
  const [year, month] = period.split('-').map(Number)
  return (await apiClient.get('/api/reports/incidents/monthly', {
    params: { year, month }, responseType: 'blob',
  })).data
}

export async function downloadRangeReport(range) {
  return (await apiClient.get('/api/reports/incidents/monthly', {
    params: reportRangeParams(range), responseType: 'blob',
  })).data
}

export async function downloadMonthlyTrackingLog(period) {
  const [year, month] = period.split('-').map(Number)
  return (await apiClient.get('/api/reports/incidents/tracking-log', {
    params: { year, month }, responseType: 'blob',
  })).data
}

export async function downloadRangeTrackingLog(range) {
  return (await apiClient.get('/api/reports/incidents/tracking-log', {
    params: reportRangeParams(range), responseType: 'blob',
  })).data
}
