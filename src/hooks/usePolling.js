import { useCallback, useEffect, useRef } from 'react'

// Serialize initial, manual and background reads. A manual refresh waits for any
// older read, then fetches again so a successful mutation cannot leave stale data.
export default function usePolling(load, enabled = true) {
  const pending = useRef(null)
  const generation = useRef(0)
  const allowed = useRef(enabled)
  useEffect(() => {
    allowed.current = enabled
    if (!enabled) generation.current += 1 // Invalidate a background response already in flight when editing starts.
  }, [enabled])
  const refresh = useCallback(async (silent = false, background = silent) => {
    const version = generation.current
    if (background && (!allowed.current || document.visibilityState === 'hidden' || pending.current)) return
    while (pending.current) await pending.current
    if (version !== generation.current) return
    const current = () => version === generation.current && (!background || allowed.current)
    const request = Promise.resolve().then(() => current() ? load(silent, current) : undefined).catch(() => {
      // Loaders present foreground errors; background failures retain existing data.
    })
    pending.current = request
    try { await request } finally { if (pending.current === request) pending.current = null }
  }, [load])
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh(true) }, 10000)
    let focusTimer
    const onFocus = () => {
      if (document.visibilityState === 'hidden' || !allowed.current) return
      clearTimeout(focusTimer)
      focusTimer = setTimeout(() => { void refresh(true) }, 100)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(timer); clearTimeout(focusTimer); generation.current += 1
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refresh])
  return refresh
}
