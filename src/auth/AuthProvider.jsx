import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, initializeCsrf, logout as logoutRequest } from '../api/auth'
import { backendBaseUrl } from '../api/client'
import AuthContext from './AuthContext'

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refreshUser = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await initializeCsrf()
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      return currentUser
    } catch (requestError) {
      setUser(null)
      if (requestError.response?.status !== 401) setError('We could not verify your sign-in status. Please try again.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void Promise.resolve().then(refreshUser) }, [refreshUser])

  const login = useCallback(() => {
    window.location.assign(`${backendBaseUrl}/oauth2/authorization/google`)
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
    setError('')
  }, [])

  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), loading, error, login, logout, refreshUser }), [user, loading, error, login, logout, refreshUser])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
