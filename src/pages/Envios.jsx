import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Home, MapPinned, PackageSearch, Receipt, Truck } from 'lucide-react';
import DocumentoLegal, { SeccionLegal } from '../components/legal/DocumentoLegal';
import DatosResponsable from '../components/legal/DatosResponsable';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSettings } from '../context/SettingsContext';
import { formatPrice, getPricingConfig } from '../lib/pricing';
import { datosLegales } from '../lib/legal';

/**
 * Política de envíos y entregas.
 *
 * El costo y el umbral de envío gratis salen de los ajustes (los mismos que
 * cobra el carrito), y el texto cambia según la paquetería configurada:
 * tarifa fija (manual) o cotización por código postal (Skydropx).
 */

const SECCIONES = [
  { id: 'cobertura', titulo: '1. Cobertura' },
  { id: 'costo', titulo: '2. Costo' },
  { id: 'tiempos', titulo: '3. Tiempos' },
  { id: 'rastreo', titulo: '4. Rastreo' },
  { id: 'recepcion', titulo: '5. Al recibir' },
  { id: 'incidencias', titulo: '6. Si algo falla' },
  { id: 'contacto', titulo: '7. Contacto' },
];

function numero(valor, alterno) {
  if (valor === null || valor === undefined || valor === '') return alterno;
  const convertido = Number(valor);
  return Number.isFinite(convertido) && convertido >= 0 ? convertido : alterno;
}

export default function Envios() {
  useDocumentTitle('Envíos y Entregas', 'Cobertura, costos, tiempos y rastreo de los envíos de Thaiger Supplements.');

  const { settings } = useSettings();
  const legal = datosLegales(settings);
  const base = getPricingConfig();
  const envioGratisDesde = numero(settings.shipping?.freeFrom, base.freeShippingFrom);
  const costoFijo = numero(settings.shipping?.cost, base.shippingCost);
  const cotizaPorCodigoPostal = settings.shipping?.provider === 'skydropx';

  return (
    <DocumentoLegal
      titulo="Envíos y Entregas"
      intro="A dónde enviamos, cuánto cuesta, cuánto tarda y cómo rastrear tu pedido."
      secciones={SECCIONES}
    >
      <SeccionLegal id="cobertura" titulo="1. Cobertura" icono={MapPinned}>
        <p>
          Enviamos a <strong>toda la República Mexicana</strong> por paquetería. Por ahora no hacemos envíos
          internacionales.
        </p>
      </SeccionLegal>

      <SeccionLegal id="costo" titulo="2. Costo" icono={Receipt}>
        {cotizaPorCodigoPostal ? (
          <p>
            El costo se cotiza con varias paqueterías según tu código postal y el peso de tu pedido. En el
            checkout eliges la opción que prefieras, con su precio y tiempo estimado, <strong>antes de pagar</strong>.
          </p>
        ) : (
          <p>
            El envío cuesta <strong>{formatPrice(costoFijo)}</strong> por pedido y se muestra en el carrito{' '}
            <strong>antes de pagar</strong>.
          </p>
        )}
        <p>
          Es <strong>gratis en compras desde {formatPrice(envioGratisDesde)}</strong>. Nunca se agregan cargos
          de envío después de que pagaste.
        </p>
      </SeccionLegal>

      <SeccionLegal id="tiempos" titulo="3. Tiempos" icono={Clock}>
        <ul>
          <li>
            <strong>Preparación:</strong> de 1 a 2 días hábiles después de que se confirma tu pago
            {legal.horario ? ` (atendemos ${legal.horario.charAt(0).toLowerCase()}${legal.horario.slice(1)})` : ''}.
            Lo pagado en fin de semana o día festivo se prepara el siguiente día hábil.
          </li>
          <li>
            <strong>Traslado:</strong>{' '}
            {cotizaPorCodigoPostal
              ? 'el que indica la paquetería que elegiste en el checkout.'
              : 'normalmente de 2 a 5 días hábiles, según la paquetería y tu código postal.'}{' '}
            Las zonas extendidas o de difícil acceso pueden tardar más.
          </li>
        </ul>
        <p>Los tiempos son estimados de la paquetería y pueden variar en temporadas altas.</p>
      </SeccionLegal>

      <SeccionLegal id="rastreo" titulo="4. Rastreo" icono={PackageSearch}>
        <p>
          Cuando tu pedido sale, su estatus cambia a «Enviado» y el <strong>número de guía</strong> aparece en{' '}
          <Link to="/profile" className="text-brand-400 underline-offset-2 hover:underline">
            Mi cuenta → Mis pedidos
          </Link>
          , con el enlace para rastrearlo en la página de la paquetería. También te avisamos por correo.
        </p>
      </SeccionLegal>

      <SeccionLegal id="recepcion" titulo="5. Al recibir" icono={Home}>
        <ul>
          <li>Revisa la caja frente al repartidor. Si viene abierta o dañada, anótalo en la guía o recházala.</li>
          <li>
            Si no hay nadie, la paquetería suele intentar de nuevo o dejar aviso. Si el paquete regresa por
            ausencia repetida o por una dirección incorrecta o incompleta, el nuevo envío tiene costo.
          </li>
          <li>Revisa tu dirección, código postal y teléfono antes de confirmar tu pedido.</li>
        </ul>
      </SeccionLegal>

      <SeccionLegal id="incidencias" titulo="6. Si algo falla" icono={AlertTriangle}>
        <ul>
          <li>
            <strong>Retraso:</strong> si tu envío pasa del tiempo estimado, escríbenos y abrimos el seguimiento
            con la paquetería.
          </li>
          <li>
            <strong>Extravío:</strong> si la paquetería confirma que el paquete se perdió, te reponemos el pedido o
            te devolvemos el total, envío incluido.
          </li>
          <li>
            <strong>Daño o faltante:</strong> repórtalo en las 48 horas siguientes a la entrega, con fotos, como
            se explica en{' '}
            <Link to="/refunds" className="text-brand-400 underline-offset-2 hover:underline">
              Devoluciones y reembolsos
            </Link>
            .
          </li>
        </ul>
      </SeccionLegal>

      <SeccionLegal id="contacto" titulo="7. Contacto" icono={Truck}>
        <DatosResponsable legal={legal} soloContacto />
      </SeccionLegal>
    </DocumentoLegal>
  );
}
