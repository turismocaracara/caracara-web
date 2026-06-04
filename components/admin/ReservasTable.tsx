'use client';

import { useState, useMemo } from 'react';
import type { BookingRow } from '@/app/admin/reservas/page';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  reserved:        { label: 'Reservado',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending_payment: { label: 'Pago pend.', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  waiting_min:     { label: 'En espera',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed:       { label: 'Confirmada', cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:       { label: 'Cancelada',  cls: 'bg-red-50 text-red-600 border-red-200' },
  refunded:        { label: 'Devuelta',   cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtCLP(n: number | null) {
  if (!n) return '—';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

function whatsappUrl(phone: string, name: string, code: string, tour: string, date: string): string {
  // Dejar solo dígitos (wa.me no acepta el +)
  const digits = phone.replace(/\D/g, '');
  const dateStr = fmtDate(date);
  const msg = `Hola ${name} 👋, te escribimos de Turismo CaraCara sobre tu reserva *${code}* — *${tour}* el ${dateStr}. ¿Cómo podemos ayudarte?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

export default function ReservasTable({ initialBookings }: { initialBookings: BookingRow[] }) {
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter]   = useState('all');

  const bookings = useMemo(() => {
    let list = initialBookings;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.booking_code.toLowerCase().includes(q) ||
        (b.client_name  ?? '').toLowerCase().includes(q) ||
        (b.client_email ?? '').toLowerCase().includes(q) ||
        (b.client_phone ?? '').toLowerCase().includes(q) ||
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
          placeholder="Buscar por código, nombre, email, teléfono, tour..."
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
          <option value="reserved">Reservado</option>
          <option value="pending_payment">Pago pendiente</option>
          <option value="waiting_min">En espera mínimo</option>
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
          <table className="w-full text-sm min-w-[900px]">
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-24">Creada</th>
                <th className="w-10" />
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
                        {b.client_phone && (
                          <p className="text-gray-400 text-xs">{b.client_phone}</p>
                        )}
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
                  <td className="px-3 py-3">
                    {b.client_phone && (
                      <a
                        href={whatsappUrl(
                          b.client_phone,
                          b.client_name ?? 'cliente',
                          b.booking_code,
                          b.tour_slug,
                          b.tour_date,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`WhatsApp a ${b.client_name} (${b.client_phone})`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                      >
                        <WhatsAppIcon />
                      </a>
                    )}
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

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.529 5.855L.057 23.882a.5.5 0 0 0 .61.61l6.101-1.485A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.193-1.452l-.372-.22-3.862.94.972-3.768-.242-.387A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  );
}
