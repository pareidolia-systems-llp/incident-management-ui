export function getErrorMessage(error, fallback = 'We could not load the requested information. Please try again.') {
  if (error.response?.status === 404) return 'The requested incident could not be found.'
  if (error.response?.status === 403) return 'You do not have permission to perform this action.'
  if (error.response?.status >= 500) return 'The service is currently unavailable. Please try again shortly.'
  if (error.code === 'ERR_NETWORK') return 'Unable to connect to the incident service. Check that it is running and try again.'
  return fallback
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function labelize(value) { return value ? String(value).replaceAll('_', ' ') : 'Not set' }

export function readField(incident, ...keys) { return keys.map((key) => incident?.[key]).find((value) => value !== undefined && value !== null && value !== '') }
