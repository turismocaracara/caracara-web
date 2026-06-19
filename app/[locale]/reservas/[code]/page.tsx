import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CancelBookingPanel from '@/components/CancelBookingPanel';
import { getRefundPercent, daysBeforeTour } from '@/lib/cancellation';

interface Props {
  params: { locale: string; code: string };
  searchParams: { status?: string; collection_status?: string; token?: string };
}

const LABELS = {
  es: {
    approved:      '¡Pago confirmado!',
    pending:       'Pago en proceso',
    rejected:      'Pago rechazado',
    approved_sub:  'Tu reserva está confirmada. Recibirás un email con todos los detalles.',
    pending_sub:   'Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
    rejected_sub:  'El pago no pudo completarse. Puedes intentarlo nuevamente.',
    code:          'Código de reserva',
    tour:          'Tour',
    date:          'Fecha',
    pax:           'Pasajeros',
    type:          'Modalidad',
    private:       'Tour privado',
    group:         'Tour grupal',
    back:          'Volver al inicio',
    retry:         'Intentar pago nuevamente',
    whatsapp:      'Coordinar por WhatsApp',
  },
  en: {
    approved:      'Payment confirmed!',
    pending:       'Payment in process',
    rejected:      'Payment rejected',
    approved_sub:  'Your booking is confirmed. You will receive an email with all the details.',
    pending_sub:   'Your payment is being processed. We will notify you once confirmed.',
    rejected_sub:  'The payment could not be completed. You can try again.',
    code:          'Booking code',
    tour:          'Tour',
    date:          'Date',
    pax:           'Passengers',
    type:          'Type',
    private:       'Private tour',
    group:         'Group tour',
    back:          'Back to home',
    retry:         'Try payment again',
    whatsapp:      'Coordinate via WhatsApp',
  },
  pt: {
    approved:      'Pagamento confirmado!',
    pending:       'Pagamento em processamento',
    rejected:      'Pagamento recusado',
    approved_sub:  'Sua reserva está confirmada. Você receberá um email com todos os detalhes.',
    pending_sub:   'Seu pagamento está sendo processado. Notificaremos quando confirmado.',
    rejected_sub:  'O pagamento não pôde ser concluído. Você pode tentar novamente.',
    code:          'Código da reserva',
    tour:          'Tour',
    date:          'Data',
    pax:           'Passageiros',
    type:          'Modalidade',
    private:       'Tour privado',
    group:         'Tour em grupo',
    back:          'Voltar ao início',
    retry:         'Tentar pagamento novamente',
    whatsapp:      'Coordenar pelo WhatsApp',
  },
};

function fmtDate(dateStr: string, locale: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(
    locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-CL',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );
}

export default async function ReservaPage({ params, searchParams }: Props) {
  const locale = (params.locale ?? 'es') as 'es' | 'en' | 'pt';
  const L = LABELS[locale] ?? LABELS.es;
  // MP agrega collection_status o status a la URL de retorno
  const status = searchParams.collection_status ?? searchParams.status ?? 'pending';

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      booking_code, booking_type, pax, status, mp_preference_id, cancellation_token, total_amount,
      tour_instances!inner ( date, tour_slug ),
      clients!inner ( name, email )
    `)
    .eq('booking_code', params.code.toUpperCase())
    .single();

  if (!booking) notFound();

  const instance = booking.tour_instances as unknown as { tour_slug: string; date: string };
  const tourSlug = instance.tour_slug;
  const tourDate = instance.date;

  const { data: tour } = await supabase
    .from('tours')
    .select('name_es, name_en, name_pt')
    .eq('slug', tourSlug)
    .single();

  const tourName = locale === 'en' ? tour?.name_en : locale === 'pt' ? tour?.name_pt : tour?.name_es;

  // El código de reserva es secuencial (CC-2026-0041) y por lo tanto adivinable —
  // sin verificar el token, cualquiera podría enumerar códigos y ver tour/fecha/pax
  // de reservas ajenas. Se exige el mismo token tanto para cancelar como para ver
  // el estado del pago (MercadoPago lo recibe en su URL de retorno).
  const tokenValid = Boolean(searchParams.token) && booking.cancellation_token === searchParams.token;

  if (!tokenValid) {
    return (
      <main className="min-h-screen bg-sand flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-ink font-semibold">
            {locale === 'en' ? 'We could not verify this booking. Check your confirmation email for the correct link.'
              : locale === 'pt' ? 'Não foi possível verificar esta reserva. Confira o link no seu email de confirmação.'
              : 'No pudimos verificar esta reserva. Revisa el link en tu email de confirmación.'}
          </p>
        </div>
      </main>
    );
  }

  // ─── Flujo de cancelación (link del email con ?token=, sin status de pago) ───
  if (!searchParams.status && !searchParams.collection_status) {
    const tourDateFmt = fmtDate(tourDate, locale);

    if (booking.status === 'cancelled') {
      return (
        <main className="min-h-screen bg-sand flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-ink font-semibold">
              {locale === 'en' ? 'This booking was already cancelled.'
                : locale === 'pt' ? 'Esta reserva já estava cancelada.'
                : 'Esta reserva ya estaba cancelada.'}
            </p>
          </div>
        </main>
      );
    }

    const daysBefore    = daysBeforeTour(tourDate);
    const refundPercent = await getRefundPercent(tourSlug, daysBefore);
    const totalAmount   = booking.total_amount ?? 0;
    const refundAmount  = Math.round(totalAmount * refundPercent / 100);

    return (
      <CancelBookingPanel
        bookingCode={booking.booking_code}
        token={searchParams.token!}
        tourName={tourName ?? tourSlug}
        tourDateFmt={tourDateFmt}
        refundPercent={refundPercent}
        refundAmount={refundAmount}
        locale={locale}
      />
    );
  }

  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

  const mpRetryUrl = booking.mp_preference_id
    ? `https://www.mercadopago.cl/checkout/v1/redirect?preference-id=${booking.mp_preference_id}`
    : null;

  const waText = encodeURIComponent(
    `Hola, tengo la reserva ${booking.booking_code} para el tour ${tourName} el ${tourDate} y necesito coordinar el pago.`
  );

  return (
    <main className="min-h-screen bg-sand flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Header de estado */}
        <div className={`px-6 py-8 text-center ${
          isApproved ? 'bg-teal/10' : isRejected ? 'bg-red-50' : 'bg-yellow-50'
        }`}>
          <div className="text-4xl mb-3">
            {isApproved ? '✅' : isRejected ? '❌' : '⏳'}
          </div>
          <h1 className="text-xl font-bold text-ink">
            {isApproved ? L.approved : isRejected ? L.rejected : L.pending}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {isApproved ? L.approved_sub : isRejected ? L.rejected_sub : L.pending_sub}
          </p>
        </div>

        {/* Detalles de la reserva */}
        <div className="px-6 py-5 flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{L.code}</span>
            <span className="font-mono font-semibold text-teal">{booking.booking_code}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{L.tour}</span>
            <span className="font-medium text-ink text-right max-w-[60%]">{tourName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{L.date}</span>
            <span className="font-medium text-ink">{fmtDate(tourDate, locale)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{L.pax}</span>
            <span className="font-medium text-ink">{booking.pax}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{L.type}</span>
            <span className="font-medium text-ink">
              {booking.booking_type === 'private' ? L.private : L.group}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          {isRejected && mpRetryUrl && (
            <a
              href={mpRetryUrl}
              className="w-full bg-teal text-white font-semibold py-3 rounded-xl text-center text-sm hover:bg-teal/90 transition-colors"
            >
              {L.retry}
            </a>
          )}
          {isRejected && (
            <a
              href={`https://wa.me/56991384957?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-green-500 text-white font-semibold py-3 rounded-xl text-center text-sm hover:bg-green-600 transition-colors"
            >
              {L.whatsapp}
            </a>
          )}
          <Link
            href={`/${locale}`}
            className="w-full border border-gray-200 text-gray-600 font-medium py-3 rounded-xl text-center text-sm hover:border-gray-300 transition-colors"
          >
            {L.back}
          </Link>
        </div>
      </div>
    </main>
  );
}
