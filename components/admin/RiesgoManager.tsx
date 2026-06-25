'use client';

import { useState } from 'react';

export interface RiskBookingRow {
  booking_id:   string;
  pax:          number;
  client_name:  string;
  client_email: string;
  client_phone: string | null;
}

export interface RiskGroupRow {
  instance_id: string;
  tour_slug:   string;
  tour_name:   string;
  date:        string;
  min_pax:     number;
  bookings:    RiskBookingRow[];
}

export interface TourOption {
  slug:    string;
  name_es: string;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function buildWaMessage(clientName: string, tourName: string, dateStr: string): string {
  const fecha = fmtDate(dateStr);
  return `Hola ${clientName}, somos Turismo CaraCara 🦅\n\nTu tour "${tourName}" del ${fecha} aún no alcanza el mínimo de pasajeros para confirmarse.\n\nQueremos ofrecerte alternativas:\n1️⃣ Cambiar a otra fecha disponible\n2️⃣ Crédito 100% para cualquier tour futuro\n3️⃣ Tour alternativo similar\n4️⃣ Devolución\n\n¿Cuál prefieres? Respóndenos por este chat.`;
}

type PanelMode = null | 'date' | 'tour';

// ── Fila de una reserva en riesgo, con sus 4 acciones ───────────────────────
function BookingRow({
  booking, tourName, date, tours, isResolved, isLoading, onAction,
}: {
  booking:    RiskBookingRow;
  tourName:   string;
  date:       string;
  tours:      TourOption[];
  isResolved: boolean;
  isLoading:  boolean;
  onAction: (action: 'credit' | 'refund' | 'reschedule', extra?: { newTourSlug?: string; newDate: string }) => void;
}) {
  const [panel,       setPanel]       = useState<PanelMode>(null);
  const [newDate,     setNewDate]     = useState('');
  const [newTourSlug, setNewTourSlug] = useState('');

  const phone  = (booking.client_phone ?? '').replace(/\D/g, '');
  const waText = encodeURIComponent(buildWaMessage(booking.client_name, tourName, date));

  function submitPanel() {
    if (!newDate) return;
    onAction('reschedule', { newTourSlug: panel === 'tour' ? newTourSlug : undefined, newDate });
    setPanel(null);
  }

  return (
    <div
      className={`flex flex-col gap-2 border rounded-lg px-3 py-2.5 transition-opacity ${
        isResolved ? 'opacity-40 bg-gray-50 border-gray-100' : 'bg-amber-50/40 border-amber-100'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{booking.client_name} · {booking.pax} pax</p>
          <p className="text-xs text-gray-400 truncate">
            {booking.client_email}{booking.client_phone && ` · ${booking.client_phone}`}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
          <a
            href={`https://wa.me/${phone}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap"
          >
            WhatsApp
          </a>
          <button
            type="button"
            disabled={isResolved || isLoading}
            onClick={() => setPanel(p => p === 'date' ? null : 'date')}
            className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            Cambiar fecha
          </button>
          <button
            type="button"
            disabled={isResolved || isLoading}
            onClick={() => setPanel(p => p === 'tour' ? null : 'tour')}
            className="text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1.5 rounded-lg hover:bg-purple-100 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            Tour alternativo
          </button>
          <button
            type="button"
            disabled={isResolved || isLoading}
            onClick={() => onAction('credit')}
            className="text-xs font-medium bg-orange/10 text-orange-700 border border-orange/20 px-2.5 py-1.5 rounded-lg hover:bg-orange/20 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {isResolved ? 'Resuelto ✓' : isLoading ? '…' : 'Crédito 100%'}
          </button>
          <button
            type="button"
            disabled={isResolved || isLoading}
            onClick={() => onAction('refund')}
            className="text-xs font-medium bg-red-50 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            Devolución
          </button>
        </div>
      </div>

      {panel && !isResolved && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2.5">
          {panel === 'tour' && (
            <select
              value={newTourSlug}
              onChange={e => setNewTourSlug(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal bg-white"
            >
              <option value="">— Elegir tour —</option>
              {tours.map(t => (
                <option key={t.slug} value={t.slug}>{t.name_es}</option>
              ))}
            </select>
          )}
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-teal"
          />
          <button
            type="button"
            disabled={!newDate || (panel === 'tour' && !newTourSlug) || isLoading}
            onClick={submitPanel}
            className="text-xs font-semibold bg-teal text-white px-3 py-1.5 rounded-lg hover:bg-teal/90 disabled:opacity-40 transition-colors"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

export default function RiesgoManager({ groups, tours }: { groups: RiskGroupRow[]; tours: TourOption[] }) {
  const [resolved, setResolved]   = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError]         = useState('');

  async function handleAction(
    bookingId: string,
    action: 'credit' | 'refund' | 'reschedule',
    extra?: { newTourSlug?: string; newDate: string }
  ) {
    const labels = { credit: 'emitir crédito 100%', refund: 'iniciar devolución', reschedule: 'reagendar' };
    if (!confirm(`¿Confirmas ${labels[action]} para esta reserva? Esta acción no se puede deshacer.`)) return;

    setLoadingId(bookingId);
    setError('');
    try {
      const res = action === 'reschedule'
        ? await fetch('/api/admin/reschedule-booking', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ booking_id: bookingId, new_tour_slug: extra?.newTourSlug, new_date: extra?.newDate }),
          })
        : await fetch('/api/admin/resolve-risk', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ booking_id: bookingId, action }),
          });

      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? 'Error'); return; }
      setResolved(prev => new Set(prev).add(bookingId));
    } finally {
      setLoadingId(null);
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center bg-white rounded-xl border border-gray-100">
        Sin tours grupales en riesgo — todos alcanzaron el mínimo o aún no llega su fecha de corte.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {groups.map(g => {
        const activePax = g.bookings.reduce((s, b) => s + (resolved.has(b.booking_id) ? 0 : b.pax), 0);
        return (
          <div key={g.instance_id} className="bg-white rounded-xl border border-amber-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{g.tour_name}</h3>
                <p className="text-xs text-gray-500 capitalize">{fmtDate(g.date)}</p>
              </div>
              <span className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full whitespace-nowrap">
                {activePax} / {g.min_pax} pax mínimo
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {g.bookings.map(b => (
                <BookingRow
                  key={b.booking_id}
                  booking={b}
                  tourName={g.tour_name}
                  date={g.date}
                  tours={tours.filter(t => t.slug !== g.tour_slug)}
                  isResolved={resolved.has(b.booking_id)}
                  isLoading={loadingId === b.booking_id}
                  onAction={(action, extra) => handleAction(b.booking_id, action, extra)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
