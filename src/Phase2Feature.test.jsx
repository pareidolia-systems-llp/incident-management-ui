import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks() })

describe('Phase 2 feature boundary', () => {
  it('defaults to the legacy creation endpoint', async () => {
    vi.stubEnv('VITE_PHASE2_ENABLED', '')
    const client = (await import('./api/client')).default
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { id: 1 } })
    const { createIncident } = await import('./api/incidents')
    await createIncident({ title: 'Synthetic' })
    expect(post).toHaveBeenCalledWith('/api/incidents', { title: 'Synthetic' })
  })
  it('selects the tested Phase 2 creation endpoint when explicitly enabled', async () => {
    vi.stubEnv('VITE_PHASE2_ENABLED', 'true')
    const client = (await import('./api/client')).default
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { id: 2 } })
    const { createIncident } = await import('./api/incidents')
    await createIncident({ title: 'Synthetic' })
    expect(post).toHaveBeenCalledWith('/api/v2/incidents', { title: 'Synthetic' })
  })
  it('does not include backend content in error messages', async () => {
    const { phase2ErrorMessage } = await import('./phase2Feature')
    for (const status of [400, 401, 403, 404, 409, 500]) {
      expect(phase2ErrorMessage({ response: { status, data: { message: 'confidential detail' } } })).not.toContain('confidential')
    }
    expect(phase2ErrorMessage({ response: { status: 409 } })).toMatch(/refresh/i)
  })
})
