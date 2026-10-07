import assert from 'node:assert/strict'
import test from 'node:test'
import { resolutionFeedbackFields, validateAction, createPayload } from './incidentActionForm.js'

const action = { fields: resolutionFeedbackFields }

test('feedback modal rejects omitted, empty and whitespace-only feedback', () => {
  for (const feedback of [undefined, '', '   ', '\t\n']) {
    assert.deepEqual(validateAction(action, { feedback }), { feedback: 'This field is required.' })
  }
})

test('feedback modal allows feedback with optional evidence and trims payload without actor identity', () => {
  for (const evidenceReference of [undefined, '', '  ', ' Screenshot LOGIN-ERROR-07OCT ']) {
    const values = { feedback: ' Login still fails. ', evidenceReference, reportedBy: 'spoofed', actor: 'spoofed' }
    assert.deepEqual(validateAction(action, values), {})
    assert.deepEqual(createPayload(action, values), {
      feedback: 'Login still fails.', evidenceReference: evidenceReference?.trim() || '',
    })
  }
})

test('feedback modal enforces backend feedback and evidence length limits', () => {
  assert.deepEqual(validateAction(action, { feedback: 'a'.repeat(8000), evidenceReference: 'a'.repeat(500) }), {})
  assert.deepEqual(validateAction(action, { feedback: 'a'.repeat(8001), evidenceReference: 'a'.repeat(501) }), {
    feedback: 'Use 8000 characters or fewer.', evidenceReference: 'Use 500 characters or fewer.',
  })
})
