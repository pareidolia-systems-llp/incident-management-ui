// Phase 2 remains opt-in and does not activate backend routing.
export const phase2Enabled = import.meta.env.VITE_PHASE2_ENABLED === 'true'

export function phase2ErrorMessage(error) {
  switch (error?.response?.status) {
    case 400: return 'Please check the submitted information.'
    case 401: return 'Please sign in to continue.'
    case 403: return 'You do not have permission to perform this action.'
    case 404: return 'This incident is unavailable.'
    case 409: return 'The incident changed. Refresh it before trying again.'
    default: return 'The request could not be completed. Please try again.'
  }
}
