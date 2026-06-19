import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { distributeGroups } from '@/lib/redistribution';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(req: NextRequest) {
  // Verificar que la llamada viene de Vercel Cron (o llamada manual con secret)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fecha de mañana (tours que operan el día siguiente)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tourDate = tomorrow.toISOString().split('T')[0];

  console.log(`[cron/group-confirmation] procesando tours del ${tourDate}`);

  // Obtener todos los tour+fecha grupales de mañana con instancias activas
  const { data: instances } = await supabase
    .from('tour_instances')
    .select('tour_slug')
    .eq('date', tourDate)
    .eq('booking_type', 'group')
    .in('status', ['forming', 'confirmed']);

  if (!instances || instances.length === 0) {
    console.log('[cron/group-confirmation] sin tours grupales para mañana');
    return NextResponse.json({ ok: true, processed: 0 });
  }

  // Deduplicar tours únicos para el día
  const uniqueTours = Array.from(new Set(instances.map(i => i.tour_slug)));

  const results: Record<string, unknown> = {};

  for (const tourSlug of uniqueTours) {
    // Aislado por tour: si uno falla (excepción o error de DB), los demás tours
    // del día deben seguir procesándose igual.
    try {
      const { data: tour } = await supabase
        .from('tours')
        .select('group_min_pax, name_es')
        .eq('slug', tourSlug)
        .single();

      const groupMinPax = tour?.group_min_pax ?? 4;
      const tourName   = tour?.name_es ?? tourSlug;

      const result = await distributeGroups(tourSlug, tourDate, groupMinPax);
      results[tourSlug] = result;

      if (!result.success && result.error === 'min_no_alcanzado') {
        // Mínimo no alcanzado → alerta a Cristóbal
        await notifyMinNotReached(tourSlug, tourName, tourDate, result.totalPax, groupMinPax);
      } else if (!result.success) {
        console.error(`[cron] ${tourSlug} ${tourDate}: error=${result.error}`);
        await notifySystemError(tourSlug, tourName, tourDate, result.error ?? 'desconocido');
      } else {
        console.log(`[cron] ${tourSlug} ${tourDate}: confirmado OK (${result.totalPax} pax, ${result.vans} van(s))`);
      }
    } catch (err) {
      console.error(`[cron] excepción procesando ${tourSlug} ${tourDate}:`, err);
      results[tourSlug] = { success: false, error: 'excepcion' };
      await notifySystemError(tourSlug, tourSlug, tourDate, 'excepción no controlada');
    }
  }

  return NextResponse.json({ ok: true, date: tourDate, results });
}

async function notifyMinNotReached(
  tourSlug: string,
  tourName: string,
  tourDate: string,
  totalPax: number,
  minPax: number,
) {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'turismocaracara@gmail.com';
  const fecha = new Date(tourDate + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  await resend.emails.send({
    from:    'CaraCara Sistema <sistema@turismocaracara.cl>',
    to:      adminEmail,
    subject: `⚠️ Tour sin mínimo — ${tourName} ${tourDate}`,
    html: `
      <h2>Tour grupal sin mínimo de pasajeros</h2>
      <p><strong>Tour:</strong> ${tourName} (<code>${tourSlug}</code>)</p>
      <p><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Pasajeros confirmados:</strong> ${totalPax} de ${minPax} mínimos requeridos</p>
      <p>Accede al panel de administración para activar el protocolo de alternativas.</p>
      <hr>
      <p style="color:#999;font-size:12px">Enviado automáticamente a las 20:00 del día anterior.</p>
    `,
  }).catch(err => console.error('[cron] email admin error:', err));
}

async function notifySystemError(
  tourSlug: string,
  tourName: string,
  tourDate: string,
  reason: string,
) {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'turismocaracara@gmail.com';

  await resend.emails.send({
    from:    'CaraCara Sistema <sistema@turismocaracara.cl>',
    to:      adminEmail,
    subject: `🔴 Error técnico al confirmar tour — ${tourName} ${tourDate}`,
    html: `
      <h2>Error técnico durante la confirmación automática</h2>
      <p><strong>Tour:</strong> ${tourName} (<code>${tourSlug}</code>)</p>
      <p><strong>Fecha:</strong> ${tourDate}</p>
      <p><strong>Motivo:</strong> ${reason}</p>
      <p>Este tour <strong>no pudo confirmarse automáticamente</strong> por un error del sistema (no por falta de pasajeros). Revisa manualmente las reservas de este tour/fecha en el panel de administración.</p>
      <hr>
      <p style="color:#999;font-size:12px">Enviado automáticamente a las 20:00 del día anterior.</p>
    `,
  }).catch(err => console.error('[cron] email admin error:', err));
}
