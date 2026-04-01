import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

export default function Register() {
  const { apiFetch, login } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    const res = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, username, password }) })
    if (res.token) { login(res.token); navigate('/') }
    else setError(res.error || 'Error')
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8 }}>
      <h3>Registro</h3>
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)} />
      <input placeholder="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <button>Crear cuenta</button>
    </form>
  )
}
