import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, KeyRound, RefreshCw, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { users as usuariosApi, IS_LOCAL_MODE } from '../../services/api';
import { passwordStrength, validatePassword } from '../../lib/security';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import Modal from '../ui/Modal';
import { SkeletonRows } from '../ui/Skeleton';
import { TextField, inputClasses } from '../ui/Field';

const BOTON_SECUNDARIO =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-40';

const BOTON_MARCA =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm bg-brand-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:opacity-40';

/**
 * Acción de una fila (sólo icono). El icono mide 16px, así que sin una medida
 * explícita el botón se queda en 32×32: por debajo del mínimo táctil de 44.
 * La misma constante existe en los demás paneles con listas.
 */
const BOTON_ICONO = 'grid h-11 w-11 shrink-0 place-items-center rounded transition-colors';

function fechaCorta(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? '—' : fecha.toLocaleDateString('es-MX');
}

/** Iniciales de respaldo cuando la cuenta no tiene foto. */
function iniciales(nombre, correo) {
  const base = String(nombre || correo || '?').trim();
  return base.slice(0, 2).toUpperCase();
}

/**
 * Gestor de cuentas: alta, rol, restablecimiento de contraseña y baja.
 *
 * Con Supabase, crear cuentas y cambiar contraseñas exige la llave de servicio,
 * que jamás viaja al navegador: en ese caso el backend lanza un error explicando
 * qué hacer y aquí se muestra tal cual.
 */
export default function PanelUsuarios({ pedidos = [] }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const [confirmacion, setConfirmacion] = useState(null);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [alta, setAlta] = useState({ email: '', password: '', name: '', role: 'user' });

  const [claveDe, setClaveDe] = useState(null);
  const [claveNueva, setClaveNueva] = useState('');

  // No toca el estado antes del primer `await`: el efecto de arranque no puede
  // provocar renders en cascada (regla set-state-in-effect del proyecto).
  const cargar = useCallback(
    () =>
      usuariosApi
        .list()
        .then((lista) => {
          setUsuarios(lista);
          setError(null);
        })
        .catch((fallo) => {
          setError(fallo.message || 'No se pudieron leer las cuentas.');
          setUsuarios([]);
        })
        .finally(() => setCargando(false)),
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Recarga desde un botón: aquí sí se muestra el estado de carga. */
  const recargar = useCallback(() => {
    setCargando(true);
    setError(null);
    return cargar();
  }, [cargar]);

  /** Pedidos por cuenta, cruzando con lo que ya cargó el armazón. */
  const pedidosPorUsuario = useMemo(() => {
    const conteo = new Map();
    for (const pedido of pedidos) {
      const clave = String(pedido.user_id);
      conteo.set(clave, (conteo.get(clave) || 0) + 1);
    }
    return conteo;
  }, [pedidos]);

  const administradores = usuarios.filter((usuario) => usuario.role === 'admin').length;

  const cambiarRol = async (usuario, rol) => {
    setTrabajando(true);
    try {
      const actualizado = await usuariosApi.setRole(usuario.id, rol);
      setUsuarios((previos) =>
        previos.map((actual) => (actual.id === usuario.id ? { ...actual, ...actualizado } : actual))
      );
      toast.success(`${usuario.email} ahora es ${rol === 'admin' ? 'administrador' : 'cliente'}`);
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setTrabajando(false);
    }
  };

  const pedirBaja = (usuario) => {
    setConfirmacion({
      titulo: 'Eliminar cuenta',
      mensaje: `Se eliminará la cuenta de ${usuario.name || usuario.email}. Sus pedidos se conservan, pero dejará de poder entrar.`,
      accion: async () => {
        await usuariosApi.remove(usuario.id);
        setUsuarios((previos) => previos.filter((actual) => actual.id !== usuario.id));
        toast.success('Cuenta eliminada');
      },
    });
  };

  const confirmar = async () => {
    if (!confirmacion) return;
    setTrabajando(true);
    try {
      await confirmacion.accion();
      setConfirmacion(null);
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setTrabajando(false);
    }
  };

  const crearCuenta = async () => {
    const problema = validatePassword(alta.password);
    if (problema) {
      toast.error(problema);
      return;
    }

    setTrabajando(true);
    try {
      const creado = await usuariosApi.create(alta);
      setUsuarios((previos) => [creado, ...previos]);
      setAltaAbierta(false);
      setAlta({ email: '', password: '', name: '', role: 'user' });
      toast.success('Cuenta creada');
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setTrabajando(false);
    }
  };

  const restablecerClave = async () => {
    const problema = validatePassword(claveNueva);
    if (problema) {
      toast.error(problema);
      return;
    }

    setTrabajando(true);
    try {
      await usuariosApi.setPassword(claveDe.id, claveNueva);
      setClaveDe(null);
      setClaveNueva('');
      toast.success('Contraseña restablecida. La sesión abierta de esa cuenta se cerró.');
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setTrabajando(false);
    }
  };

  const fuerza = passwordStrength(altaAbierta ? alta.password : claveNueva);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="titulo-seccion font-extrabold uppercase tracking-widest text-brand-500">
            Gestor de Usuarios
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {usuarios.length} cuentas · {administradores} con acceso al panel.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={recargar} className={BOTON_SECUNDARIO}>
            <RefreshCw size={16} aria-hidden="true" /> Recargar
          </button>
          <button type="button" onClick={() => setAltaAbierta(true)} className={BOTON_MARCA}>
            <UserPlus size={16} aria-hidden="true" /> Nueva cuenta
          </button>
        </div>
      </header>

      {!IS_LOCAL_MODE && (
        <p className="rounded-lg border border-amber-700/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
          Con Supabase, las altas y los cambios de contraseña se hacen desde su panel o con
          <code className="mx-1">scripts/create-admin.js</code>: la llave de servicio nunca viaja al navegador.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-red-900/50 bg-red-950/30 p-8 text-center"
        >
          <AlertTriangle className="text-red-500" size={32} aria-hidden="true" />
          <p className="text-sm font-bold uppercase tracking-widest text-red-400">No se pudieron leer las cuentas</p>
          <p className="max-w-md text-xs text-gray-400">{error}</p>
          <button type="button" onClick={recargar} className={BOTON_SECUNDARIO}>
            <RefreshCw size={14} aria-hidden="true" /> Reintentar
          </button>
        </div>
      )}

      {!error &&
        (cargando ? (
          <div className="superficie rounded-xl">
            <SkeletonRows rows={5} columns={5} />
          </div>
        ) : usuarios.length === 0 ? (
          <EmptyState
            as="h2"
            icon={Users}
            title="No hay cuentas registradas"
            message="Crea la primera cuenta para poder entrar al panel."
            actionLabel="Nueva cuenta"
            onAction={() => setAltaAbierta(true)}
          />
        ) : (
          <>
            {/* Escritorio */}
            <div className="superficie hidden overflow-x-auto rounded-xl lg:block">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-carbon-700 text-xs font-bold uppercase tracking-widest text-gray-300">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Cuenta
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Rol
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Alta
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Pedidos
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {usuarios.map((usuario) => (
                    <tr key={usuario.id} className="border-b border-gray-800 transition-colors hover:bg-black/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-carbon-700 text-[11px] font-black text-brand-500">
                            {usuario.avatar_url ? (
                              <img src={usuario.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              iniciales(usuario.name, usuario.email)
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-bold text-white">{usuario.name || 'Sin nombre'}</span>
                            <span className="block truncate text-xs text-gray-400">{usuario.email}</span>
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <select
                          aria-label={`Rol de ${usuario.email}`}
                          value={usuario.role === 'admin' ? 'admin' : 'user'}
                          disabled={trabajando}
                          onChange={(evento) => cambiarRol(usuario, evento.target.value)}
                          className={inputClasses({
                            extra: `min-h-[44px] w-40 text-xs font-bold uppercase ${
                              usuario.role === 'admin' ? 'text-brand-500' : 'text-gray-300'
                            }`,
                          })}
                        >
                          <option value="user">Cliente</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>

                      <td className="px-4 py-3 text-xs">{fechaCorta(usuario.created_at)}</td>

                      <td className="px-4 py-3">
                        <span className="rounded bg-carbon-700 px-2 py-1 text-xs font-bold text-gray-300">
                          {pedidosPorUsuario.get(String(usuario.id)) || 0}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setClaveDe(usuario);
                              setClaveNueva('');
                            }}
                            title="Restablecer la contraseña"
                            aria-label={`Restablecer la contraseña de ${usuario.email}`}
                            className={`${BOTON_ICONO} bg-carbon-700 text-gray-300 hover:text-white`}
                          >
                            <KeyRound size={16} aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => pedirBaja(usuario)}
                            title="Eliminar la cuenta"
                            aria-label={`Eliminar la cuenta de ${usuario.email}`}
                            className={`${BOTON_ICONO} bg-red-500/10 text-red-500 hover:text-red-400`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Móvil */}
            <ul className="space-y-3 lg:hidden">
              {usuarios.map((usuario) => (
                <li key={usuario.id} className="superficie rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-carbon-700 text-[11px] font-black text-brand-500">
                      {usuario.avatar_url ? (
                        <img src={usuario.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        iniciales(usuario.name, usuario.email)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-white">{usuario.name || 'Sin nombre'}</span>
                      <span className="block truncate text-xs text-gray-400">{usuario.email}</span>
                    </span>
                    {usuario.role === 'admin' && (
                      <ShieldCheck size={18} className="shrink-0 text-brand-500" aria-label="Administrador" />
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-3 text-[11px] text-gray-400">
                    <span>Alta: {fechaCorta(usuario.created_at)}</span>
                    <span>· {pedidosPorUsuario.get(String(usuario.id)) || 0} pedidos</span>

                    <select
                      aria-label={`Cambiar rol de ${usuario.email}`}
                      value={usuario.role === 'admin' ? 'admin' : 'user'}
                      disabled={trabajando}
                      onChange={(evento) => cambiarRol(usuario, evento.target.value)}
                      className={inputClasses({ extra: 'ml-auto min-h-[44px] w-36 font-bold uppercase' })}
                    >
                      <option value="user">Cliente</option>
                      <option value="admin">Administrador</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        setClaveDe(usuario);
                        setClaveNueva('');
                      }}
                      aria-label={`Restablecer la contraseña de ${usuario.email}`}
                      className={`${BOTON_ICONO} bg-carbon-700 text-gray-300`}
                    >
                      <KeyRound size={16} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => pedirBaja(usuario)}
                      aria-label={`Eliminar la cuenta de ${usuario.email}`}
                      className={`${BOTON_ICONO} bg-red-500/10 text-red-500`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ))}

      {/* --------------------------------------------------------- alta ----- */}
      <Modal
        open={altaAbierta}
        onClose={() => setAltaAbierta(false)}
        title="Nueva cuenta"
        description="La contraseña se guarda derivada; nadie puede leerla después."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAltaAbierta(false)} className={BOTON_SECUNDARIO}>
              Cancelar
            </button>
            <button type="button" onClick={crearCuenta} disabled={trabajando} className={BOTON_MARCA}>
              <UserPlus size={14} aria-hidden="true" /> Crear cuenta
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField
            label="Nombre"
            value={alta.name}
            onChange={(evento) => setAlta((previo) => ({ ...previo, name: evento.target.value }))}
            placeholder="Nombre de la persona"
          />
          <TextField
            label="Correo electrónico"
            required
            type="email"
            value={alta.email}
            onChange={(evento) => setAlta((previo) => ({ ...previo, email: evento.target.value }))}
            placeholder="persona@correo.com"
          />
          <TextField
            label="Contraseña"
            required
            type="password"
            value={alta.password}
            onChange={(evento) => setAlta((previo) => ({ ...previo, password: evento.target.value }))}
            hint="Mínimo 8 caracteres, con letras y números."
          />
          {alta.password && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Seguridad: <span className="text-brand-500">{fuerza.label}</span>
            </p>
          )}

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wider text-gray-400">Rol</legend>
            <div className="flex gap-3">
              {[
                { valor: 'user', etiqueta: 'Cliente' },
                { valor: 'admin', etiqueta: 'Administrador' },
              ].map((opcion) => (
                <label
                  key={opcion.valor}
                  className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm border px-4 text-xs font-bold uppercase tracking-widest transition-colors ${
                    alta.role === opcion.valor
                      ? 'border-brand-500 bg-brand-600/15 text-brand-500'
                      : 'border-gray-800 text-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="rol-nueva-cuenta"
                    value={opcion.valor}
                    checked={alta.role === opcion.valor}
                    onChange={() => setAlta((previo) => ({ ...previo, role: opcion.valor }))}
                    className="sr-only"
                  />
                  {opcion.etiqueta}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Modal>

      {/* ------------------------------------------------ restablecer clave -- */}
      <Modal
        open={Boolean(claveDe)}
        onClose={() => setClaveDe(null)}
        title="Restablecer contraseña"
        description={claveDe ? `Cuenta: ${claveDe.email}` : undefined}
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setClaveDe(null)} className={BOTON_SECUNDARIO}>
              Cancelar
            </button>
            <button type="button" onClick={restablecerClave} disabled={trabajando} className={BOTON_MARCA}>
              <KeyRound size={14} aria-hidden="true" /> Restablecer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <TextField
            label="Contraseña nueva"
            required
            type="password"
            value={claveNueva}
            onChange={(evento) => setClaveNueva(evento.target.value)}
            hint="Al guardarla se cierra cualquier sesión abierta de esa cuenta."
          />
          {claveNueva && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Seguridad: <span className="text-brand-500">{fuerza.label}</span>
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmacion)}
        title={confirmacion?.titulo}
        message={confirmacion?.mensaje}
        confirmLabel="Sí, eliminar"
        tone="danger"
        busy={trabajando}
        onConfirm={confirmar}
        onCancel={() => setConfirmacion(null)}
      />
    </div>
  );
}
