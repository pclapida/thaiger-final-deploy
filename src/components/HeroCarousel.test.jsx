// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroCarousel from './HeroCarousel';
import { DEFAULT_HERO_SLIDES } from '../data/settings';
import { renderWithProviders, resetApp } from '../test/utils';

/**
 * El carrusel viejo avanzaba solo y no había forma de detenerlo ni de volver
 * atrás. Esto comprueba que ahora el mando lo tiene la persona.
 */

const SLIDES = DEFAULT_HERO_SLIDES;

function montar(slides = SLIDES) {
  return renderWithProviders(<HeroCarousel slides={slides} />);
}

beforeEach(async () => {
  await resetApp();
});

describe('carrusel de inicio', () => {
  it('arranca en el primer slide', async () => {
    montar();
    expect(await screen.findByText(SLIDES[0].title)).toBeInTheDocument();
  });

  it('avanza y retrocede con las flechas', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText(SLIDES[0].title);

    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(await screen.findByText(SLIDES[1].title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /anterior/i }));
    expect(await screen.findByText(SLIDES[0].title)).toBeInTheDocument();
  });

  it('desde el primero, retroceder lleva al último (es circular)', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText(SLIDES[0].title);

    await user.click(screen.getByRole('button', { name: /anterior/i }));
    expect(await screen.findByText(SLIDES[SLIDES.length - 1].title)).toBeInTheDocument();
  });

  it('los puntos saltan a un slide concreto', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText(SLIDES[0].title);

    await user.click(screen.getByRole('button', { name: /ir al slide 3/i }));
    expect(await screen.findByText(SLIDES[2].title)).toBeInTheDocument();
  });

  it('las flechas y los puntos son alcanzables sin pasar el ratón', async () => {
    montar();
    await screen.findByText(SLIDES[0].title);
    // El carrusel anterior sólo los mostraba en hover, que en un móvil no ocurre.
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /anterior/i })).toBeVisible();
    expect(screen.getAllByRole('button', { name: /ir al slide/i })).toHaveLength(SLIDES.length);
  });

  it('se puede pausar y reanudar el avance automático', async () => {
    const user = userEvent.setup();
    montar();

    const pausa = await screen.findByRole('button', { name: /pausar|reanudar|reproducir/i });
    await user.click(pausa);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /reanudar|reproducir/i })).toBeInTheDocument()
    );
  });

  it('las flechas del teclado cambian de slide', async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByText(SLIDES[0].title);

    const region = screen.getByRole('region', { name: /marcas|carrusel/i });
    region.focus();
    await user.keyboard('{ArrowRight}');

    expect(await screen.findByText(SLIDES[1].title)).toBeInTheDocument();
  });

  it('se anuncia como carrusel a los lectores de pantalla', async () => {
    montar();
    await screen.findByText(SLIDES[0].title);
    const region = screen.getByRole('region', { name: /marcas|carrusel/i });
    expect(region).toHaveAttribute('aria-roledescription', 'carrusel');
  });

  it('ignora los slides desactivados desde el panel', async () => {
    montar([{ ...SLIDES[0], active: false }, SLIDES[1]]);

    expect(await screen.findByText(SLIDES[1].title)).toBeInTheDocument();
    expect(screen.queryByText(SLIDES[0].title)).toBeNull();
    // Con un solo slide activo no tiene sentido ofrecer navegación.
    expect(screen.queryAllByRole('button', { name: /ir al slide/i })).toHaveLength(0);
  });

  it('sin slides no revienta: ofrece una entrada a la tienda', async () => {
    montar([]);
    expect(await screen.findByRole('link', { name: /tienda|catálogo|productos/i })).toBeInTheDocument();
  });

  it('el botón del slide lleva a la tienda filtrada por esa marca', async () => {
    montar();
    const enlace = await screen.findByRole('link', { name: new RegExp(SLIDES[0].brand, 'i') });
    expect(enlace).toHaveAttribute('href', '/shop');
  });
});
