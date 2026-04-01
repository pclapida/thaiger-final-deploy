import React, { createContext, useContext, useEffect, useState } from 'react'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))

  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])

  const login = (t) => setToken(t)
  const logout = () => setToken(null)

  const apiFetch = async (path, options = {}) => {
    const base = 'http://localhost/MagiShop/public/api'
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(base + path, { ...options, headers })
    return res.json()
  }

  return (
    <AuthCtx.Provider value={{ token, login, logout, apiFetch }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
