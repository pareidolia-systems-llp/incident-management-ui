import apiClient from './client'

export async function downloadMonthlyReport(period) {
  const [year, month] = period.split('-').map(Number)
  return (await apiClient.get('/api/reports/incidents/monthly', {
    params: { year, month }, responseType: 'blob',
  })).data
}
