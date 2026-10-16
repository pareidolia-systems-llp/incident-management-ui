import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MonthlyReport from './components/MonthlyReport'
import apiClient from './api/client'
import { saveDownload } from './utils/download'

vi.mock('./api/client', () => ({ default: { get: vi.fn() } }))
vi.mock('./utils/download', () => ({ saveDownload: vi.fn() }))
beforeEach(() => { vi.resetAllMocks(); apiClient.get.mockResolvedValue({ data: new Blob(['workbook']) }) })
afterEach(cleanup)
function fill(label, value) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }
function setupRange() {
  render(<MonthlyReport />)
  fill('Report period', 'range')
  fill('From Date', '2026-10-01'); fill('To Date', '2026-10-15')
}
test('date-only report omits optional times and uses the existing endpoint', async () => {
  setupRange()
  fireEvent.click(screen.getByRole('button', { name: 'Download Excel' }))
  await waitFor(() => expect(saveDownload).toHaveBeenCalledOnce())
  expect(apiClient.get).toHaveBeenCalledExactlyOnceWith('/api/reports/incidents/monthly', { params: { fromDate: '2026-10-01', toDate: '2026-10-15' }, responseType: 'blob' })
  expect(saveDownload.mock.calls[0][1]).toBe('incident-report-2026-10-01-to-2026-10-15.xlsx')
})
test.each(['2026-10-01', '2026-10-15'])('explicit date/time report starting %s sends exact local values', async (from) => {
  setupRange(); fill('From Date', from); fill('From Time (optional)', '09:00'); fill('To Time (optional)', '17:30')
  fireEvent.click(screen.getByRole('button', { name: 'Download Excel' }))
  await waitFor(() => expect(saveDownload).toHaveBeenCalledOnce())
  expect(apiClient.get).toHaveBeenCalledWith('/api/reports/incidents/monthly', { params: { fromDate: from, fromTime: '09:00', toDate: '2026-10-15', toTime: '17:30' }, responseType: 'blob' })
})
test('invalid reversed times show an error without a request or silently swapping values', () => {
  setupRange(); fill('From Date', '2026-10-15'); fill('From Time (optional)', '17:30'); fill('To Time (optional)', '09:00')
  fireEvent.click(screen.getByRole('button', { name: 'Download Excel' }))
  expect(screen.getByRole('alert').textContent).toContain('From date/time must be on or before To date/time.')
  expect(apiClient.get).not.toHaveBeenCalled()
  expect(screen.getByLabelText('From Time (optional)').value).toBe('17:30')
})
test('missing dates are required and switching back to monthly preserves the existing API', async () => {
  setupRange(); fill('From Date', '')
  fireEvent.click(screen.getByRole('button', { name: 'Download Excel' }))
  expect(screen.getByRole('alert').textContent).toContain('Select valid From Date')
  expect(apiClient.get).not.toHaveBeenCalled()
  fill('Report period', 'month'); fill('Month', '2026-09')
  fireEvent.click(screen.getByRole('button', { name: 'Download Excel' }))
  await waitFor(() => expect(saveDownload).toHaveBeenCalledOnce())
  expect(apiClient.get).toHaveBeenCalledWith('/api/reports/incidents/monthly', { params: { year: 2026, month: 9 }, responseType: 'blob' })
  expect(saveDownload.mock.calls[0][1]).toBe('incident-report-2026-09.xlsx')
})
test('range server rejection displays a clear validation message and keeps entered dates', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 400 } })
  setupRange()
  fireEvent.click(screen.getByRole('button', { name: 'Download Excel' }))
  expect((await screen.findByRole('alert')).textContent).toContain('From date/time must be on or before To date/time.')
  expect(screen.getByLabelText('From Date').value).toBe('2026-10-01')
  expect(saveDownload).not.toHaveBeenCalled()
})
