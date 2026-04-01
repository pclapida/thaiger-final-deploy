import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

export default function Login() {
  const { apiFetch, login } = useAuth()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ identity, password }) })
    if (res.token) { login(res.token); navigate('/') }
    else setError(res.error || 'Error')
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
      <h3>Ingresar</h3>
      <input placeholder="Email o usuario" value={identity} onChange={e => setIdentity(e.target.value)} />
      <input placeholder="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <button>Entrar</button>
    </form>
  )
}
