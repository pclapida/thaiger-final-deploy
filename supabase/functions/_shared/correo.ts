/**
 * Envío de correos con Resend (https://resend.com).
 * Secretos: RESEND_API_KEY, MAIL_FROM ("Thaiger <pedidos@tudominio.mx>").
 */

export interface Correo {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function enviarCorreo(apiKey: string, from: string, correo: Correo): Promise<{ id?: string }> {
  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: Array.isArray(correo.to) ? correo.to : [correo.to],
      subject: correo.subject,
      html: correo.html,
      ...(correo.replyTo ? { reply_to: correo.replyTo } : {}),
    }),
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(`Resend rechazó el correo (${respuesta.status}): ${datos?.message ?? 'sin detalle'}`);
  }
  return { id: datos?.id };
}
