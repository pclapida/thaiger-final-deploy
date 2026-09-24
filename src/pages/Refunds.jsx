import React from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  Banknote,
  CalendarClock,
  ClipboardList,
  Mail,
  PackageCheck,
  PackageX,
  ShieldCheck,
  Undo2,
  XCircle,
} from 'lucide-react';
import DocumentoLegal, { SeccionLegal } from '../components/legal/DocumentoLegal';
import DatosResponsable from '../components/legal/DatosResponsable';
import Reveal from '../components/ui/Reveal';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSettings } from '../context/SettingsContext';
import { datosLegales } from '../lib/legal';

/**
 * Política de cancelaciones, devoluciones y reembolsos.
 *
 * Parte del derecho de revocación de la Ley Federal de Protección al
 * Consumidor (5 días hábiles en ventas a distancia) y de la restricción
 * sanitaria de los suplementos: lo abierto no se revende, así que sólo se
 * acepta de vuelta si llegó mal. Conviene que lo revise un abogado.
 */

const SECCIONES = [
  { id: 'resumen', titulo: 'En corto' },
  { id: 'cancelar', titulo: '1. Cancelar antes del envío' },
  { id: 'revocacion', titulo: '2. Devolver un producto cerrado' },
  { id: 'danado', titulo: '3. Si llegó mal' },
  { id: 'abiertos', titulo: '4. Productos abiertos' },
  { id: 'solicitar', titulo: '5. Cómo pedirlo' },
  { id: 'reembolsos', titulo: '6. Reembolsos' },
  { id: 'contacto', titulo: '7. Contacto' },
];

const RESUMEN = [
  { icono: XCircle, titulo: 'Sin costo', texto: 'Cancelas gratis mientras tu pedido no se haya enviado.' },
  { icono: CalendarClock, titulo: '5 días hábiles', texto: 'Para devolver un producto cerrado, desde que lo recibes.' },
  { icono: PackageX, titulo: '48 horas', texto: 'Para reportar un producto dañado, equivocado o incompleto.' },
  { icono: Banknote, titulo: 'Mismo medio', texto: 'El reembolso vuelve por la vía con la que pagaste.' },
];

export default function Refunds() {
  useDocumentTitle(
    'Devoluciones y Reembolsos',
    'Cómo cancelar un pedido, devolver un producto y recibir tu reembolso en Thaiger Supplements.'
  );

  const { settings } = useSettings();
  const legal = datosLegales(settings);
  const contacto = legal.correo || 'nuestro correo de contacto';

  return (
    <DocumentoLegal
      titulo="Devoluciones y Reembolsos"
      intro="Qué puedes cancelar o devolver, en qué plazos y cómo te regresamos tu dinero."
      secciones={SECCIONES}
    >
      <section id="resumen" aria-labelledby="resumen-titulo" className="scroll-mt-28">
        <h2 id="resumen-titulo" className="sr-only">
          En corto
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {RESUMEN.map((punto, indice) => (
            <Reveal key={punto.titulo} index={indice} className="superficie rounded-2xl p-5">
              <punto.icono size={22} className="text-brand-500" aria-hidden="true" />
              <p className="mt-3 text-base font-black uppercase tracking-wide text-white">{punto.titulo}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-400">{punto.texto}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <SeccionLegal id="cancelar" titulo="1. Cancelar antes del envío" icono={XCircle}>
        <p>
          Mientras tu pedido no tenga guía de envío puedes cancelarlo sin costo: escríbenos con tu número de
          pedido. Si ya lo pagaste, te devolvemos el total, envío incluido.
        </p>
        <p>
          Si el pedido ya salió, ya no se puede detener en camino: recíbelo y sigue el procedimiento de
          devolución del punto 2.
        </p>
      </SeccionLegal>

      <SeccionLegal id="revocacion" titulo="2. Devolver un producto cerrado" icono={Undo2}>
        <p>
          Conforme a la Ley Federal de Protección al Consumidor, tienes <strong>5 días hábiles</strong> desde
          que recibes tu pedido para arrepentirte de la compra (revocación), sin tener que dar explicaciones.
          Para aceptarlo, el producto debe:
        </p>
        <ul>
          <li>Estar cerrado, con el sello de seguridad intacto y sin señales de uso.</li>
          <li>Venir en su empaque original, con todo lo que incluía.</li>
        </ul>
        <p>
          En este caso el costo del envío de regreso corre por tu cuenta. Te reembolsamos lo que pagaste por los
          productos devueltos en cuanto los recibimos y revisamos.
        </p>
      </SeccionLegal>

      <SeccionLegal id="danado" titulo="3. Si llegó mal" icono={PackageCheck}>
        <p>
          Si tu pedido llegó <strong>dañado, abierto, incompleto, caducado o con un producto distinto</strong> al
          que pediste, repórtalo dentro de las <strong>48 horas</strong> siguientes a la entrega. Envíanos fotos
          de:
        </p>
        <ul>
          <li>La caja tal como llegó y su guía de envío.</li>
          <li>El producto y el daño o la diferencia.</li>
          <li>El lote y la fecha de caducidad, si el problema es de calidad.</li>
        </ul>
        <p>
          En estos casos <strong>nosotros cubrimos todo el envío</strong> y tú eliges entre la reposición del
          producto o el reembolso. Si al recibir notas la caja abierta o dañada, anótalo con el repartidor o
          rechaza el paquete: eso agiliza el reclamo con la paquetería.
        </p>
      </SeccionLegal>

      <SeccionLegal id="abiertos" titulo="4. Productos abiertos" icono={Ban}>
        <p>
          Por seguridad sanitaria <strong>no aceptamos productos abiertos o con el sello roto</strong>: un
          suplemento abierto no puede volver a venderse sin riesgo para quien lo compre. Tampoco aplica si no te
          gustó el sabor o el resultado.
        </p>
        <p>La única excepción es un producto que llegó en mal estado o con defecto (punto 3).</p>
      </SeccionLegal>

      <SeccionLegal id="solicitar" titulo="5. Cómo pedirlo" icono={ClipboardList}>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Escribe a <strong>{contacto}</strong> con tu número de pedido (está en{' '}
            <Link to="/profile" className="text-brand-400 underline-offset-2 hover:underline">
              Mi cuenta → Mis pedidos
            </Link>
            ), el producto y el motivo. Si llegó mal, agrega las fotos.
          </li>
          <li>Te respondemos con las instrucciones y, si corresponde, con la guía para regresarlo.</li>
          <li>Al recibirlo lo revisamos en un máximo de 3 días hábiles y te confirmamos el resultado.</li>
          <li>Si procede, hacemos el reembolso o enviamos la reposición.</li>
        </ol>
        <p>No envíes nada de regreso sin antes escribirnos: un paquete sin aviso puede extraviarse.</p>
      </SeccionLegal>

      <SeccionLegal id="reembolsos" titulo="6. Reembolsos" icono={Banknote}>
        <ul>
          <li>
            <strong>Mercado Pago</strong> (tarjeta, SPEI u OXXO): lo devolvemos a través de Mercado Pago. En
            tarjeta, el tiempo en que se refleja depende de tu banco (normalmente de 5 a 10 días hábiles).
          </li>
          <li>
            <strong>Transferencia SPEI directa:</strong> lo transferimos a una cuenta a nombre de quien hizo la
            compra, dentro de los 5 días hábiles siguientes a que se apruebe.
          </li>
        </ul>
        <p>Nunca cobramos comisión por reembolsar.</p>
      </SeccionLegal>

      <SeccionLegal id="contacto" titulo="7. Contacto" icono={Mail}>
        <DatosResponsable legal={legal} soloContacto />
        <p className="flex items-start gap-2">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
          <span>
            Esta política no limita los derechos que te da la Ley Federal de Protección al Consumidor. Si no
            quedas conforme, puedes acudir a la PROFECO.
          </span>
        </p>
      </SeccionLegal>
    </DocumentoLegal>
  );
}
