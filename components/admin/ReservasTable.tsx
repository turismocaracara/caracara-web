'use client';

import { useState, useMemo } from 'react';
import type { BookingRow } from '@/app/admin/reservas/page';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'Pendiente',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  waiting_min: { label: 'En espera', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed:   { label: 'Confirmada',cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:   { label: 'Cancelada', cls: 'bg-red-50 text-red-600 border-red-200' },
  refunded:    { label: 'Devuelta',  cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtCLP(n: number | null) {
  if (!n) return '—';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

export default function ReservasTable({ initialBookings }: { initialBookings: BookingRow[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const bookings = useMemo(() => {
    let list = initialBookings;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.booking_code.toLowerCase().includes(q) ||
        (b.client_name  ?? '').toLowerCase().includes(q) ||
        (b.client_email ?? '').toLowerCase().includes(q) ||
        b.tour_slug.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter);
    if (typeFilter   !== 'all') list = list.filter(b => b.booking_type === typeFilter);
    return list;
  }, [initialBookings, search, statusFilter, typeFilter]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Buscar por código, nombre, email, tour..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal flex-1 min-w-52 bg-white"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="waiting_min">En espera</option>
          <option value="confirmed">Confirmada</option>
          <option value="cancelled">Cancelada</option>
          <option value="refunded">Devuelta</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        >
          <option value="all">Privado y grupal</option>
          <option value="private">Privado</option>
          <option value="group">Grupal</option>
        </select>
        <span className="self-center text-sm text-gray-400">
          {bookings.length} resultado{bookings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">Sin resultados</p>
        ) : (
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-28">Código</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tour</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-28">Fecha tour</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-20">Tipo</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 w-12">Pax</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 w-28">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-28">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-28">Creada</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, i) => (
                <tr key={b.id} className={`${i > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50/50 transition-colors`}>
                  <td className="px-4 py-3 font-mono text-xs text-teal font-semibold">{b.booking_code}</td>
                  <td className="px-4 py-3">
                    {b.client_name ? (
                      <div>
                        <p className="text-gray-800 font-medium">{b.client_name}</p>
                        <p className="text-gray-400 text-xs">{b.client_email}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={b.tour_slug}>
                    {b.tour_slug}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(b.tour_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      b.booking_type === 'private'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {b.booking_type === 'private' ? 'Privado' : 'Grupal'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-800 font-semibold">{b.pax}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium whitespace-nowrap">
                    {fmtCLP(b.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(b.created_at).toLocaleString('es-CL', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: 'bg-gray-50 text-gray-500 border-gray-200' };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}
