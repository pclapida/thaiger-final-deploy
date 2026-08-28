import React, { useState } from 'react';
import { AlertTriangle, Banknote, Home, Megaphone, RotateCcw, Save, Share2, Store, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings } from '../../context/SettingsContext';
import { sanitizeLinkUrl } from '../../lib/security';
import { formatPrice } from '../../lib/pricing';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Skeleton } from '../ui/Skeleton';
import { TextAreaField, TextField } from '../ui/Field';

const BOTON_SECUNDARIO =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-40';

const BOTON_MARCA =
  'flex min-h-[44px] items-center justify-center gap-2 rounded-sm bg-brand-600 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-600/20 transition-colors hover:bg-brand-700 disabled:opacity-40';

const REDES = [
  { campo: 'facebook', etiqueta: 'Facebook' },
  { campo: 'instagram', etiqueta: 'Instagram' },
  { campo: 'tiktok', etiqueta: 'TikTok' },
  { campo: 'youtube', etiqueta: 'YouTube' },
];

/** Cabecera de cada bloque del formulario. */
function Bloque({ icono, titulo, descripcion, children }) {
  const Icono = icono;

  return (
    <section className="superficie space-y-5 rounded-xl p-5">
      <header>
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-300">
          <Icono size={16} className="text-brand-500" aria-hidden="true" /> {titulo}
        </h2>
        {descripcion && <p className="mt-1 text-xs text-gray-400">{descripcion}</p>}
      </header>
      {children}
    </section>
  );
}

/**
 * Formulario de ajustes.
 *
 * Se monta con la configuración ya cargada: así los campos arrancan con los
 * valores reales y el aviso de «cambios sin guardar» dice la verdad.
 */
function FormularioAjustes({ inicial, onGuardar, onRestaurar }) {
  const [datos, setDatos] = useState(() => JSON.parse(JSON.stringify(inicial)));
  const [referencia, setReferencia] = useState(() => JSON.stringify(inicial));
  const [guardando, setGuardando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [confirmarRestauracion, setConfirmarRestauracion] = useState(false);

  const haCambiado = JSON.stringify(datos) !== referencia;

  const cambiar = (grupo, campo) => (evento) => {
    const valor = evento.target.type === 'checkbox' ? evento.target.checked : evento.target.value;
    setDatos((previo) => ({ ...previo, [grupo]: { ...previo[grupo], [campo]: valor } }));
  };

  const numero = (valor, respaldo = 0) => {
    const convertido = Number(valor);
    return Number.isFinite(convertido) && convertido >= 0 ? convertido : respaldo;
  };

  const guardar = async () => {
    const tier2 = numero(datos.tiers.tier2From);
    const tier3 = numero(datos.tiers.tier3From);

    if (tier3 < tier2) {
      toast.error('El umbral del Nivel 3 no puede ser menor que el del Nivel 2.');
      return;
    }

    for (const red of REDES) {
      const url = String(datos.social[red.campo] || '').trim();
      if (url && !sanitizeLinkUrl(url)) {
        toast.error(`La dirección de ${red.etiqueta} no es válida.`);
        return;
      }
    }

    const parche = {
      store: datos.store,
      payment: datos.payment,
      shipping: { freeFrom: numero(datos.shipping.freeFrom), cost: numero(datos.shipping.cost) },
      tiers: { tier2From: tier2, tier3From: tier3 },
      home: datos.home,
      social: Object.fromEntries(
        REDES.map((red) => [red.campo, sanitizeLinkUrl(String(datos.social[red.campo] || '').trim())])
      ),
      banner: datos.banner,
    };

    setGuardando(true);
    try {
      const guardados = await onGuardar(parche);
      const siguiente = JSON.parse(JSON.stringify(guardados));
      setDatos(siguiente);
      setReferencia(JSON.stringify(siguiente));
      toast.success('Ajustes guardados');
    } catch (fallo) {
      toast.error(`No se pudo guardar: ${fallo.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const restaurar = async () => {
    setRestaurando(true);
    try {
      const base = await onRestaurar();
      const siguiente = JSON.parse(JSON.stringify(base));
      setDatos(siguiente);
      setReferencia(JSON.stringify(siguiente));
      toast.success('Se restauraron los valores por defecto');
    } catch (fallo) {
      toast.error(`No se pudo restaurar: ${fallo.message}`);
    } finally {
      setRestaurando(false);
      setConfirmarRestauracion(false);
    }
  };

  const envioGratisDesde = numero(datos.shipping.freeFrom);
  const costoEnvio = numero(datos.shipping.cost);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="titulo-seccion font-extrabold uppercase tracking-widest text-brand-500">
            Ajustes de la Tienda
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Contacto, cuenta de pago, envíos, niveles de precio y textos de la portada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {haCambiado && (
            <span
              role="status"
              className="rounded-sm border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-amber-400"
            >
              Cambios sin guardar
            </span>
          )}
          <button type="button" onClick={() => setConfirmarRestauracion(true)} className={BOTON_SECUNDARIO}>
            <RotateCcw size={16} aria-hidden="true" /> Restaurar valores por defecto
          </button>
          <button type="button" onClick={guardar} disabled={guardando || !haCambiado} className={BOTON_MARCA}>
            <Save size={16} aria-hidden="true" /> {guardando ? 'Guardando...' : 'Guardar ajustes'}
          </button>
        </div>
      </header>

      {datos.payment.isDemo && (
        <p
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-800/60 bg-red-950/40 p-4 text-sm text-red-300"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
          <span>
            <span className="font-bold uppercase tracking-widest">Datos bancarios de ejemplo.</span> Sustituye el
            banco, la CLABE y el beneficiario por los reales —y desmarca la casilla— antes de aceptar el primer
            pago.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Bloque icono={Store} titulo="Tienda" descripcion="Identidad y datos de contacto que se ven en todo el sitio.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Nombre" value={datos.store.name} onChange={cambiar('store', 'name')} />
            <TextField label="Lema" value={datos.store.tagline} onChange={cambiar('store', 'tagline')} />
            <TextAreaField
              className="sm:col-span-2"
              label="Descripción"
              rows={2}
              value={datos.store.description}
              onChange={cambiar('store', 'description')}
            />
            <TextField label="Correo" type="email" value={datos.store.email} onChange={cambiar('store', 'email')} />
            <TextField label="Teléfono" value={datos.store.phone} onChange={cambiar('store', 'phone')} />
            <TextField
              label="WhatsApp"
              value={datos.store.whatsapp}
              onChange={cambiar('store', 'whatsapp')}
              hint="Sólo dígitos, con clave de país: 5255..."
            />
            <TextField label="Horario" value={datos.store.hours} onChange={cambiar('store', 'hours')} />
            <TextField
              className="sm:col-span-2"
              label="Dirección"
              value={datos.store.address}
              onChange={cambiar('store', 'address')}
            />
            <TextField
              className="sm:col-span-2"
              label="Nota de envíos"
              value={datos.store.shippingNote}
              onChange={cambiar('store', 'shippingNote')}
            />
          </div>
        </Bloque>

        <Bloque
          icono={Banknote}
          titulo="Pago por transferencia (SPEI)"
          descripcion="Es la cuenta que ve el cliente al terminar la compra."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Banco" value={datos.payment.bank} onChange={cambiar('payment', 'bank')} />
            <TextField
              label="CLABE"
              value={datos.payment.clabe}
              onChange={cambiar('payment', 'clabe')}
              inputClassName="font-mono"
            />
            <TextField
              className="sm:col-span-2"
              label="Beneficiario"
              value={datos.payment.beneficiary}
              onChange={cambiar('payment', 'beneficiary')}
            />
            <TextAreaField
              className="sm:col-span-2"
              label="Instrucciones"
              rows={3}
              value={datos.payment.instructions}
              onChange={cambiar('payment', 'instructions')}
            />
          </div>

          <label className="flex items-start gap-3 rounded-sm border border-gray-800 p-3">
            <input
              type="checkbox"
              checked={Boolean(datos.payment.isDemo)}
              onChange={cambiar('payment', 'isDemo')}
              className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600"
            />
            <span className="text-xs leading-relaxed text-gray-400">
              <span className="font-bold uppercase tracking-widest text-gray-300">
                Estos son datos de ejemplo
              </span>
              <br />
              Mientras esté marcada, la tienda avisa a los clientes de que no deben transferir dinero.
            </span>
          </label>
        </Bloque>

        <Bloque icono={Truck} titulo="Envíos" descripcion="Se aplican al calcular el total del carrito.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Envío gratis desde"
              type="number"
              min="0"
              value={datos.shipping.freeFrom}
              onChange={cambiar('shipping', 'freeFrom')}
              inputClassName="sin-flechas"
            />
            <TextField
              label="Costo de envío"
              type="number"
              min="0"
              value={datos.shipping.cost}
              onChange={cambiar('shipping', 'cost')}
              inputClassName="sin-flechas"
            />
          </div>

          <p className="rounded-sm border border-gray-800 bg-black/40 p-3 text-xs leading-relaxed text-gray-400">
            Una compra de {formatPrice(envioGratisDesde - 1)} paga {formatPrice(costoEnvio)} de envío; a partir de{' '}
            {formatPrice(envioGratisDesde)} el envío sale gratis.
          </p>
        </Bloque>

        <Bloque
          icono={Home}
          titulo="Niveles de precio"
          descripcion="Montos del carrito (a precio de lista) que desbloquean cada nivel."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Nivel 2 desde"
              type="number"
              min="0"
              value={datos.tiers.tier2From}
              onChange={cambiar('tiers', 'tier2From')}
              inputClassName="sin-flechas"
              hint="Precio de mayoreo (price2)."
            />
            <TextField
              label="Nivel 3 desde"
              type="number"
              min="0"
              value={datos.tiers.tier3From}
              onChange={cambiar('tiers', 'tier3From')}
              inputClassName="sin-flechas"
              error={
                numero(datos.tiers.tier3From) < numero(datos.tiers.tier2From)
                  ? 'Debe ser mayor o igual que el umbral del Nivel 2.'
                  : undefined
              }
              hint="Precio de distribuidor (price3)."
            />
          </div>
        </Bloque>

        <Bloque icono={Home} titulo="Portada" descripcion="Títulos de las secciones de la página de inicio.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Título de destacados"
              value={datos.home.featuredTitle}
              onChange={cambiar('home', 'featuredTitle')}
            />
            <TextField
              label="Título de promociones"
              value={datos.home.promoTitle}
              onChange={cambiar('home', 'promoTitle')}
            />
            <TextField
              className="sm:col-span-2"
              label="Título de marcas"
              value={datos.home.brandsTitle}
              onChange={cambiar('home', 'brandsTitle')}
            />
          </div>

          <label className="flex items-center gap-3 rounded-sm border border-gray-800 p-3">
            <input
              type="checkbox"
              checked={Boolean(datos.home.showBrandStrip)}
              onChange={cambiar('home', 'showBrandStrip')}
              className="h-4 w-4 shrink-0 accent-orange-600"
            />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
              Mostrar la cinta de marcas
            </span>
          </label>
        </Bloque>

        <Bloque icono={Share2} titulo="Redes sociales" descripcion="Una dirección vacía oculta su icono del pie.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {REDES.map((red) => {
              const valor = String(datos.social[red.campo] || '');
              return (
                <TextField
                  key={red.campo}
                  label={red.etiqueta}
                  type="url"
                  value={valor}
                  onChange={cambiar('social', red.campo)}
                  placeholder="https://..."
                  error={valor.trim() && !sanitizeLinkUrl(valor.trim()) ? 'Dirección no válida.' : undefined}
                />
              );
            })}
          </div>
        </Bloque>

        <Bloque
          icono={Megaphone}
          titulo="Aviso superior"
          descripcion="La cinta que aparece sobre la barra de navegación."

        >
          <TextAreaField
            label="Texto del aviso"
            rows={2}
            value={datos.banner.text}
            onChange={cambiar('banner', 'text')}
          />

          <label className="flex items-center gap-3 rounded-sm border border-gray-800 p-3">
            <input
              type="checkbox"
              checked={Boolean(datos.banner.active)}
              onChange={cambiar('banner', 'active')}
              className="h-4 w-4 shrink-0 accent-orange-600"
            />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-300">Mostrar el aviso</span>
          </label>
        </Bloque>
      </div>

      <ConfirmDialog
        open={confirmarRestauracion}
        title="Restaurar los valores por defecto"
        message="Se descartan los ajustes actuales (contacto, cuenta de pago, envíos, niveles, portada, redes y carrusel) y vuelven los de fábrica. Los productos y los pedidos no se tocan."
        confirmLabel="Sí, restaurar"
        tone="warning"
        busy={restaurando}
        onConfirm={restaurar}
        onCancel={() => setConfirmarRestauracion(false)}
      />
    </div>
  );
}

/** Envoltorio: espera a que la configuración esté cargada. */
export default function PanelAjustes() {
  const { settings, loading, save, reset } = useSettings();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return <FormularioAjustes inicial={settings} onGuardar={save} onRestaurar={reset} />;
}
