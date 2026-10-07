export const resolutionFeedbackFields = [
  { name: 'feedback', label: 'What is still not working?', required: true, type: 'textarea', maxLength: 8000 },
  { name: 'evidenceReference', label: 'Evidence Reference', required: false, type: 'textarea', maxLength: 500 },
]

export function createPayload(action, values) {
  return action.fields.reduce((payload, item) => ({ ...payload, [item.name]: values[item.name]?.trim() || '' }), {})
}

export function validateAction(action, values) {
  return action.fields.reduce((errors, item) => {
    if (item.required && !values[item.name]?.trim()) errors[item.name] = 'This field is required.'
    else if (item.maxLength && values[item.name]?.trim().length > item.maxLength) {
      errors[item.name] = `Use ${item.maxLength} characters or fewer.`
    }
    return errors
  }, {})
}
