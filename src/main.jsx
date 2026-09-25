import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom' // Importamos el Router aquí
import { recargarUnaVez } from './lib/versionNueva'

// Vite avisa con este evento cuando no puede bajar una página cargada bajo
// demanda: casi siempre, porque se publicó una versión nueva mientras la
// pestaña estaba abierta. Recargar trae la nueva (ver lib/versionNueva.js).
window.addEventListener('vite:preloadError', (evento) => {
  if (recargarUnaVez()) evento.preventDefault()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter> {/* Envolvemos TODA la aplicación */}
      <App />
    </BrowserRouter>
  </StrictMode>,
)