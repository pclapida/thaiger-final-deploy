/** Contratos comunes a todos los proveedores de envío. */

export interface Direccion {
  name?: string;
  company?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip: string;
  phone?: string;
  email?: string;
  country?: string; // 'MX'
}

export interface Paquete {
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  declared_value?: number;
  content?: string;
}

export interface Tarifa {
  id: string;
  carrier: string;
  service: string;
  amount: number;
  currency: string;
  days: number | null;
  /** Lo que devolvió el proveedor, por si hace falta para generar la guía. */
  raw?: unknown;
}

export interface Cotizacion {
  provider: string;
  /** Id de la cotización en el proveedor (Skydropx la pide al generar la guía). */
  provider_quote_id: string | null;
  rates: Tarifa[];
  expires_at: string;
}

export interface Guia {
  provider: string;
  provider_shipment_id: string | null;
  carrier: string;
  service: string;
  tracking_number: string;
  tracking_url: string | null;
  label_url: string | null;
  created_at: string;
}

export interface Proveedor {
  nombre: string;
  cotizar(args: { origen: Direccion; destino: Direccion; paquete: Paquete }): Promise<Cotizacion>;
  generarGuia(args: {
    cotizacion: { provider_quote_id: string | null; rate: Tarifa };
    origen: Direccion;
    destino: Direccion;
    paquete: Paquete;
  }): Promise<Guia>;
}
