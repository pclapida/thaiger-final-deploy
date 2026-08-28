/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { settings as settingsApi } from '../services/api';
import { buildDefaultSettings } from '../data/settings';

/**
 * Configuración de la tienda (contacto, cuenta SPEI, envíos, carrusel, textos).
 *
 * Se carga una sola vez al arrancar y la comparte toda la aplicación. El panel
 * de administración la actualiza con `save()`, y como el estado es global el
 * cambio se ve al instante en el pie, el checkout y el carrusel.
 */
const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [data, setData] = useState(() => buildDefaultSettings());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    settingsApi
      .get()
      .then((cargados) => {
        if (active) setData(cargados);
      })
      .catch((error) => {
        // Si la configuración no se puede leer, la tienda sigue con los valores
        // por defecto en lugar de quedarse en blanco.
        console.error('No se pudo cargar la configuración de la tienda:', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (patch) => {
    const actualizados = await settingsApi.update(patch);
    setData(actualizados);
    return actualizados;
  }, []);

  const reset = useCallback(async () => {
    const base = await settingsApi.reset();
    setData(base);
    return base;
  }, []);

  const value = useMemo(
    () => ({ settings: data, loading, save, reset }),
    [data, loading, save, reset]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings debe usarse dentro de <SettingsProvider>.');
  return context;
}
