'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const BookingDetailModal = dynamic(() => import('./BookingDetailModal'), { ssr: false });

export interface RecentBookingRow {
  id:           string;
  booking_code: string;
  booking_type: string;
  pax:          number;
  status:       string;
  tour_name:    string;
  tour_date:    string;
  client_name:  string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  reserved:        { label: 'Reservado',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending_payment: { label: 'Pago pend.',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  waiting_min:     { label: 'En espera',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed:       { label: 'Confirmada',  cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:       { label: 'Cancelada',   cls: 'bg-red-50 text-red-600 border-red-200' },
  refunded:        { label: 'Devuelta',    cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function RecentBookingsTable({ bookings }: { bookings: RecentBookingRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Código</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Cliente</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Fecha tour</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Pax</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Estado</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b, i) => {
              const s = STATUS_LABEL[b.status] ?? { label: b.status, cls: 'bg-gray-50 text-gray-500 border-gray-200' };
              return (
                <tr key={b.id} className={`${i > 0 ? 'border-t border-gray-100' : ''} hover:bg-gray-50/50 transition-colors`}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(b.id)}
                      className="font-mono text-xs text-teal hover:underline font-semibold text-left"
                    >
                      {b.booking_code}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.client_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-800 max-w-[140px] truncate">{b.tour_name}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(b.tour_date)}</td>
                  <td className="px-4 py-3 text-center text-gray-800">{b.pax}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <BookingDetailModal
          bookingId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
