import { describe, expect, it, vi } from 'vitest'
import { createPreviewAdapter } from '../preview/mock'

describe('isolated synthetic preview transport', () => {
  it('returns synthetic metadata and performs versioned in-memory work-note changes', async () => {
    const adapter = createPreviewAdapter()
    const meta = await adapter({ method: 'get', url: '/api/v2/incidents/42/metadata' })
    expect(meta.data).toMatchObject({ classification: 'STANDARD', routingState: 'READY', incidentVersion: 3, actions: { canAddWorkNote: true, canUploadAttachment: true } })
    const saved = await adapter({ method: 'post', url: '/api/incidents/42/work-notes', data: JSON.stringify({ remarks: 'Synthetic progress', expectedVersion: 3 }) })
    expect(saved.status).toBe(201)
    expect((await adapter({ method: 'get', url: '/api/v2/incidents/42/metadata' })).data.incidentVersion).toBe(4)
    expect((await adapter({ method: 'get', url: '/api/incidents/42/history' })).data[0].remarks).toBe('Synthetic progress')
    await expect(adapter({ method: 'post', url: '/api/incidents/42/work-notes', data: JSON.stringify({ remarks: 'stale', expectedVersion: 3 }) })).rejects.toMatchObject({ response: { status: 409 } })
  })
  it('rejects unknown and authentication routes locally without using fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const adapter = createPreviewAdapter()
    for (const url of ['/api/auth/me', '/oauth2/authorization/google', 'https://example.test/api/incidents']) {
      await expect(adapter({ method: 'get', url })).rejects.toMatchObject({ response: { status: 404 } })
    }
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
