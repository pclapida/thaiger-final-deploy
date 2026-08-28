import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, ImageIcon, Package, Trash2, Upload, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './ui/Modal';
import { Field, TextAreaField, TextField, inputClasses } from './ui/Field';
import { formatPrice, getDisplayPrice, getDiscountPercent, hasDiscount } from '../lib/pricing';
import { buildProductPayload } from '../lib/productForm';

const FORMULARIO_VACIO = {
  name: '',
  brand: '',
  category: '',
  description: '',
  price1: '',
  price2: '',
  price3: '',
  image_url: '',
  is_on_sale: false,
  discount_percent: 15,
  stock: 10,
};

function formularioDesde(producto) {
  if (!producto) return FORMULARIO_VACIO;
  return {
    name: producto.name || '',
    brand: producto.brand || '',
    category: producto.category || '',
    description: producto.description || '',
    price1: producto.price1 ?? '',
    price2: producto.price2 ?? '',
    price3: producto.price3 ?? '',
    image_url: producto.image_url || '',
    is_on_sale: Boolean(producto.is_on_sale),
    discount_percent: producto.discount_percent || 15,
    stock: producto.stock ?? 0,
  };
}

/** Errores por campo. Se calcula en cada render: es una función pura. */
function validarFormulario(form) {
  const errores = {};
  const stock = Number(form.stock);
  const descuento = Number(form.discount_percent);

  if (!String(form.name || '').trim()) errores.name = 'El nombre es obligatorio.';
  if (!String(form.brand || '').trim()) errores.brand = 'La marca es obligatoria.';
  if (!String(form.category || '').trim()) errores.category = 'La categoría es obligatoria.';
  if (!(Number(form.price1) > 0)) errores.price1 = 'El precio público debe ser mayor a cero.';
  if (!Number.isFinite(stock) || stock < 0) errores.stock = 'Las unidades no pueden ser negativas.';
  if (form.is_on_sale && !(descuento > 0 && descuento < 100)) {
    errores.discount_percent = 'El descuento debe estar entre 1 y 99.';
  }

  return errores;
}

/** Avisos que no impiden guardar, pero casi siempre son un error de captura. */
function avisosDePrecio(form) {
  const p1 = Number(form.price1);
  const p2 = Number(form.price2);
  const p3 = Number(form.price3);
  const avisos = [];

  if (p1 > 0 && p2 > p1) avisos.push('El precio de mayoreo (Nivel 2) es mayor que el precio público.');
  if (p1 > 0 && p3 > p1) avisos.push('El precio de distribuidor (Nivel 3) es mayor que el precio público.');
  if (p2 > 0 && p3 > p2) avisos.push('El precio de distribuidor (Nivel 3) es mayor que el de mayoreo.');

  return avisos;
}

/**
 * Alta y edición de productos.
 *
 * Vive fuera del panel para que escribir en el formulario no vuelva a renderizar
 * la tabla completa del inventario. Se apoya en `Modal` (foco, Escape, trampa de
 * tabulador) y en `Field` (etiquetas siempre asociadas).
 */
export default function ProductFormModal({
  abierto = true,
  producto = null,
  marcas = [],
  categorias = [],
  guardando = false,
  onSubirImagen,
  onGuardar,
  onCerrar,
}) {
  const [form, setForm] = useState(() => formularioDesde(producto));
  const [tocados, setTocados] = useState({});
  const [intentado, setIntentado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  const errores = useMemo(() => validarFormulario(form), [form]);
  const avisos = useMemo(() => avisosDePrecio(form), [form]);

  // Vista previa: el mismo objeto que acabaría guardado, para calcular el precio
  // con las mismas funciones que usa la tienda.
  const vistaPrevia = useMemo(
    () => ({
      name: String(form.name || '').trim() || 'Nombre del producto',
      brand: String(form.brand || '').trim() || 'Marca',
      category: String(form.category || '').trim() || 'Categoría',
      price1: Number(form.price1) || 0,
      price2: Number(form.price2) || Number(form.price1) || 0,
      price3: Number(form.price3) || Number(form.price1) || 0,
      image_url: form.image_url || '',
      is_on_sale: Boolean(form.is_on_sale),
      discount_percent: Number(form.discount_percent) || 0,
      stock: Number(form.stock) || 0,
    }),
    [form]
  );

  const campo = (nombre) => (evento) => {
    const valor = evento.target.value;
    setForm((prev) => ({ ...prev, [nombre]: valor }));
  };

  const marcarTocado = (nombre) => () => setTocados((prev) => ({ ...prev, [nombre]: true }));

  /** Muestra el error de un campo sólo cuando ya se tocó o se intentó guardar. */
  const errorDe = (nombre) => ((tocados[nombre] || intentado) && errores[nombre]) || undefined;

  const procesarImagen = async (archivo) => {
    if (!archivo) return;

    setSubiendo(true);
    const aviso = toast.loading('Procesando imagen...');
    try {
      const url = await onSubirImagen(archivo);
      setForm((prev) => ({ ...prev, image_url: url }));
      toast.success('Imagen lista', { id: aviso });
    } catch (error) {
      toast.error(error.message || 'No se pudo procesar la imagen', { id: aviso });
    } finally {
      setSubiendo(false);
    }
  };

  /** Sugerencia de precios escalonados: -10% y -20% sobre el precio público. */
  const calcularNiveles = () => {
    const base = Number(form.price1);
    if (!(base > 0)) {
      toast.error('Primero escribe el precio público.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      price2: Number((base * 0.9).toFixed(2)),
      price3: Number((base * 0.8).toFixed(2)),
    }));
  };

  const enviar = (evento) => {
    evento?.preventDefault?.();
    setIntentado(true);

    const { payload, error } = buildProductPayload(form);
    if (error) {
      toast.error(error);
      return;
    }
    onGuardar(payload);
  };

  const urlEscrita = String(form.image_url || '').startsWith('data:') ? '' : form.image_url || '';
  const hayErrores = Object.keys(errores).length > 0;

  const pie = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] text-gray-400">
        Los campos con <span className="text-brand-500">*</span> son obligatorios.
      </p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onCerrar}
          disabled={guardando}
          className="min-h-[44px] px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-white disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={enviar}
          disabled={guardando || subiendo}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-sm bg-brand-600 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-carbon-600"
        >
          <Package size={16} aria-hidden="true" />
          {guardando ? 'Guardando...' : producto ? 'Guardar Cambios' : 'Crear Producto'}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={abierto}
      onClose={guardando ? undefined : onCerrar}
      title={producto ? 'Editar Producto' : 'Nuevo Producto'}
      description={
        producto
          ? 'Cambia lo que necesites: se guarda al pulsar «Guardar Cambios».'
          : 'Captura el producto con su foto, precios por nivel y existencias.'
      }
      size="xl"
      footer={pie}
    >
      <form onSubmit={enviar} className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ------------------------------------------------------- formulario */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-3">
          <TextField
            className="sm:col-span-2"
            label="Nombre del Producto"
            required
            value={form.name}
            onChange={campo('name')}
            onBlur={marcarTocado('name')}
            error={errorDe('name')}
            placeholder="Ej: Creatina Monohidratada 300 g"
            autoComplete="off"
          />

          <Field label="Marca" required error={errorDe('brand')}>
            {({ id, describedBy, invalid }) => (
              <>
                <input
                  id={id}
                  type="text"
                  list="marcas-conocidas"
                  value={form.brand}
                  onChange={campo('brand')}
                  onBlur={marcarTocado('brand')}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  className={inputClasses({ invalid })}
                  placeholder="Ej: THAIGER LABS"
                  autoComplete="off"
                />
                <datalist id="marcas-conocidas">
                  {marcas.map((marca) => (
                    <option key={marca} value={marca} />
                  ))}
                </datalist>
              </>
            )}
          </Field>

          <Field label="Categoría" required error={errorDe('category')}>
            {({ id, describedBy, invalid }) => (
              <>
                <input
                  id={id}
                  type="text"
                  list="categorias-conocidas"
                  value={form.category}
                  onChange={campo('category')}
                  onBlur={marcarTocado('category')}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  className={inputClasses({ invalid })}
                  placeholder="Ej: Creatina"
                  autoComplete="off"
                />
                <datalist id="categorias-conocidas">
                  {categorias.map((categoria) => (
                    <option key={categoria} value={categoria} />
                  ))}
                </datalist>
              </>
            )}
          </Field>

          <TextAreaField
            className="sm:col-span-2"
            label="Descripción"
            value={form.description}
            onChange={campo('description')}
            rows={3}
            hint="Si la dejas vacía, la ficha muestra un texto genérico."
            placeholder="Ingredientes, modo de uso, presentación..."
          />

          <TextField
            label="Stock"
            required
            type="number"
            min="0"
            step="1"
            value={form.stock}
            onChange={campo('stock')}
            onBlur={marcarTocado('stock')}
            error={errorDe('stock')}
            inputClassName="sin-flechas font-bold text-white"
          />

          <TextField
            label="Precio Público"
            required
            type="number"
            min="0"
            step="0.01"
            value={form.price1}
            onChange={campo('price1')}
            onBlur={marcarTocado('price1')}
            error={errorDe('price1')}
            hint="Nivel 1: el que ve cualquier visitante."
            inputClassName="sin-flechas font-bold text-brand-500"
          />

          <TextField
            label="Precio Mayoreo"
            type="number"
            min="0"
            step="0.01"
            value={form.price2}
            onChange={campo('price2')}
            hint="Nivel 2 del carrito."
            inputClassName="sin-flechas"
          />

          <TextField
            label="Precio Distribuidor"
            type="number"
            min="0"
            step="0.01"
            value={form.price3}
            onChange={campo('price3')}
            hint="Nivel 3 del carrito."
            inputClassName="sin-flechas"
          />

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={calcularNiveles}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-brand-600/40 bg-brand-600/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-brand-500 transition-colors hover:bg-brand-600/20"
            >
              <Wand2 size={14} aria-hidden="true" /> Calcular niveles 2 y 3 (-10% / -20%)
            </button>
            <p className="mt-2 text-[11px] text-gray-400">
              Si los dejas vacíos se usa el precio público en los tres niveles.
            </p>
          </div>

          {avisos.length > 0 && (
            <div
              role="status"
              className="space-y-1 rounded-sm border border-amber-600/40 bg-amber-500/10 p-3 sm:col-span-2"
            >
              {avisos.map((aviso) => (
                <p key={aviso} className="flex items-start gap-2 text-[11px] font-bold text-amber-400">
                  <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                  {aviso}
                </p>
              ))}
            </div>
          )}

          {/* -------------------------------------------------------- oferta */}
          <div className="space-y-4 rounded-lg border border-red-900/40 bg-red-950/20 p-4 sm:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-red-400">Oferta</h3>

            <div className="flex items-center gap-4">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  aria-label="Poner en oferta"
                  checked={form.is_on_sale}
                  onChange={(evento) => {
                    const activo = evento.target.checked;
                    setForm((prev) => ({ ...prev, is_on_sale: activo }));
                  }}
                  className="peer sr-only"
                />
                <span className="block h-6 w-11 rounded-full bg-carbon-600 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-red-600 peer-checked:after:translate-x-full" />
              </label>
              <span className="text-sm font-bold text-gray-300">
                {form.is_on_sale ? 'En oferta' : 'Sin oferta'}
              </span>
            </div>

            <div className="max-w-[12rem]">
              <TextField
                label="Porcentaje de Descuento"
                type="number"
                min="1"
                max="99"
                step="1"
                disabled={!form.is_on_sale}
                value={form.discount_percent}
                onChange={campo('discount_percent')}
                error={errorDe('discount_percent')}
                inputClassName="sin-flechas font-bold text-red-400 disabled:opacity-40"
              />
            </div>

            {hasDiscount(vistaPrevia) && vistaPrevia.price1 > 0 && (
              <p className="text-xs text-gray-400">
                Precio final:{' '}
                <span className="font-bold text-red-400">{formatPrice(getDisplayPrice(vistaPrevia))}</span>{' '}
                <span className="text-gray-400 line-through">{formatPrice(vistaPrevia.price1)}</span>
              </p>
            )}
          </div>
        </div>

        {/* ----------------------------------------------- foto y vista previa */}
        <div className="space-y-6 lg:col-span-2">
          <div
            onDragOver={(evento) => {
              evento.preventDefault();
              setArrastrando(true);
            }}
            onDragEnter={(evento) => {
              evento.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(evento) => {
              evento.preventDefault();
              setArrastrando(false);
              procesarImagen(evento.dataTransfer?.files?.[0]);
            }}
            className={`space-y-3 rounded-lg border p-4 transition-colors ${
              arrastrando ? 'border-brand-500 bg-brand-600/10' : 'border-gray-800 bg-black/40'
            }`}
          >
            <Field
              label="Foto del Producto"
              hint="Arrastra la imagen aquí, elígela del disco o pega una dirección."
            >
              {({ id, describedBy }) => (
                <input
                  id={id}
                  type="file"
                  accept="image/*"
                  disabled={subiendo}
                  aria-describedby={describedBy}
                  onChange={(evento) => {
                    procesarImagen(evento.target.files?.[0]);
                    evento.target.value = '';
                  }}
                  className="w-full rounded-sm border border-gray-700 bg-carbon-900 p-3 text-sm text-gray-400 file:mr-4 file:rounded file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-brand-700 disabled:opacity-50"
                />
              )}
            </Field>

            <div className="flex items-start gap-4">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-700 bg-white">
                {form.image_url ? (
                  <img src={form.image_url} alt="Vista previa de la foto" className="h-full w-full object-contain" />
                ) : (
                  <span className="px-2 text-center text-[10px] font-bold uppercase text-gray-400">
                    <Upload size={18} className="mx-auto mb-1" aria-hidden="true" />
                    Sin foto
                  </span>
                )}
              </div>

              <div className="w-full flex-1 space-y-3">
                <input
                  type="url"
                  aria-label="URL de la imagen"
                  value={urlEscrita}
                  onChange={campo('image_url')}
                  className={inputClasses()}
                  placeholder="https://..."
                />
                {subiendo && (
                  <p role="status" className="text-xs font-bold text-brand-500">
                    Procesando imagen...
                  </p>
                )}
                {form.image_url && !subiendo && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, image_url: '' }))}
                    className="inline-flex min-h-[44px] items-center gap-1 text-xs font-bold uppercase text-gray-400 transition-colors hover:text-red-500"
                  >
                    <Trash2 size={13} aria-hidden="true" /> Quitar foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Cómo se verá en la tienda. Decorativo: no compite con el formulario. */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Así se verá en la tienda</h3>

            <div aria-hidden="true" className="superficie overflow-hidden rounded-xl">
              <div className="relative flex h-44 items-center justify-center bg-white">
                {vistaPrevia.image_url ? (
                  <img src={vistaPrevia.image_url} alt="" className="h-full w-full object-contain p-3" />
                ) : (
                  <ImageIcon size={40} className="text-gray-300" />
                )}
                {hasDiscount(vistaPrevia) && (
                  <span className="absolute left-3 top-3 rounded-sm bg-red-600 px-2 py-1 text-[10px] font-black tracking-wider text-white">
                    -{getDiscountPercent(vistaPrevia)}%
                  </span>
                )}
                {vistaPrevia.stock <= 0 && (
                  <span className="absolute right-3 top-3 rounded-sm bg-black/80 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-300">
                    Agotado
                  </span>
                )}
              </div>

              <div className="space-y-1 p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">{vistaPrevia.brand}</p>
                <p className="recorte-2 text-sm font-bold text-white">{vistaPrevia.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">{vistaPrevia.category}</p>
                <p className="pt-2 text-xl font-black text-white">
                  {formatPrice(getDisplayPrice(vistaPrevia))}
                  {hasDiscount(vistaPrevia) && (
                    <span className="ml-2 text-xs font-normal text-gray-400 line-through">
                      {formatPrice(vistaPrevia.price1)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <ul className="space-y-1 text-[11px] text-gray-400">
              <li className="flex items-center gap-2">
                <Check size={12} className={hayErrores ? 'text-gray-700' : 'text-green-500'} aria-hidden="true" />
                {hayErrores ? 'Faltan datos obligatorios por capturar.' : 'Listo para guardar.'}
              </li>
              <li>Nivel 2: {formatPrice(vistaPrevia.price2)} · Nivel 3: {formatPrice(vistaPrevia.price3)}</li>
            </ul>
          </div>
        </div>
      </form>
    </Modal>
  );
}
