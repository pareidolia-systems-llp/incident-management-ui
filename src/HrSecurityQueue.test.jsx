import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  cleanup, fireEvent, render, screen, waitFor
} from '@testing-library/react'

import HrSecurityQueue from './components/HrSecurityQueue'
import apiClient from './api/client'

vi.mock('./api/client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn()
  }
}))

vi.mock('./api/auth', () => ({
  getCurrentUser: vi.fn()
}))

import { getCurrentUser } from './api/auth'

const unclassified = {
  incidentId: 101,
  incidentNumber: 'SYN-HR-101',
  classification: 'UNCLASSIFIED',
  classificationVersion: 0,
  targetUserId: 20,
  scopeVersion: 0,
  viewVersion: 0,
  assignVersion: 0,
  canClassify: true,
  canAuthorizeHead: false
}

const restricted = {
  ...unclassified,
  classification: 'RESTRICTED',
  classificationVersion: 4,
  scopeVersion: 2,
  viewVersion: 3,
  assignVersion: 5,
  canClassify: false,
  canAuthorizeHead: true
}

function response(items) {
  apiClient.get.mockResolvedValue({ data: items })
}

function show(items = [unclassified]) {
  response(items)
  const changed = vi.fn()
  render(<HrSecurityQueue onChanged={changed} />)
  return changed
}

function fillReason(reason = 'Authorized HR security review') {
  fireEvent.change(
    screen.getByLabelText('Reason'),
    { target: { value: reason } }
  )
}

function confirm() {
  fireEvent.click(screen.getByRole('checkbox'))
}

async function action(name) {
  return screen.findByRole('button', { name })
}

beforeEach(() => {
  vi.resetAllMocks()

  getCurrentUser.mockResolvedValue({
    canAccessHrWorkspace: true
  })

  apiClient.put.mockResolvedValue({ status: 204 })
})

afterEach(cleanup)

describe('Protected HR security queue', () => {
  test('shows only authorized queue metadata', async () => {
    show([{
      ...unclassified,
      description: 'CONFIDENTIAL-SYNTHETIC-DESCRIPTION',
      reportedBy: 'private@example.test'
    }])

    await screen.findByText('SYN-HR-101')

    expect(
      screen.queryByText('CONFIDENTIAL-SYNTHETIC-DESCRIPTION')
    ).toBeNull()

    expect(
      screen.queryByText('private@example.test')
    ).toBeNull()

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/hr/security/queue'
    )
  })

  test('requires a nonblank reason and confirmation', async () => {
    show()

    const button = await action('Classify as Restricted')

    expect(button.disabled).toBe(true)

    fillReason('   ')
    confirm()

    expect(button.disabled).toBe(true)

    fillReason('Sensitive HR case')

    expect(button.disabled).toBe(true)

    confirm()

    expect(button.disabled).toBe(false)
    expect(apiClient.put).not.toHaveBeenCalled()
  })

  test('classification submits the current version and refreshes', async () => {
    const changed = show()

    const button = await action('Classify as Restricted')

    fillReason('  Sensitive HR case  ')
    confirm()

    response([restricted])

    fireEvent.click(button)

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/hr/security/101/classification/restricted',
        {
          expectedVersion: 0,
          reason: 'Sensitive HR case'
        }
      )
    })

    await action('Authorize My Case Access')

    expect(changed).toHaveBeenCalledTimes(1)
    expect(apiClient.put).toHaveBeenCalledTimes(1)
  })

  test('self authorization uses all server supplied versions', async () => {
    const changed = show([restricted])

    const button = await action('Authorize My Case Access')

    fillReason('HR head reviewing confidential case')
    confirm()

    response([])

    fireEvent.click(button)

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/hr/security/101/head-access',
        {
          targetUserId: 20,
          classificationVersion: 4,
          scopeVersion: 2,
          viewVersion: 3,
          assignVersion: 5,
          reason: 'HR head reviewing confidential case'
        }
      )
    })

    await screen.findByText('No pending HR security actions.')

    expect(changed).toHaveBeenCalledTimes(1)
    expect(apiClient.put).toHaveBeenCalledTimes(1)
  })

  test('denies queue discovery when workspace access is revoked', async () => {
    getCurrentUser.mockResolvedValue({
      canAccessHrWorkspace: false
    })

    show()

    await screen.findByRole('alert')

    expect(apiClient.get).not.toHaveBeenCalled()
    expect(apiClient.put).not.toHaveBeenCalled()
  })

  test('denies mutation if access is revoked before submission', async () => {
    show()

    const button = await action('Classify as Restricted')

    fillReason()
    confirm()

    getCurrentUser.mockResolvedValue({
      canAccessHrWorkspace: false
    })

    fireEvent.click(button)

    await screen.findByRole('alert')

    expect(apiClient.put).not.toHaveBeenCalled()
  })

  test('handles denied queue response without exposing case data', async () => {
    apiClient.get.mockRejectedValue({
      response: { status: 403 }
    })

    render(<HrSecurityQueue />)

    await screen.findByRole('alert')

    expect(screen.queryByText('SYN-HR-101')).toBeNull()
    expect(apiClient.put).not.toHaveBeenCalled()
  })

  test('rejects malformed classification versions', async () => {
    show([{
      ...restricted,
      classificationVersion: 0
    }])

    await screen.findByRole('alert')

    expect(
      screen.queryByRole('button', {
        name: 'Authorize My Case Access'
      })
    ).toBeNull()

    expect(apiClient.put).not.toHaveBeenCalled()
  })

  test('rejects duplicate incidents in the queue', async () => {
    show([unclassified, unclassified])

    await screen.findByRole('alert')

    expect(apiClient.put).not.toHaveBeenCalled()
  })

  test('rejects conflicting security actions', async () => {
    show([{
      ...restricted,
      canClassify: true
    }])

    await screen.findByRole('alert')

    expect(apiClient.put).not.toHaveBeenCalled()
  })

  test('stale command refreshes without automatically retrying', async () => {
    show([restricted])

    const button = await action('Authorize My Case Access')

    fillReason()
    confirm()

    apiClient.put.mockRejectedValue({
      response: { status: 409 }
    })

    response([{
      ...restricted,
      scopeVersion: 7
    }])

    fireEvent.click(button)

    await screen.findByText(
      'Incident security state changed. Review the refreshed queue.'
    )

    const refreshed = await action('Authorize My Case Access')

    expect(refreshed.disabled).toBe(true)
    expect(apiClient.put).toHaveBeenCalledTimes(1)
  })

  test('uncertain mutation outcome refreshes without retrying', async () => {
    show([restricted])

    const button = await action('Authorize My Case Access')

    fillReason()
    confirm()

    apiClient.put.mockRejectedValue(
      new Error('Synthetic network failure')
    )

    response([])

    fireEvent.click(button)

    await screen.findByText(
      'The outcome could not be confirmed. Review the refreshed queue before retrying.'
    )

    await screen.findByText('No pending HR security actions.')

    expect(apiClient.put).toHaveBeenCalledTimes(1)
  })

  test('prevents duplicate submission while command is pending', async () => {
    let resolveCommand

    apiClient.put.mockImplementation(
      () => new Promise(resolve => {
        resolveCommand = resolve
      })
    )

    show()

    const button = await action('Classify as Restricted')

    fillReason()
    confirm()

    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledTimes(1)
    })

    response([])

    resolveCommand({ status: 204 })

    await screen.findByText('No pending HR security actions.')

    expect(apiClient.put).toHaveBeenCalledTimes(1)
  })
})
