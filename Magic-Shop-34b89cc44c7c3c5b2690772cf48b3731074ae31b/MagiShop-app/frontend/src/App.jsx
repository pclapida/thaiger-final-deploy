import React from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from './state/AuthContext'

export default function App() {
  const { token, logout } = useAuth()
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <h2 style={{ marginRight: 'auto' }}>MagiShop</h2>
        <Link to="/">Productos</Link>
        <Link to="/cart">Carrito</Link>
        {token ? (
          <button onClick={logout}>Salir</button>
        ) : (
          <>
            <Link to="/login">Ingresar</Link>
            <Link to="/register">Registro</Link>
          </>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
