'use client';

import { useState } from 'react';

interface Props {
  bookingCode:    string;
  token:          string;
  tourName:       string;
  tourDateFmt:    string;
  refundPercent:  number;
  refundAmount:   number;
  locale:         'es' | 'en' | 'pt';
}

const L = {
  es: {
    title:        'Cancelar reserva',
    summary:      (tour: string, date: string) => `Tour: ${tour} · Fecha: ${date}`,
    refundLine:   (pct: number, amount: string) => `Según nuestra política de cancelación, te corresponde un ${pct}% de devolución: ${amount}`,
    noRefund:     'Según nuestra política de cancelación, no corresponde devolución para esta fecha.',
    confirm:      'Confirmar cancelación',
    confirming:   'Cancelando…',
    warning:      'Esta acción no se puede deshacer.',
    successTitle: 'Reserva cancelada',
    successBody:  (amount: string) => amount !== '$0'
      ? `Tu reserva fue cancelada. Te contactaremos para coordinar la devolución de ${amount}.`
      : 'Tu reserva fue cancelada.',
    error:        'No se pudo procesar la cancelación',
  },
  en: {
    title:        'Cancel booking',
    summary:      (tour: string, date: string) => `Tour: ${tour} · Date: ${date}`,
    refundLine:   (pct: number, amount: string) => `Per our cancellation policy, you are entitled to a ${pct}% refund: ${amount}`,
    noRefund:     'Per our cancellation policy, no refund applies for this date.',
    confirm:      'Confirm cancellation',
    confirming:   'Cancelling…',
    warning:      'This action cannot be undone.',
    successTitle: 'Booking cancelled',
    successBody:  (amount: string) => amount !== '$0'
      ? `Your booking was cancelled. We will contact you to process the refund of ${amount}.`
      : 'Your booking was cancelled.',
    error:        'Could not process the cancellation',
  },
  pt: {
    title:        'Cancelar reserva',
    summary:      (tour: string, date: string) => `Tour: ${tour} · Data: ${date}`,
    refundLine:   (pct: number, amount: string) => `Conforme nossa política de cancelamento, você tem direito a ${pct}% de reembolso: ${amount}`,
    noRefund:     'Conforme nossa política de cancelamento, não há reembolso para esta data.',
    confirm:      'Confirmar cancelamento',
    confirming:   'Cancelando…',
    warning:      'Esta ação não pode ser desfeita.',
    successTitle: 'Reserva cancelada',
    successBody:  (amount: string) => amount !== '$0'
      ? `Sua reserva foi cancelada. Entraremos em contato para processar o reembolso de ${amount}.`
      : 'Sua reserva foi cancelada.',
    error:        'Não foi possível processar o cancelamento',
  },
};

function fmtCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

export default function CancelBookingPanel({
  bookingCode, token, tourName, tourDateFmt, refundPercent, refundAmount, locale,
}: Props) {
  const t = L[locale] ?? L.es;
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  async function confirmCancel() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cancel-booking', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ booking_code: bookingCode, token }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t.error);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen bg-sand flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center flex flex-col items-center gap-3">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-bold text-ink">{t.successTitle}</h1>
          <p className="text-sm text-gray-600">{t.successBody(fmtCLP(refundAmount))}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sand flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-red-50 px-6 py-8 text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold text-ink">{t.title}</h1>
          <p className="text-sm text-gray-600 mt-1">{t.summary(tourName, tourDateFmt)}</p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-3">
          <div className={`text-sm rounded-lg px-3 py-2.5 border ${refundPercent > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
            {refundPercent > 0 ? t.refundLine(refundPercent, fmtCLP(refundAmount)) : t.noRefund}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">{t.warning}</p>

          <button
            type="button"
            onClick={confirmCancel}
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {loading ? t.confirming : t.confirm}
          </button>
        </div>
      </div>
    </main>
  );
}
