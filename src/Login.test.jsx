import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import Login from './pages/Login'
vi.mock('./auth/useAuth', () => ({ default: () => ({ login: vi.fn() }) }))
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })
test('shows a generic administrator contact message for access-denied login', () => {
  window.history.replaceState({}, '', '/login?authError=access_denied')
  render(<Login />)
  expect(screen.getByRole('alert').textContent).toContain('Contact your administrator')
  expect(screen.getByRole('alert').textContent).not.toContain('@')
})
