import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * El cliente de Supabase ejecuta el aviso de onAuthStateChange dentro de su
 * cerrojo de sesión. Si el aviso espera otra llamada a Supabase, se bloquea
 * (así se quedaba la tienda en «Cargando Thaiger» al volver al día siguiente).
 * Aquí se simula ese cliente para comprobar que el aviso no toca Supabase
 * mientras corre, y que llega el usuario correcto después.
 */
const cliente = vi.hoisted(() => ({
  avisoRegistrado: null,
  consultasDuranteElAviso: 0,
  dentroDelAviso: false,
  perfiles: {},
  retrasos: {},
}));

vi.mock('../supabase', () => {
  const consulta = (tabla) => {
    if (cliente.dentroDelAviso) cliente.consultasDuranteElAviso += 1;
    const filtros = {};
    const encadenable = {
      select: () => encadenable,
      eq: (campo, valor) => {
        filtros[campo] = valor;
        return encadenable;
      },
      maybeSingle: () =>
        new Promise((resolver) => {
          const id = filtros.id;
          setTimeout(() => resolver({ data: tabla === 'users' ? cliente.perfiles[id] ?? null : null }), cliente.retrasos[id] ?? 0);
        }),
    };
    return encadenable;
  };

  return {
    isSupabaseConfigured: true,
    supabase: {
      from: consulta,
      auth: {
        onAuthStateChange: (aviso) => {
          cliente.avisoRegistrado = aviso;
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
    },
  };
});

const { auth } = await import('./supabaseBackend.js');

/** Dispara un aviso como lo haría supabase-js: dentro de su cerrojo. */
function emitir(evento, session) {
  cliente.dentroDelAviso = true;
  try {
    return cliente.avisoRegistrado(evento, session);
  } finally {
    cliente.dentroDelAviso = false;
  }
}

const sesion = (id, email) => ({ user: { id, email, user_metadata: {}, created_at: '2026-09-01T00:00:00Z' } });

beforeEach(() => {
  vi.useFakeTimers();
  cliente.avisoRegistrado = null;
  cliente.consultasDuranteElAviso = 0;
  cliente.perfiles = {};
  cliente.retrasos = {};
});

afterEach(() => {
  vi.useRealTimers();
});

describe('onAuthStateChange con Supabase', () => {
  it('el aviso no es async ni consulta Supabase mientras corre dentro del cerrojo', async () => {
    const recibido = vi.fn();
    auth.onAuthStateChange(recibido);

    const devuelto = emitir('TOKEN_REFRESHED', sesion('u1', 'ana@ejemplo.com'));

    // Un callback async devolvería una promesa: eso es lo que bloqueaba.
    expect(devuelto).toBeUndefined();
    expect(cliente.consultasDuranteElAviso).toBe(0);
    expect(recibido).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    expect(recibido).toHaveBeenCalledTimes(1);
  });

  it('entrega el usuario con el rol y el nombre de su perfil', async () => {
    cliente.perfiles.u1 = { name: 'Ana', role: 'admin', avatar_url: null, created_at: '2026-09-01T00:00:00Z' };
    const recibido = vi.fn();
    auth.onAuthStateChange(recibido);

    emitir('SIGNED_IN', sesion('u1', 'ana@ejemplo.com'));
    await vi.runAllTimersAsync();

    expect(recibido).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', email: 'ana@ejemplo.com', name: 'Ana', role: 'admin' }));
  });

  it('si llegan dos avisos seguidos, gana el más reciente aunque el primero tarde más', async () => {
    cliente.retrasos.u1 = 500; // el perfil del primer aviso tarda
    const recibido = vi.fn();
    auth.onAuthStateChange(recibido);

    emitir('SIGNED_IN', sesion('u1', 'ana@ejemplo.com'));
    emitir('SIGNED_OUT', null);
    await vi.runAllTimersAsync();

    // El SIGNED_OUT resolvió antes; el SIGNED_IN viejo no debe pisarlo.
    expect(recibido).toHaveBeenCalledTimes(1);
    expect(recibido).toHaveBeenLastCalledWith(null);
  });
});
