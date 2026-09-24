import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  Copyright,
  CreditCard,
  FileText,
  Gavel,
  HeartPulse,
  Mail,
  RefreshCw,
  ShieldCheck,
  Tags,
  Truck,
  UserCog,
} from 'lucide-react';
import DocumentoLegal, { SeccionLegal } from '../components/legal/DocumentoLegal';
import DatosResponsable from '../components/legal/DatosResponsable';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSettings } from '../context/SettingsContext';
import { formatPrice, getPricingConfig } from '../lib/pricing';
import { datosLegales } from '../lib/legal';

/**
 * Términos y condiciones de uso y de venta.
 *
 * Ninguna cifra está escrita a mano: umbrales de nivel y envío salen de la
 * misma configuración que cobra el carrito, y quien vende sale de
 * Ajustes → Datos legales. Así la página legal nunca contradice a la caja.
 *
 * Es una base redactada para el comercio electrónico en México (Ley Federal
 * de Protección al Consumidor y NOM-247-SE-2021): conviene que la revise un
 * abogado antes de darla por definitiva.
 */

const SECCIONES = [
  { id: 'general', titulo: '1. Quién vende' },
  { id: 'cuenta', titulo: '2. Cuenta y uso del sitio' },
  { id: 'productos', titulo: '3. Productos y salud' },
  { id: 'precios', titulo: '4. Precios y promociones' },
  { id: 'pagos', titulo: '5. Pedidos y pagos' },
  { id: 'envios', titulo: '6. Envíos' },
  { id: 'devoluciones', titulo: '7. Cancelaciones y devoluciones' },
  { id: 'propiedad', titulo: '8. Propiedad intelectual' },
  { id: 'responsabilidad', titulo: '9. Responsabilidad' },
  { id: 'privacidad', titulo: '10. Privacidad' },
  { id: 'ley', titulo: '11. Ley aplicable y quejas' },
  { id: 'contacto', titulo: '12. Contacto' },
];

/** Devuelve el número de los ajustes o el de la configuración de precios. */
function numero(valor, alterno) {
  if (valor === null || valor === undefined || valor === '') return alterno;
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido >= 0 ? convertido : alterno;
}

const ENLACE = 'text-brand-400 underline-offset-2 hover:underline';

export default function Terms() {
  useDocumentTitle(
    'Términos y Condiciones',
    'Condiciones de uso del sitio y de venta de Thaiger Supplements: precios, pagos, envíos, devoluciones y privacidad.'
  );

  const { settings } = useSettings();
  const legal = datosLegales(settings);
  const conMercadoPago = settings.payment?.gateway === 'mercadopago';

  const reglas = useMemo(() => {
    const base = getPricingConfig();
    return {
      envioGratisDesde: numero(settings.shipping?.freeFrom, base.freeShippingFrom),
      nivel2Desde: numero(settings.tiers?.tier2From, base.tier2From),
      nivel3Desde: numero(settings.tiers?.tier3From, base.tier3From),
    };
  }, [settings]);

  return (
    <DocumentoLegal
      titulo="Términos y Condiciones"
      intro={`Estas son las condiciones con las que ${legal.nombreComercial} vende en este sitio: cómo se calculan los precios, cómo se paga, cómo se envía y qué puedes hacer si algo sale mal.`}
      secciones={SECCIONES}
    >
      <SeccionLegal id="general" titulo="1. Quién vende" icono={FileText}>
        <p>
          Este sitio y las ventas que se hacen en él son operados por <strong>{legal.responsable}</strong>
          {legal.rfc && <> (RFC {legal.rfc})</>}
          {legal.responsable !== legal.nombreComercial && <>, bajo el nombre comercial {legal.nombreComercial}</>}.
        </p>
        <DatosResponsable legal={legal} />
        <p>
          Al navegar, crear una cuenta o hacer un pedido aceptas estos términos. Si no estás de acuerdo con
          alguno, no uses el sitio. Podemos actualizarlos; a cada compra se le aplican los que estaban publicados
          el día en que se hizo el pedido.
        </p>
      </SeccionLegal>

      <SeccionLegal id="cuenta" titulo="2. Cuenta y uso del sitio" icono={UserCog}>
        <p>
          Puedes ver el catálogo sin cuenta; para comprar necesitas registrarte. Para comprar debes ser mayor de
          edad o hacerlo con la supervisión de tu madre, padre o tutor.
        </p>
        <p>
          Los datos que captures deben ser verdaderos. Eres responsable de lo que se haga con tu sesión: no
          compartas tu contraseña y cierra sesión en equipos que no sean tuyos.
        </p>
        <p>No está permitido:</p>
        <ul>
          <li>Intentar entrar a cuentas ajenas o a las zonas de administración.</li>
          <li>Usar robots o procesos automáticos para copiar el catálogo o saturar el sitio.</li>
          <li>Publicar opiniones falsas, ofensivas o con datos de otras personas.</li>
        </ul>
        <p>Podemos suspender o cancelar las cuentas que incumplan estas reglas.</p>
      </SeccionLegal>

      <SeccionLegal id="productos" titulo="3. Productos y salud" icono={HeartPulse}>
        <p>
          Vendemos <strong>suplementos alimenticios</strong>. No son medicamentos y no están destinados a
          diagnosticar, tratar, curar ni prevenir ninguna enfermedad.{' '}
          <strong>
            El consumo de estos productos es responsabilidad de quien los recomienda y de quien los usa.
          </strong>
        </p>
        <ul>
          <li>Lee siempre la etiqueta y respeta la porción recomendada por el fabricante.</li>
          <li>
            Consulta a un profesional de la salud antes de consumirlos si estás embarazada o en lactancia, si
            tomas medicamentos, si tienes algún padecimiento o si son para una persona menor de edad.
          </li>
          <li>Revisa los ingredientes si tienes alergias o intolerancias.</li>
        </ul>
        <p>
          La información de cada ficha viene de la etiqueta del fabricante. Las fotos son ilustrativas: la
          presentación puede cambiar por decisión de la marca. La existencia se descuenta al confirmar el pedido y
          lo agotado no se puede comprar.
        </p>
      </SeccionLegal>

      <SeccionLegal id="precios" titulo="4. Precios y promociones" icono={Tags}>
        <p>
          Los precios están en pesos mexicanos (MXN) y son el total que pagas por cada producto, con los
          impuestos incluidos. El costo de envío se muestra aparte, antes de pagar.
        </p>
        <p>El precio de cada producto baja según el monto de tu carrito (calculado con precios de lista):</p>
        <ul>
          <li>Nivel 1: precio de lista, desde el primer producto.</li>
          <li>Nivel 2: desde {formatPrice(reglas.nivel2Desde)} en el carrito.</li>
          <li>Nivel 3: desde {formatPrice(reglas.nivel3Desde)} en el carrito.</li>
        </ul>
        <p>
          Las ofertas aplican su descuento sobre el precio del nivel que te toque y valen mientras estén
          publicadas o haya existencia. El detalle está en{' '}
          <Link to="/wholesale" className={ENLACE}>
            venta de mayoreo
          </Link>
          .
        </p>
        <p>
          El precio que vale es el que calcula el sistema al confirmar el pedido. Si por un error evidente un
          producto se publica con un precio notoriamente equivocado, te avisaremos y podrás elegir entre pagar el
          precio correcto o cancelar con la devolución íntegra de lo que hayas pagado.
        </p>
      </SeccionLegal>

      <SeccionLegal id="pagos" titulo="5. Pedidos y pagos" icono={CreditCard}>
        <p>
          Al confirmar el pedido verás el resumen con productos, envío y total. La compra queda hecha cuando se
          confirma tu pago; te avisamos por correo y en tu perfil.
        </p>
        {conMercadoPago ? (
          <p>
            Los pagos se procesan con <strong>Mercado Pago</strong> (tarjeta de crédito o débito, transferencia
            SPEI y efectivo en OXXO). Los datos de tu tarjeta los captura Mercado Pago: nosotros nunca los vemos
            ni los guardamos. El pedido pasa a «Pagado» en cuanto Mercado Pago confirma el cobro.
          </p>
        ) : (
          <p>
            El pago se hace por <strong>transferencia SPEI</strong> a la cuenta que te mostramos al confirmar,
            usando el concepto único de tu pedido para poder identificarlo. El pedido pasa a prepararse cuando
            el pago se acredita.
          </p>
        )}
        <p>
          Tu pedido queda apartado mientras pagas. Si el pago no se acredita en 72 horas, podemos cancelarlo y
          liberar el inventario.
        </p>
        <p>
          <strong>Facturación:</strong> si necesitas factura (CFDI), pídela por correo dentro del mes de tu
          compra con tu número de pedido y tu constancia de situación fiscal.
        </p>
      </SeccionLegal>

      <SeccionLegal id="envios" titulo="6. Envíos" icono={Truck}>
        <p>
          Enviamos a toda la República Mexicana. El costo se calcula antes de pagar, y el envío es gratis en
          compras desde {formatPrice(reglas.envioGratisDesde)}. Revisa tu dirección antes de confirmar: con un
          dato incorrecto el paquete puede regresar.
        </p>
        <p>
          Tiempos, rastreo y qué hacer si el paquete llega dañado:{' '}
          <Link to="/envios" className={ENLACE}>
            Envíos y entregas
          </Link>
          .
        </p>
      </SeccionLegal>

      <SeccionLegal id="devoluciones" titulo="7. Cancelaciones y devoluciones" icono={RefreshCw}>
        <p>
          Puedes cancelar sin costo mientras tu pedido no se haya enviado. Una vez recibido, tienes{' '}
          <strong>5 días hábiles</strong> para revocar la compra, conforme a la Ley Federal de Protección al
          Consumidor, con el producto cerrado y su sello intacto.
        </p>
        <p>
          Por seguridad sanitaria no aceptamos productos abiertos o con el sello roto, salvo que hayan llegado
          dañados, con defecto, caducados o distintos a lo que pediste. Todo el procedimiento está en{' '}
          <Link to="/refunds" className={ENLACE}>
            Devoluciones y reembolsos
          </Link>
          .
        </p>
      </SeccionLegal>

      <SeccionLegal id="propiedad" titulo="8. Propiedad intelectual" icono={Copyright}>
        <p>
          El diseño, los textos, las fotografías y el código de este sitio son de {legal.responsable} o de sus
          autores, y se usan con permiso. Las marcas y logotipos de los productos pertenecen a sus fabricantes.
          No puedes copiarlos ni usarlos con fines comerciales sin autorización por escrito.
        </p>
      </SeccionLegal>

      <SeccionLegal id="responsabilidad" titulo="9. Responsabilidad" icono={AlertTriangle}>
        <p>
          Hacemos lo posible por que el sitio funcione sin interrupciones y la información sea correcta, pero
          puede haber pausas por mantenimiento o fallas de terceros (hospedaje, pasarela de pago, paqueterías).
        </p>
        <ul>
          <li>No respondemos por el uso de los productos en contra de la etiqueta o de estas indicaciones.</li>
          <li>
            No respondemos por retrasos causados por la paquetería, por direcciones incorrectas o por causas de
            fuerza mayor, aunque te ayudaremos a darle seguimiento a cualquier envío.
          </li>
        </ul>
        <p>Nada de lo anterior limita los derechos que te da la Ley Federal de Protección al Consumidor.</p>
      </SeccionLegal>

      <SeccionLegal id="privacidad" titulo="10. Privacidad" icono={ShieldCheck}>
        <p>
          Qué datos pedimos, para qué los usamos, con quién los compartimos y cómo ejercer tus derechos ARCO está
          en el{' '}
          <Link to="/privacidad" className={ENLACE}>
            Aviso de privacidad
          </Link>
          .
        </p>
      </SeccionLegal>

      <SeccionLegal id="ley" titulo="11. Ley aplicable y quejas" icono={Gavel}>
        <p>
          Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Si tienes una queja, escríbenos
          primero: casi todo se resuelve así. Si no quedas satisfecho, puedes acudir a la{' '}
          <strong>Procuraduría Federal del Consumidor (PROFECO)</strong>, que es competente en la vía
          administrativa; en la vía judicial, a los tribunales competentes conforme a la ley.
        </p>
        <p className="flex items-start gap-2">
          <Ban size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
          <span>No aplicamos cláusulas que te obliguen a renunciar a los derechos que la ley te reconoce.</span>
        </p>
      </SeccionLegal>

      <SeccionLegal id="contacto" titulo="12. Contacto" icono={Mail}>
        <p>Para dudas, aclaraciones, cancelaciones o facturas:</p>
        <DatosResponsable legal={legal} soloContacto />
      </SeccionLegal>
    </DocumentoLegal>
  );
}
