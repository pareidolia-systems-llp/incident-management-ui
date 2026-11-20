import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import AuthContext from './auth/AuthContext'
import DepartmentAdministration from './pages/DepartmentAdministration'

vi.mock('./components/DepartmentMembershipManagement', () => ({ default: () => <div>Membership panel</div> }))
vi.mock('./components/DepartmentHeadManagement', () => ({ default: () => <div>Head panel</div> }))
vi.mock('./components/HandlerEligibilityManagement', () => ({ default: () => <div>Handler panel</div> }))
vi.mock('./components/DepartmentMailRecipients', () => ({ default: () => <div>Mail panel</div> }))

afterEach(() => { cleanup(); vi.unstubAllEnvs() })
function show(user) {
  render(<AuthContext.Provider value={{ user }}><DepartmentAdministration /></AuthContext.Provider>)
}
test('membership-only operator sees only the membership panel', () => {
  vi.stubEnv('VITE_DEPARTMENT_ADMIN_ENABLED', 'false')
  vi.stubEnv('VITE_DEPARTMENT_MEMBERSHIP_ADMIN_ENABLED', 'true')
  show({ canManageDepartmentMemberships: true, canManageEmployees: false })
  expect(screen.getByText('Membership panel')).toBeTruthy()
  expect(screen.queryByText('Head panel')).toBeNull()
  expect(screen.queryByText('Handler panel')).toBeNull()
  expect(screen.queryByText('Mail panel')).toBeNull()
})
test('membership flag or a role alone does not grant the panel', () => {
  vi.stubEnv('VITE_DEPARTMENT_ADMIN_ENABLED', 'false')
  vi.stubEnv('VITE_DEPARTMENT_MEMBERSHIP_ADMIN_ENABLED', 'true')
  show({ role: 'ADMIN', canManageDepartmentMemberships: false })
  expect(screen.getByRole('alert').textContent).toContain('unavailable')
  expect(screen.queryByText('Membership panel')).toBeNull()
})