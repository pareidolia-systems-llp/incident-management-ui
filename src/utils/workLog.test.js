import test from 'node:test'
import assert from 'node:assert/strict'
import { initialWorkEntry, validateWorkEntry, workEntryPayload, workCategories } from './workLog.js'
const valid = () => ({ ...initialWorkEntry(new Date(2026, 9, 15, 15, 40)), summary: 'Checked backups' })
test('work date and time retain local convention; optional fields may be empty', () => {
  assert.equal(valid().workDate, '2026-10-15'); assert.equal(valid().workTime, '15:40')
  assert.deepEqual(validateWorkEntry(valid()), {})
  assert.deepEqual(workEntryPayload({ ...valid(), ownerId: 99, createdAt: 'fake' }), { workedAt: '2026-10-15T15:40:00', category: 'OTHER', summary: 'Checked backups', details: null, durationMinutes: null })
})
test('all supported categories have labels; unknown categories rejected', () => {
  for (const category of Object.keys(workCategories)) assert.deepEqual(validateWorkEntry({ ...valid(), category }), {})
  assert.ok(validateWorkEntry({ ...valid(), category: 'PAYROLL' }).category)
})
test('blank and excessive text and nonpositive/noninteger durations rejected', () => {
  for (const summary of ['', '  ', 'x'.repeat(256)]) assert.ok(validateWorkEntry({ ...valid(), summary }).summary)
  assert.ok(validateWorkEntry({ ...valid(), details: 'x'.repeat(8001) }).details)
  for (const durationMinutes of ['0', '-1', '1.5', 'no', '2147483648']) assert.ok(validateWorkEntry({ ...valid(), durationMinutes }).durationMinutes)
  assert.deepEqual(validateWorkEntry({ ...valid(), durationMinutes: '30' }), {})
})
test('invalid local dates and times are rejected', () => {
  for (const workDate of ['', '2026-02-29', '2026-04-31', '1899-01-01']) assert.ok(validateWorkEntry({ ...valid(), workDate }).workDate)
  for (const workTime of ['', '24:00', '12:60']) assert.ok(validateWorkEntry({ ...valid(), workTime }).workTime)
  assert.deepEqual(validateWorkEntry({ ...valid(), workDate: '2028-02-29' }), {})
})
