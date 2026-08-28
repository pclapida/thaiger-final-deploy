import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, RotateCcw, TriangleAlert } from 'lucide-react';

/**
 * Límite de errores de la interfaz.
 *
 * Sin esto, una excepción dentro de cualquier página deja la pantalla en
 * blanco y sin salida. Aquí se muestra qué pasó y dos caminos: reintentar el
 * render o volver al inicio.
 *
 * `claveDeReinicio` (la clave de la ubicación) hace que el error se olvide al
 * navegar: si no, el mensaje seguiría puesto en la página siguiente.
 */
class LimiteDeError extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reintentar = this.reintentar.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Es el único console.error legítimo del render: algo se rompió de verdad.
    console.error('Fallo no controlado en la interfaz:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.claveDeReinicio !== this.props.claveDeReinicio) {
      this.setState({ error: null });
    }
  }

  reintentar() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-20 text-center">
        <div
          role="alert"
          className="superficie w-full rounded-2xl px-6 py-12 sm:px-10"
        >
          <TriangleAlert size={44} className="mx-auto mb-6 text-brand-500" aria-hidden="true" />

          <h1 className="titulo-seccion font-black uppercase tracking-tight text-white">
            Algo se rompió
          </h1>

          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-400">
            La página no se pudo dibujar. No has perdido el carrito ni tu sesión: puedes
            reintentar o volver al inicio.
          </p>

          <p className="mx-auto mt-6 max-w-md overflow-x-auto rounded-md border border-carbon-600 bg-carbon-900 px-4 py-3 text-left font-mono text-xs text-gray-500">
            {String(error?.message || error) || 'Error desconocido'}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={this.reintentar}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-700 sm:w-auto"
            >
              <RotateCcw size={16} aria-hidden="true" /> Reintentar
            </button>

            <Link
              to="/"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-carbon-600 px-6 text-xs font-bold uppercase tracking-widest text-gray-300 transition-colors hover:border-brand-500 hover:text-brand-500 sm:w-auto"
            >
              <Home size={16} aria-hidden="true" /> Ir al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

export default function ErrorBoundary({ children }) {
  const location = useLocation();
  return <LimiteDeError claveDeReinicio={location.key}>{children}</LimiteDeError>;
}
