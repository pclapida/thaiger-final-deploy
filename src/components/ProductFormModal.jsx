import React, { useState } from 'react';
import { DollarSign, ImageIcon, Package, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatPrice } from '../lib/pricing';
import { buildProductPayload } from '../lib/productForm';

const EMPTY_FORM = {
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

function formFromProduct(product) {
  if (!product) return EMPTY_FORM;
  return {
    name: product.name || '',
    brand: product.brand || '',
    category: product.category || '',
    description: product.description || '',
    price1: product.price1 ?? '',
    price2: product.price2 ?? '',
    price3: product.price3 ?? '',
    image_url: product.image_url || '',
    is_on_sale: Boolean(product.is_on_sale),
    discount_percent: product.discount_percent || 15,
    stock: product.stock ?? 0,
  };
}

/**
 * Alta y edición de productos.
 * Vive fuera de Dashboard para que escribir en el formulario no vuelva a
 * renderizar la tabla completa del inventario.
 */
export default function ProductFormModal({
  product,
  brands = [],
  categories = [],
  isSaving = false,
  onUploadImage,
  onSave,
  onClose,
}) {
  const [formData, setFormData] = useState(() => formFromProduct(product));
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const setField = (field) => (event) => setFormData((prev) => ({ ...prev, [field]: event.target.value }));

  const handleImageFile = async (file) => {
    if (!file) return;

    setIsUploadingImage(true);
    const toastId = toast.loading('Procesando imagen...');
    try {
      const url = await onUploadImage(file);
      setFormData((prev) => ({ ...prev, image_url: url }));
      toast.success('Imagen lista', { id: toastId });
    } catch (error) {
      toast.error(error.message || 'No se pudo procesar la imagen', { id: toastId });
    } finally {
      setIsUploadingImage(false);
    }
  };

  /** Sugerencia de precios escalonados: -10% y -20% sobre el precio público. */
  const suggestTierPrices = () => {
    const base = Number(formData.price1);
    if (!(base > 0)) return toast.error('Primero escribe el precio público.');
    setFormData((prev) => ({
      ...prev,
      price2: Number((base * 0.9).toFixed(2)),
      price3: Number((base * 0.8).toFixed(2)),
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const { payload, error } = buildProductPayload(formData);
    if (error) return toast.error(error);
    onSave(payload);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-24 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="bg-[#111] border border-gray-800 p-8 rounded-xl w-full max-w-3xl relative shadow-2xl shadow-black mb-10">
        <button
          onClick={onClose}
          disabled={isSaving}
          aria-label="Cerrar"
          className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-extrabold uppercase text-white mb-6 border-b border-gray-800 pb-4">
          {product ? 'Editar Producto' : 'Nuevo Producto'}
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 space-y-2">
            <label htmlFor="form-name" className="text-xs font-bold uppercase text-gray-500">
              Nombre del Producto *
            </label>
            <input
              id="form-name"
              type="text"
              value={formData.name}
              onChange={setField('name')}
              className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none"
              placeholder="Ej: Creatina Monohidratada 300g"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="form-brand" className="text-xs font-bold uppercase text-gray-500">
              Marca *
            </label>
            <input
              id="form-brand"
              type="text"
              list="dashboard-brands"
              value={formData.brand}
              onChange={setField('brand')}
              className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none"
              placeholder="Ej: MUTANT"
              required
            />
            <datalist id="dashboard-brands">
              {brands.map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <label htmlFor="form-category" className="text-xs font-bold uppercase text-gray-500">
              Categoría *
            </label>
            <input
              id="form-category"
              type="text"
              list="dashboard-categories"
              value={formData.category}
              onChange={setField('category')}
              className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none"
              placeholder="Ej: Creatina"
              required
            />
            <datalist id="dashboard-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>

          {/* ===== FOTO DEL PRODUCTO ===== */}
          <div className="md:col-span-2 space-y-3 bg-black/40 border border-gray-800 rounded-lg p-4">
            <label htmlFor="form-image" className="text-xs font-bold uppercase text-gray-500 flex items-center gap-2">
              <ImageIcon size={14} /> Foto del Producto
            </label>

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleImageFile(e.dataTransfer.files?.[0]);
                }}
                className="w-32 h-32 shrink-0 bg-white rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-700 relative"
                title="Arrastra una imagen aquí"
              >
                {formData.image_url ? (
                  <img src={formData.image_url} alt="Vista previa" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-gray-400 uppercase font-bold text-center px-2">
                    Arrastra o elige una imagen
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-3 w-full">
                <input
                  id="form-image"
                  type="file"
                  accept="image/*"
                  disabled={isUploadingImage}
                  onChange={(e) => {
                    handleImageFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-gray-400 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-700 disabled:opacity-50"
                />

                <input
                  type="url"
                  aria-label="URL de la imagen"
                  value={formData.image_url?.startsWith('data:') ? '' : formData.image_url}
                  onChange={setField('image_url')}
                  className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white text-sm focus:border-orange-500 focus:outline-none"
                  placeholder="...o pega la URL de una imagen"
                />

                <div className="flex items-center gap-4">
                  {isUploadingImage && <span className="text-xs text-orange-500">Procesando imagen...</span>}
                  {formData.image_url && !isUploadingImage && (
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, image_url: '' }))}
                      className="text-xs text-gray-500 hover:text-red-500 uppercase font-bold"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label htmlFor="form-description" className="text-xs font-bold uppercase text-gray-500">
              Descripción
            </label>
            <textarea
              id="form-description"
              value={formData.description}
              onChange={setField('description')}
              rows={3}
              className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none resize-y"
              placeholder="Ingredientes, modo de uso, presentación..."
            />
            <p className="text-[10px] text-gray-600">
              Si lo dejas vacío se muestra una descripción genérica en la ficha del producto.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="form-stock" className="text-xs font-bold uppercase text-gray-500">
              Stock (Unidades) *
            </label>
            <input
              id="form-stock"
              type="number"
              min="0"
              value={formData.stock}
              onChange={setField('stock')}
              className="w-full bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-green-400 font-bold focus:border-orange-500 focus:outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="form-price1" className="text-xs font-bold uppercase text-gray-500">
              Precio Público (Nivel 1) *
            </label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-3.5 text-gray-500" />
              <input
                id="form-price1"
                type="number"
                step="0.01"
                min="0"
                value={formData.price1}
                onChange={setField('price1')}
                className="w-full pl-10 bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-orange-500 font-bold focus:border-orange-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="form-price2" className="text-xs font-bold uppercase text-gray-500">
              Precio Mayoreo (Nivel 2)
            </label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-3.5 text-gray-500" />
              <input
                id="form-price2"
                type="number"
                step="0.01"
                min="0"
                value={formData.price2}
                onChange={setField('price2')}
                className="w-full pl-10 bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="form-price3" className="text-xs font-bold uppercase text-gray-500">
              Precio Distribuidor (Nivel 3)
            </label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-3.5 text-gray-500" />
              <input
                id="form-price3"
                type="number"
                step="0.01"
                min="0"
                value={formData.price3}
                onChange={setField('price3')}
                className="w-full pl-10 bg-[#0A0A0A] border border-gray-700 p-3 rounded-sm text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-2 -mt-2">
            <button
              type="button"
              onClick={suggestTierPrices}
              className="text-xs text-orange-500 hover:text-orange-400 font-bold uppercase tracking-wider"
            >
              Calcular niveles 2 y 3 (-10% / -20%)
            </button>
            <p className="text-[10px] text-gray-600 mt-1">
              Si los dejas vacíos se usará el precio público en los tres niveles.
            </p>
          </div>

          {/* ===== OFERTA ===== */}
          <div className="md:col-span-2 bg-red-900/10 border border-red-800/30 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-bold uppercase text-red-400 tracking-widest">Configuración de Oferta</h3>
            <div className="flex items-center gap-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Poner en oferta"
                  checked={formData.is_on_sale}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_on_sale: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
              <span className="text-sm font-bold text-gray-300">
                {formData.is_on_sale ? 'EN OFERTA' : 'Sin oferta'}
              </span>
            </div>

            {formData.is_on_sale && (
              <div className="space-y-2">
                <label htmlFor="form-discount" className="text-xs font-bold uppercase text-gray-500">
                  Porcentaje de Descuento (%)
                </label>
                <input
                  id="form-discount"
                  type="number"
                  min="1"
                  max="90"
                  value={formData.discount_percent}
                  onChange={setField('discount_percent')}
                  className="w-32 bg-[#0A0A0A] border border-red-700 p-3 rounded-sm text-red-400 font-bold focus:border-red-500 focus:outline-none"
                />
                {Number(formData.price1) > 0 && Number(formData.discount_percent) > 0 && (
                  <p className="text-xs text-gray-400">
                    Precio final:{' '}
                    <span className="text-red-400 font-bold">
                      {formatPrice(Number(formData.price1) * (1 - Number(formData.discount_percent) / 100))}
                    </span>{' '}
                    <span className="line-through text-gray-600">{formatPrice(Number(formData.price1))}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-800 flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-3 font-bold uppercase text-xs tracking-widest text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploadingImage}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white font-bold py-3 px-6 rounded-sm uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-transform flex items-center gap-2"
            >
              <Package size={16} />
              {isSaving ? 'Guardando...' : product ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
