/** Métricas del panel de administración calculadas a partir de los pedidos. */

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const ESTADOS_PEDIDO = ['Pago Pendiente', 'En Proceso', 'Enviado', 'Entregado', 'Cancelado'];

const ESTADOS_PENDIENTES = new Set(['Pago Pendiente', 'En Proceso']);

export function buildDashboardMetrics(orders = []) {
  let totalRevenue = 0;
  let pendingOrdersCount = 0;
  const salesByMonth = {};

  for (const order of orders) {
    const total = Number(order.total) || 0;

    // Un pedido cancelado no suma ingresos ni aparece en la gráfica.
    if (order.status !== 'Cancelado') {
      totalRevenue += total;

      if (order.created_at) {
        const date = new Date(order.created_at);
        if (!Number.isNaN(date.getTime())) {
          const month = MESES[date.getMonth()];
          salesByMonth[month] = (salesByMonth[month] || 0) + total;
        }
      }
    }

    if (ESTADOS_PENDIENTES.has(order.status)) pendingOrdersCount += 1;
  }

  const chartData = MESES.filter((mes) => salesByMonth[mes] !== undefined).map((mes) => ({
    name: mes,
    ventas: salesByMonth[mes],
  }));

  return { chartData, totalRevenue, pendingOrdersCount };
}
