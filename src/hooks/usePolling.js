import { useCallback, useEffect, useRef } from 'react'

// Serialize initial, manual and background reads. A manual refresh waits for any
// older read, then fetches again so a successful mutation cannot leave stale data.
export default function usePolling(load, enabled = true) {
  const pending = useRef(null)
  const generation = useRef(0)
  const allowed = useRef(enabled)
  useEffect(() => { allowed.current = enabled }, [enabled])
  const refresh = useCallback(async (silent = false, background = silent) => {
    const version = generation.current
    if (background && (!allowed.current || document.visibilityState === 'hidden' || pending.current)) return
    while (pending.current) await pending.current
    if (version !== generation.current) return
    const current = () => version === generation.current && (!silent || allowed.current)
    const request = Promise.resolve().then(() => current() ? load(silent, current) : undefined).catch(() => {
      // Loaders present foreground errors; background failures retain existing data.
    })
    pending.current = request
    try { await request } finally { if (pending.current === request) pending.current = null }
  }, [load])
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh(true) }, 30000)
    return () => { clearInterval(timer); generation.current += 1 }
  }, [refresh])
  return refresh
}
