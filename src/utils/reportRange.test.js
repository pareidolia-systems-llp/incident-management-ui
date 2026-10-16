import test from 'node:test'
import assert from 'node:assert/strict'
import { validateReportRange, reportRangeParams, validateReportMonth } from './reportRange.js'
const range = { fromDate: '2026-10-01', toDate: '2026-10-15', fromTime: '', toTime: '' }
test('date-only ranges omit times and retain literal dates without timezone conversion', () => {
  assert.equal(validateReportRange(range), '')
  assert.deepEqual(reportRangeParams(range), { fromDate: '2026-10-01', toDate: '2026-10-15' })
})
test('same-day times, multi-day times and equal endpoints are valid', () => {
  for (const value of [
    { ...range, fromTime: '09:00', toTime: '17:30' },
    { ...range, fromDate: range.toDate, fromTime: '09:00', toTime: '17:30' },
    { ...range, fromDate: range.toDate, fromTime: '09:00', toTime: '09:00' },
    { ...range, fromDate: range.toDate, fromTime: '23:59' },
  ]) assert.equal(validateReportRange(value), '')
  assert.deepEqual(reportRangeParams({ ...range, toTime: '17:30' }), { fromDate: range.fromDate, toDate: range.toDate, toTime: '17:30' })
})
test('invalid ranges and invalid calendar or clock values are rejected without swapping', () => {
  const reversed = { ...range, fromDate: '2026-10-16' }
  assert.match(validateReportRange(reversed), /From date\/time must be on or before To date\/time/)
  assert.equal(reversed.fromDate, '2026-10-16')
  assert.match(validateReportRange({ ...range, fromDate: range.toDate, fromTime: '17:30', toTime: '09:00' }), /on or before/)
  for (const value of [{ ...range, fromDate: '' }, { ...range, fromDate: '2026-02-30' }, { ...range, toTime: '25:00' }, { ...range, toDate: '9999-01-01' }]) assert.notEqual(validateReportRange(value), '')
  assert.equal(validateReportRange({ ...range, fromDate: '2024-02-29' }), '')
})
test('monthly selection remains valid across its existing year limits', () => {
  for (const month of ['1900-01', '2026-10', '9998-12']) assert.equal(validateReportMonth(month), '')
  for (const month of ['', '1899-12', '9999-01', '2026-13']) assert.notEqual(validateReportMonth(month), '')
})
