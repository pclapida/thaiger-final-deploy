import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IS_LOCAL_MODE, DEMO_ADMIN } from '../services/api';
import toast from 'react-hot-toast';

export default function ThaigerLogin() {
  const [isLoggedIn] = useState(false);
  const [isTearing, setIsTearing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();

    setIsTearing(true);

    try {
      // El AuthContext actualiza el estado global en cuanto la sesión se abre.
      await login(email, password);

      toast.success('¡Bienvenido a Thaiger!');
      navigate('/');
    } catch (error) {
      setIsTearing(false);
      const message = error?.message || '';
      if (message.includes('Invalid login') || message.includes('credentials') || message.includes('not found')) {
        toast.error('Correo o contraseña incorrectos.');
      } else {
        toast.error('Ocurrió un error al iniciar sesión.');
        console.error(error);
      }
    }
  };

  const fillDemoAdmin = () => {
    setEmail(DEMO_ADMIN.email);
    setPassword(DEMO_ADMIN.password);
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#000' }}>
      <AnimatePresence>
        {!isLoggedIn && (
          <motion.div
            className="login-container"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1, delay: 0.8 } }}
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <motion.div
              className="login-card"
              style={{ background: '#111', padding: '40px', borderRadius: '4px', border: '1px solid #333', textAlign: 'center', maxWidth: '400px', width: '100%', position: 'relative', zIndex: 10 }}
              animate={isTearing ? { x: [-5, 5, -5, 5, 0], opacity: 0, scale: 0.9 } : {}}
              transition={{ duration: 0.3 }}
            >
              <img src="/logo.png" alt="Thaiger Logo" style={{ height: '60px', marginBottom: '20px', objectFit: 'contain' }} />

              <h2 style={{ color: '#fff', textTransform: 'uppercase', marginBottom: '30px', fontStyle: 'italic', fontWeight: '900' }}>iniciar sesion</h2>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <div style={{ textAlign: 'left' }}>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginLeft: '4px' }}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@ejemplo.com" style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '2px', outline: 'none' }} required />
                </div>

                <div style={{ textAlign: 'left' }}>
                  <label style={{ color: '#666', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginLeft: '4px' }}>Contraseña</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', background: '#0a0a0a', border: '1px solid #333', color: '#fff', padding: '12px', borderRadius: '2px', outline: 'none' }} required />
                </div>

                <button type="submit" style={{ background: '#ea580c', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase', padding: '14px', border: 'none', borderRadius: '2px', cursor: 'pointer', marginTop: '10px', letterSpacing: '1px' }}>
                  Ingresar
                </button>
              </form>

              {IS_LOCAL_MODE && (
                <div style={{ marginTop: '20px', background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.35)', borderRadius: '4px', padding: '14px', textAlign: 'left' }}>
                  <p style={{ color: '#ea580c', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                    Modo local — cuenta de administrador
                  </p>
                  <p style={{ color: '#999', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                    {DEMO_ADMIN.email} / {DEMO_ADMIN.password}
                  </p>
                  <button
                    type="button"
                    onClick={fillDemoAdmin}
                    style={{ marginTop: '10px', background: 'transparent', border: '1px solid #444', color: '#ccc', padding: '6px 12px', borderRadius: '2px', cursor: 'pointer', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}
                  >
                    Rellenar datos
                  </button>
                </div>
              )}

              <div style={{ marginTop: '20px', borderTop: '1px solid #222', paddingTop: '20px' }}>
                <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '5px' }}>¿No tienes cuenta?</p>
                <Link to="/register" style={{ color: '#ea580c', fontWeight: 'bold', textDecoration: 'none', textTransform: 'uppercase', fontSize: '0.9rem', letterSpacing: '1px' }}>
                  Crear una cuenta
                </Link>
              </div>
            </motion.div>

            {/* Efectos de Garras */}
            {isTearing && (
              <>
                <motion.div
                  style={{ position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%', background: '#000', zIndex: 20 }}
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  transition={{ duration: 0.4, ease: 'circIn' }}
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}