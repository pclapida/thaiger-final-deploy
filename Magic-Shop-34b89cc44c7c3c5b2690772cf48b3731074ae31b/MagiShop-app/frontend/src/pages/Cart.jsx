import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext'

export default function Cart() {
  const { apiFetch } = useAuth()
  const [cart, setCart] = useState({ items: [], total: 0 })
  const navigate = useNavigate()

  const load = async () => {
    const c = await apiFetch('/cart')
    if (c && c.error === 'Unauthorized') {
      alert('Inicia sesión para ver tu carrito')
      navigate('/login')
      return
    }
    setCart({ items: c.items || [], total: c.total || 0 })
  }

  useEffect(() => { load() }, [])

  async function remove(productId) {
    const c = await apiFetch(`/cart/${productId}`, { method: 'DELETE' })
    setCart({ items: c.items || [], total: c.total || 0 })
  }

  async function checkout() {
    const res = await apiFetch('/orders/checkout', { method: 'POST', body: JSON.stringify({}) })
    if (res.order_id) alert(`Pedido ${res.order_id} creado`)
    else alert(res.error || 'Error')
    load()
  }

  return (
    <div>
      <h3>Carrito</h3>
      <ul>
        {(cart.items || []).map(i => (
          <li key={i.product_id}>
            {i.name} x{i.quantity} — ${Number(i.line_total || 0).toFixed(2)}
            <button onClick={() => remove(i.product_id)} style={{ marginLeft: 8 }}>Quitar</button>
          </li>
        ))}
      </ul>
      <div>Total: ${Number(cart.total || 0).toFixed(2)}</div>
      {cart.items && cart.items.length > 0 && (
        <button onClick={checkout}>Confirmar compra</button>
      )}
    </div>
  )
}
