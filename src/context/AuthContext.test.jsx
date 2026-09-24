// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({
  auth: {
    // Una recuperación de sesión que nunca responde: el síntoma del bloqueo.
    getSession: () => new Promise(() => {}),
    onAuthStateChange: () => () => {},
  },
}));

const { AuthProvider, ESPERA_MAXIMA_SESION_MS } = await import('./AuthContext.jsx');

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthProvider', () => {
  it('si la sesión no responde, abre la tienda como visitante en vez de quedarse en «Cargando»', async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AuthProvider>
        <p>tienda abierta</p>
      </AuthProvider>
    );

    expect(screen.getByText(/cargando thaiger/i)).toBeTruthy();
    expect(screen.queryByText('tienda abierta')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_SESION_MS);
    });

    expect(screen.getByText('tienda abierta')).toBeTruthy();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
