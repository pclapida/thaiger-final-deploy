import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom' // Importamos el Router aquí

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter> {/* Envolvemos TODA la aplicación */}
      <App />
    </BrowserRouter>
  </StrictMode>,
)