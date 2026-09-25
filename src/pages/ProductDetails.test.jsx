// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import ProductDetails from './ProductDetails';
import { auth, products } from '../services/localBackend';
import { entrarComoAdmin, renderWithProviders, resetApp } from '../test/utils';

const foto = (n) => `https://cdn.thaiger.mx/p/${n}.webp`;

async function abrirFicha(id) {
  renderWithProviders(
    <Routes>
      <Route path="/product/:id" element={<ProductDetails />} />
    </Routes>,
    { route: `/product/${id}` }
  );
}

beforeEach(async () => {
  await resetApp();
});

describe('galería de la ficha de producto', () => {
  it('muestra la principal, las miniaturas y cambia de foto', async () => {
    await entrarComoAdmin();
    const [producto] = await products.list();
    await products.update(producto.id, { image_url: foto(1), gallery: [foto(2), foto(3)] });
    await auth.signOut();

    const user = userEvent.setup();
    await abrirFicha(producto.id);

    const principal = await screen.findByAltText(/foto 1 de 3/i);
    expect(principal).toHaveAttribute('src', foto(1));
    expect(screen.getAllByRole('button', { name: /ver foto \d de 3/i })).toHaveLength(3);

    // Por miniatura.
    await user.click(screen.getByRole('button', { name: /ver foto 3 de 3/i }));
    expect(await screen.findByAltText(/foto 3 de 3/i)).toHaveAttribute('src', foto(3));
    expect(screen.getByRole('button', { name: /ver foto 3 de 3/i })).toHaveAttribute('aria-current', 'true');

    // Por flechas, dando la vuelta al final.
    await user.click(screen.getByRole('button', { name: /foto siguiente/i }));
    expect(await screen.findByAltText(/foto 1 de 3/i)).toHaveAttribute('src', foto(1));
    await user.click(screen.getByRole('button', { name: /foto anterior/i }));
    expect(await screen.findByAltText(/foto 3 de 3/i)).toHaveAttribute('src', foto(3));
  });

  it('con una sola foto no pinta miniaturas ni flechas', async () => {
    const [producto] = await products.list();
    await abrirFicha(producto.id);

    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: /foto siguiente/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ver foto/i })).toBeNull();
  });
});
