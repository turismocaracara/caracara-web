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
  tour_name:   string;
  date:        string;
  min_pax:     number;
  bookings:    RiskBookingRow[];
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

export default function RiesgoManager({ groups }: { groups: RiskGroupRow[] }) {
  const [resolved, setResolved]   = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError]         = useState('');

  async function issueCredit(bookingId: string) {
    if (!confirm('¿Emitir crédito 100% y cancelar esta reserva? Esta acción no se puede deshacer.')) return;
    setLoadingId(bookingId);
    setError('');
    try {
      const res = await fetch('/api/admin/resolve-risk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ booking_id: bookingId }),
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
              {g.bookings.map(b => {
                const isResolved = resolved.has(b.booking_id);
                const phone      = (b.client_phone ?? '').replace(/\D/g, '');
                const waText     = encodeURIComponent(buildWaMessage(b.client_name, g.tour_name, g.date));
                return (
                  <div
                    key={b.booking_id}
                    className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2.5 transition-opacity ${
                      isResolved ? 'opacity-40 bg-gray-50 border-gray-100' : 'bg-amber-50/40 border-amber-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{b.client_name} · {b.pax} pax</p>
                      <p className="text-xs text-gray-400 truncate">
                        {b.client_email}{b.client_phone && ` · ${b.client_phone}`}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a
                        href={`https://wa.me/${phone}?text=${waText}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap"
                      >
                        WhatsApp
                      </a>
                      <button
                        type="button"
                        disabled={isResolved || loadingId === b.booking_id}
                        onClick={() => issueCredit(b.booking_id)}
                        className="text-xs font-medium bg-orange/10 text-orange-700 border border-orange/20 px-3 py-1.5 rounded-lg hover:bg-orange/20 disabled:opacity-40 transition-colors whitespace-nowrap"
                      >
                        {isResolved ? 'Crédito emitido ✓' : loadingId === b.booking_id ? '…' : 'Emitir crédito 100%'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
