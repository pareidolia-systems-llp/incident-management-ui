function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return year >= 1900 && year <= 9998 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
}
export function validateReportRange({ fromDate, fromTime, toDate, toTime }) {
  if (!validDate(fromDate) || !validDate(toDate)) return 'Select valid From Date and To Date between 1900 and 9998.'
  if ([fromTime, toTime].some((time) => time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return 'Enter valid optional times in HH:mm format.'
  // Compare wall-clock values directly; never convert report selections to UTC.
  if (`${fromDate}T${fromTime || '00:00'}` > `${toDate}T${toTime || '23:59'}`) return 'From date/time must be on or before To date/time.'
  return ''
}
export function reportRangeParams(range) {
  return { fromDate: range.fromDate, toDate: range.toDate,
    ...(range.fromTime ? { fromTime: range.fromTime } : {}), ...(range.toTime ? { toTime: range.toTime } : {}) }
}

export function validateReportMonth(period) {
  const [year, month] = (period || '').split('-').map(Number)
  return /^\d{4}-\d{2}$/.test(period || '') && year >= 1900 && year <= 9998 && month >= 1 && month <= 12
    ? '' : 'Select a valid month and year from 1900 to 9998.'
}
