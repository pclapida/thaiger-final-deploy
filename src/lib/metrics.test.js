import { describe, it, expect } from 'vitest';
import { buildDashboardMetrics } from './metrics';

const pedido = (extra) => ({
  id: 'abc-1',
  status: 'Entregado',
  total: 1000,
  created_at: '2026-03-15T10:00:00.000Z',
  ...extra,
});

describe('métricas del dashboard', () => {
  it('sin pedidos devuelve ceros', () => {
    expect(buildDashboardMetrics([])).toEqual({ chartData: [], totalRevenue: 0, pendingOrdersCount: 0 });
  });

  it('suma los ingresos de pedidos no cancelados', () => {
    const metrics = buildDashboardMetrics([
      pedido({ total: 1000 }),
      pedido({ id: 'b', total: 500 }),
      pedido({ id: 'c', total: 9999, status: 'Cancelado' }),
    ]);
    expect(metrics.totalRevenue).toBe(1500);
  });

  it('cuenta como pendientes los pedidos por pagar o en proceso', () => {
    const metrics = buildDashboardMetrics([
      pedido({ status: 'Pago Pendiente' }),
      pedido({ id: 'b', status: 'En Proceso' }),
      pedido({ id: 'c', status: 'Enviado' }),
      pedido({ id: 'd', status: 'Entregado' }),
    ]);
    expect(metrics.pendingOrdersCount).toBe(2);
  });

  it('agrupa las ventas por mes en orden de calendario', () => {
    const metrics = buildDashboardMetrics([
      pedido({ created_at: '2026-05-02T00:00:00.000Z', total: 300 }),
      pedido({ id: 'b', created_at: '2026-01-10T00:00:00.000Z', total: 100 }),
      pedido({ id: 'c', created_at: '2026-05-20T00:00:00.000Z', total: 200 }),
    ]);
    expect(metrics.chartData).toEqual([
      { name: 'Ene', ventas: 100 },
      { name: 'May', ventas: 500 },
    ]);
  });

  it('los cancelados no aparecen en la gráfica', () => {
    const metrics = buildDashboardMetrics([pedido({ status: 'Cancelado' })]);
    expect(metrics.chartData).toEqual([]);
  });

  it('tolera fechas y totales inválidos', () => {
    const metrics = buildDashboardMetrics([
      pedido({ created_at: 'no-es-fecha', total: 100 }),
      pedido({ id: 'b', created_at: null, total: 'abc' }),
    ]);
    expect(metrics.totalRevenue).toBe(100);
    expect(metrics.chartData).toEqual([]);
  });
});
