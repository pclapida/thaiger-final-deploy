import React from 'react';
import { Link } from 'react-router-dom';
import {
  Cookie,
  Database,
  FileText,
  Lock,
  Megaphone,
  RefreshCw,
  Scale,
  Share2,
  Target,
  UserCheck,
} from 'lucide-react';
import DocumentoLegal, { SeccionLegal } from '../components/legal/DocumentoLegal';
import DatosResponsable from '../components/legal/DatosResponsable';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSettings } from '../context/SettingsContext';
import { datosLegales } from '../lib/legal';

/**
 * Aviso de privacidad integral.
 *
 * Sigue la estructura que pide la Ley Federal de Protección de Datos Personales
 * en Posesión de los Particulares: identidad y domicilio del responsable, datos
 * que se tratan, finalidades (primarias y secundarias), transferencias, medios
 * para ejercer los derechos ARCO y revocar el consentimiento, uso de
 * tecnologías de rastreo y cómo se avisan los cambios.
 *
 * Los proveedores que se nombran son los que la tienda usa de verdad
 * (Supabase, Cloudflare, Mercado Pago, Resend, Skydropx). Si se cambia alguno,
 * hay que actualizar la sección 4. Conviene que lo revise un abogado.
 */

const SECCIONES = [
  { id: 'responsable', titulo: '1. Responsable' },
  { id: 'datos', titulo: '2. Datos que tratamos' },
  { id: 'finalidades', titulo: '3. Para qué los usamos' },
  { id: 'transferencias', titulo: '4. Con quién los compartimos' },
  { id: 'arco', titulo: '5. Derechos ARCO' },
  { id: 'limitar', titulo: '6. Limitar el uso' },
  { id: 'cookies', titulo: '7. Cookies y almacenamiento' },
  { id: 'seguridad', titulo: '8. Seguridad' },
  { id: 'cambios', titulo: '9. Cambios a este aviso' },
  { id: 'autoridad', titulo: '10. Autoridad' },
];

export default function Privacidad() {
  useDocumentTitle(
    'Aviso de Privacidad',
    'Cómo trata Thaiger Supplements tus datos personales y cómo ejercer tus derechos ARCO.'
  );

  const { settings } = useSettings();
  const legal = datosLegales(settings);
  const correo = legal.correo || 'el correo de contacto de la tienda';

  return (
    <DocumentoLegal
      titulo="Aviso de Privacidad"
      intro="Qué datos personales pedimos, para qué, con quién los compartimos y cómo puedes acceder a ellos, corregirlos, cancelarlos u oponerte a su uso."
      secciones={SECCIONES}
    >
      <SeccionLegal id="responsable" titulo="1. Responsable" icono={FileText}>
        <p>
          <strong>{legal.responsable}</strong>
          {legal.rfc && <> (RFC {legal.rfc})</>}
          {legal.responsable !== legal.nombreComercial && <>, que opera la tienda en línea {legal.nombreComercial},</>}{' '}
          es responsable del tratamiento de tus datos personales y de su protección.
        </p>
        <DatosResponsable legal={legal} />
      </SeccionLegal>

      <SeccionLegal id="datos" titulo="2. Datos que tratamos" icono={Database}>
        <ul>
          <li>
            <strong>Identificación y contacto:</strong> nombre, correo electrónico y teléfono.
          </li>
          <li>
            <strong>Entrega:</strong> domicilio, ciudad, estado y código postal.
          </li>
          <li>
            <strong>Cuenta:</strong> tu correo y tu contraseña (que se guarda cifrada: nadie puede leerla), foto
            de perfil si la subes, direcciones guardadas y favoritos.
          </li>
          <li>
            <strong>Compras:</strong> productos, montos, estatus, número de guía e historial de pedidos.
          </li>
          <li>
            <strong>Facturación</strong>, sólo si la pides: RFC, razón social, régimen y domicilio fiscal.
          </li>
          <li>
            <strong>Técnicos:</strong> dirección IP, tipo de navegador y registros de acceso que generan de forma
            automática nuestros proveedores de hospedaje, por seguridad.
          </li>
        </ul>
        <p>
          <strong>No recabamos datos sensibles</strong> (salud, origen, creencias, etc.).{' '}
          <strong>No recibimos los datos de tu tarjeta:</strong> cuando pagas con tarjeta los captura y procesa
          directamente Mercado Pago, bajo su propio aviso de privacidad.
        </p>
      </SeccionLegal>

      <SeccionLegal id="finalidades" titulo="3. Para qué los usamos" icono={Target}>
        <p>
          <strong>Finalidades necesarias</strong> para la relación que tienes con nosotros:
        </p>
        <ul>
          <li>Crear y administrar tu cuenta.</li>
          <li>Procesar tus pedidos, confirmar tus pagos y enviarte los productos.</li>
          <li>Avisarte por correo del estatus de tus pedidos y del número de guía.</li>
          <li>Atender dudas, aclaraciones, cancelaciones, devoluciones y garantías.</li>
          <li>Emitir tus facturas cuando las solicites.</li>
          <li>Prevenir fraudes y proteger la seguridad del sitio.</li>
          <li>Cumplir obligaciones legales, fiscales y requerimientos de autoridad.</li>
        </ul>
        <p>
          <strong>Finalidades adicionales</strong>, que no son necesarias para tu compra: enviarte promociones y
          novedades, y pedirte tu opinión sobre nuestro servicio. Si no quieres que usemos tus datos para esto,
          escríbenos a {correo} en cualquier momento; negarte no afecta tus compras.
        </p>
      </SeccionLegal>

      <SeccionLegal id="transferencias" titulo="4. Con quién los compartimos" icono={Share2}>
        <p>Compartimos sólo lo necesario con quienes nos ayudan a operar la tienda:</p>
        <ul>
          <li>
            <strong>Paqueterías</strong> (a través de Skydropx y la empresa de mensajería que se elija): nombre,
            teléfono y domicilio de entrega, para llevarte el pedido.
          </li>
          <li>
            <strong>Mercado Pago:</strong> el monto y la referencia de tu pedido, y tu correo, para procesar el
            pago.
          </li>
          <li>
            <strong>Proveedores de tecnología</strong> que guardan o procesan datos por nuestra cuenta y bajo
            nuestras instrucciones: Supabase (base de datos y cuentas), Cloudflare (hospedaje del sitio) y Resend
            (envío de correos). Algunos de sus servidores están fuera de México.
          </li>
          <li>
            <strong>Autoridades</strong>, cuando una ley o una orden fundada y motivada nos lo exija.
          </li>
        </ul>
        <p>
          Estas transferencias son necesarias para cumplir la compra que nos pides, así que no requieren tu
          consentimiento adicional. <strong>No vendemos ni rentamos tus datos</strong>, ni los compartimos con
          terceros para su publicidad.
        </p>
      </SeccionLegal>

      <SeccionLegal id="arco" titulo="5. Derechos ARCO" icono={UserCheck}>
        <p>
          Tienes derecho a <strong>Acceder</strong> a tus datos, <strong>Rectificarlos</strong> si son inexactos,{' '}
          <strong>Cancelarlos</strong> cuando ya no sean necesarios y <strong>Oponerte</strong> a su uso para
          fines específicos. También puedes <strong>revocar tu consentimiento</strong>.
        </p>
        <p>
          Muchos los ejerces tú mismo desde{' '}
          <Link to="/profile" className="text-brand-400 underline-offset-2 hover:underline">
            Mi cuenta
          </Link>{' '}
          (nombre, foto, direcciones). Para lo demás, escribe a <strong>{correo}</strong> con:
        </p>
        <ul>
          <li>Tu nombre y un correo para responderte.</li>
          <li>Una identificación oficial (o la de tu representante, con el documento que lo acredite).</li>
          <li>Qué derecho quieres ejercer y sobre qué datos.</li>
          <li>Cualquier documento que ayude a localizarlos (por ejemplo, tu número de pedido).</li>
        </ul>
        <p>
          Te responderemos en un máximo de <strong>20 días hábiles</strong> y, si procede, lo haremos efectivo
          dentro de los 15 días hábiles siguientes. Hay datos que debemos conservar por obligación legal (por
          ejemplo, los de facturas y operaciones) durante el plazo que marque la ley.
        </p>
      </SeccionLegal>

      <SeccionLegal id="limitar" titulo="6. Limitar el uso" icono={Megaphone}>
        <p>
          Para dejar de recibir promociones, escríbenos a {correo} o usa el enlace para darte de baja que viene
          en esos correos. Los avisos de tus pedidos seguirán llegando, porque son parte de tu compra.
        </p>
        <p>
          También puedes inscribirte en el Registro Público para Evitar Publicidad (REPEP) de la PROFECO.
        </p>
      </SeccionLegal>

      <SeccionLegal id="cookies" titulo="7. Cookies y almacenamiento" icono={Cookie}>
        <p>
          El sitio guarda en tu navegador (almacenamiento local) lo indispensable para funcionar: tu sesión, tu
          carrito, tus favoritos y tus preferencias. Sin eso no podrías iniciar sesión ni conservar tu carrito.
        </p>
        <p>
          <strong>No usamos cookies de publicidad ni herramientas de rastreo de terceros.</strong> Puedes borrar
          estos datos desde la configuración de tu navegador; al hacerlo se cierra tu sesión y se vacía tu
          carrito.
        </p>
      </SeccionLegal>

      <SeccionLegal id="seguridad" titulo="8. Seguridad" icono={Lock}>
        <ul>
          <li>Todo el sitio viaja cifrado (HTTPS).</li>
          <li>Las contraseñas se guardan cifradas con un algoritmo de un solo sentido.</li>
          <li>Cada cuenta sólo puede ver sus propios pedidos y datos; el acceso interno es por rol.</li>
          <li>Los pagos con tarjeta los procesa Mercado Pago; nunca pasan por nuestros servidores.</li>
        </ul>
      </SeccionLegal>

      <SeccionLegal id="cambios" titulo="9. Cambios a este aviso" icono={RefreshCw}>
        <p>
          Si cambiamos este aviso (por ejemplo, al sumar un proveedor o una finalidad), publicaremos la nueva
          versión en esta página con su fecha de actualización. Si el cambio requiere tu consentimiento, te lo
          pediremos.
        </p>
      </SeccionLegal>

      <SeccionLegal id="autoridad" titulo="10. Autoridad" icono={Scale}>
        <p>
          Si consideras que tus datos no se trataron conforme a la ley o que no atendimos tu solicitud, puedes
          acudir a la autoridad competente en materia de protección de datos personales.
        </p>
        <p>
          Al usar este sitio y darnos tus datos, reconoces haber leído este aviso de privacidad.
        </p>
      </SeccionLegal>
    </DocumentoLegal>
  );
}
