export const workCategories = {
  USER_SUPPORT: 'User Support', MAINTENANCE: 'Maintenance', NETWORK: 'Network',
  SERVER: 'Server', SECURITY: 'Security', ADMINISTRATION: 'Administration', OTHER: 'Other',
}
export function initialWorkEntry(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return { workDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    workTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`, category: 'OTHER', summary: '', details: '', durationMinutes: '' }
}
export function validateWorkEntry(values) {
  const errors = {}
  const [year, month, day] = (values.workDate || '').split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.workDate || '') || !(year >= 1900 && year <= 9998 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1])) errors.workDate = 'Select a valid work date from 1900 to 9998.'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.workTime || '')) errors.workTime = 'Select a valid work time.'
  if (!Object.hasOwn(workCategories, values.category)) errors.category = 'Select a supported category.'
  if (!values.summary?.trim()) errors.summary = 'Summary is required.'
  else if (values.summary.length > 255) errors.summary = 'Use 255 characters or fewer.'
  if (values.details?.length > 8000) errors.details = 'Use 8000 characters or fewer.'
  if (values.durationMinutes !== '' && (!/^\d+$/.test(String(values.durationMinutes)) || Number(values.durationMinutes) <= 0 || Number(values.durationMinutes) > 2147483647)) errors.durationMinutes = 'Enter a positive whole number of minutes.'
  return errors
}
export function workEntryPayload(values) {
  // Only these five user-editable fields are ever sent. No identity or creation timestamp.
  return { workedAt: `${values.workDate}T${values.workTime}:00`, category: values.category,
    summary: values.summary.trim(), details: values.details.trim() || null,
    durationMinutes: values.durationMinutes === '' ? null : Number(values.durationMinutes) }
}
