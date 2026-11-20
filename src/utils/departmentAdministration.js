export function departmentAdministrationError(failure, area) {
  if (failure.response?.status === 403) {
    return area + ' is unavailable to your account. Ask the HR access administrator to check your permission for this function.'
  }
  return area + ' is temporarily unavailable. Check your connection and try again. If the problem continues, contact portal support.'
}
