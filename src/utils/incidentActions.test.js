import assert from 'node:assert/strict'
import test from 'node:test'
import { getLifecycleActions } from './incidentActions.js'

const incident = { status: 'VALIDATED', reportedBy: 'reporter@example.test', validatedBy: 'reviewer@example.test' }

test('original reporter can close only at the existing VALIDATED stage', () => {
  const user = { role: 'REPORTER', email: 'reporter@example.test' }
  assert.deepEqual(getLifecycleActions(incident, user), ['close'])
  for (const status of ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) {
    assert.equal(getLifecycleActions({ ...incident, status }, user).includes('close'), false)
  }
})

for (const role of ['REVIEWER', 'IT_HANDLER', 'ADMIN', 'REPORTER']) {
  test(`${role} who is not the reporter cannot close, even if they validated`, () => {
    assert.equal(getLifecycleActions(incident, { role, email: 'reviewer@example.test' }).includes('close'), false)
  })
}

test('admin who is the original reporter can close; matching ignores case and surrounding spaces', () => {
  assert.deepEqual(getLifecycleActions({ ...incident, reportedBy: ' REPORTER@example.test ' },
    { role: 'ADMIN', email: ' reporter@EXAMPLE.test ' }), ['close'])
})

test('missing or blank identities fail closed', () => {
  for (const email of [undefined, null, '', '   ']) {
    assert.deepEqual(getLifecycleActions({ ...incident, reportedBy: email }, { role: 'ADMIN', email }), [])
    assert.deepEqual(getLifecycleActions(incident, { role: 'ADMIN', email }), [])
  }
})

test('Validate remains available to reviewers and admins, not reporters or handlers', () => {
  for (const role of ['REVIEWER', 'ADMIN', 'REPORTER', 'IT_HANDLER']) {
    assert.deepEqual(getLifecycleActions({ ...incident, status: 'RESOLVED' }, { role, email: 'other@example.test' }),
      ['REVIEWER', 'ADMIN'].includes(role) ? ['validate'] : [])
  }
})

test('Assign, investigation, resolve and review retain their existing role and status rules', () => {
  for (const role of ['REVIEWER', 'ADMIN', 'REPORTER', 'IT_HANDLER']) {
    const user = { role, email: 'other@example.test' }
    const operational = ['IT_HANDLER', 'ADMIN'].includes(role)
    assert.deepEqual(getLifecycleActions({ ...incident, status: 'OPEN' }, user), operational ? ['assign'] : [])
    for (const status of ['ASSIGNED', 'IN_PROGRESS']) {
      assert.deepEqual(getLifecycleActions({ ...incident, status }, user), operational ? ['investigation', 'resolve'] : [])
    }
    assert.deepEqual(getLifecycleActions({ ...incident, status: 'CLOSED' }, user),
      ['REVIEWER', 'ADMIN'].includes(role) ? ['review'] : [])
    assert.deepEqual(getLifecycleActions({ ...incident, status: 'CLOSED', reviewedAt: '2026-10-07T10:00:00' }, user), [])
  }
})
