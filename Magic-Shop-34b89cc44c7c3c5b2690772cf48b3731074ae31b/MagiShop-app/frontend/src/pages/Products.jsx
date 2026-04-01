import React, { useEffect, useState } from 'react'
import { useAuth } from '../state/AuthContext'

export default function Products() {
  const { apiFetch, token } = useAuth()
  const [products, setProducts] = useState([])

  useEffect(() => {
    apiFetch('/products').then((d) => setProducts(d.products || []))
  }, [])

  async function addToCart(productId) {
    if (!token) return alert('Inicia sesión para comprar')
    await apiFetch('/cart', { method: 'POST', body: JSON.stringify({ product_id: productId, quantity: 1 }) })
    alert('Agregado al carrito')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {products.map(p => (
        <div key={p.id} style={{ border: '1px solid #ddd', padding: 12 }}>
          <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
          <div style={{ fontWeight: 600 }}>{p.name}</div>
          <div>${p.price}</div>
          <div>⭐ {p.avg_rating ?? '—'}</div>
          <button onClick={() => addToCart(p.id)}>Añadir</button>
        </div>
      ))}
    </div>
  )
}
