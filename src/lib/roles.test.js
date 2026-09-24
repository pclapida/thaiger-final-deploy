import { describe, it, expect } from 'vitest';
import { normalizarRol, esAdmin, puedeEditarCatalogo, puedeEntrarAlPanel, ETIQUETAS_ROL, ROLES } from './roles';

describe('roles', () => {
  it('un valor desconocido o vacío es cliente, nunca admin', () => {
    expect(normalizarRol('superadmin')).toBe('user');
    expect(normalizarRol(undefined)).toBe('user');
    expect(normalizarRol('ADMIN')).toBe('user');
    expect(normalizarRol('catalogo')).toBe('catalogo');
  });

  it('catálogo edita productos y entra al panel, pero no es admin', () => {
    expect(puedeEditarCatalogo('catalogo')).toBe(true);
    expect(puedeEntrarAlPanel('catalogo')).toBe(true);
    expect(esAdmin('catalogo')).toBe(false);
  });

  it('un cliente no toca el catálogo ni entra al panel', () => {
    expect(puedeEditarCatalogo('user')).toBe(false);
    expect(puedeEntrarAlPanel('user')).toBe(false);
  });

  it('cada rol tiene su etiqueta', () => {
    for (const rol of ROLES) expect(ETIQUETAS_ROL[rol]).toBeTruthy();
  });
});
