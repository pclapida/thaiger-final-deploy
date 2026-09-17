/**
 * De las líneas del carrito a UN paquete para cotizar.
 *
 * Es una aproximación honesta: peso total exacto, y una caja con la base del
 * artículo más grande y la altura que resulte de apilar el volumen de todo.
 * Para suplementos (botes y bolsas) da tarifas realistas; si algún día venden
 * una caminadora, esto es lo que hay que revisar.
 */

export interface LineaFisica {
  weight_g?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  quantity: number;
}

/** Valores por defecto de un bote de suplemento (los mismos del esquema). */
export const DEFECTOS = { weight_g: 500, length_cm: 20, width_cm: 15, height_cm: 10 };

/** Peso mínimo que aceptan las paqueterías: menos de 100 g lo redondean igual. */
const PESO_MINIMO_KG = 0.1;

function numero(valor: unknown, defecto: number): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : defecto;
}

export function armarPaquete(lineas: LineaFisica[]): {
  weight_kg: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  piezas: number;
} {
  let gramos = 0;
  let volumen = 0;
  let largo = 0;
  let ancho = 0;
  let piezas = 0;

  for (const linea of lineas) {
    const cantidad = Math.max(0, Math.floor(Number(linea.quantity) || 0));
    if (cantidad === 0) continue;

    const l = numero(linea.length_cm, DEFECTOS.length_cm);
    const w = numero(linea.width_cm, DEFECTOS.width_cm);
    const h = numero(linea.height_cm, DEFECTOS.height_cm);

    gramos += numero(linea.weight_g, DEFECTOS.weight_g) * cantidad;
    volumen += l * w * h * cantidad;
    largo = Math.max(largo, l);
    ancho = Math.max(ancho, w);
    piezas += cantidad;
  }

  if (piezas === 0) {
    return { weight_kg: PESO_MINIMO_KG, length_cm: DEFECTOS.length_cm, width_cm: DEFECTOS.width_cm, height_cm: DEFECTOS.height_cm, piezas: 0 };
  }

  const alto = Math.max(1, Math.ceil(volumen / (largo * ancho)));

  return {
    weight_kg: Math.max(PESO_MINIMO_KG, Math.round((gramos / 1000) * 100) / 100),
    length_cm: Math.ceil(largo),
    width_cm: Math.ceil(ancho),
    height_cm: alto,
    piezas,
  };
}

/**
 * Busca la primera clave con ese nombre en cualquier nivel de un JSON y
 * devuelve su valor, siempre que sea un dato suelto (texto, número, booleano).
 * Un objeto o arreglo con ese nombre no cuenta: se sigue bajando. Así
 * `['label_url', 'label']` encuentra `label.label_url` y no `label` entero.
 */
export function buscarClave(objeto: unknown, claves: string[], profundidad = 0): unknown {
  if (profundidad > 8 || objeto === null || typeof objeto !== 'object') return undefined;

  if (Array.isArray(objeto)) {
    for (const elemento of objeto) {
      const hallado = buscarClave(elemento, claves, profundidad + 1);
      if (hallado !== undefined) return hallado;
    }
    return undefined;
  }

  const registro = objeto as Record<string, unknown>;
  for (const clave of claves) {
    const valor = registro[clave];
    if (valor === undefined || valor === null || valor === '') continue;
    if (typeof valor === 'object') continue;
    return valor;
  }
  for (const valor of Object.values(registro)) {
    const hallado = buscarClave(valor, claves, profundidad + 1);
    if (hallado !== undefined) return hallado;
  }
  return undefined;
}
