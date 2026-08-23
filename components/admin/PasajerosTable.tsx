'use client';

import { useState, useMemo } from 'react';

export interface PasajeroRow {
  id:             string;
  name:           string;
  id_type:        string;
  id_number:      string;
  email:          string | null;
  phone:          string | null;
  country:        string | null;
  birth_date:     string | null;
  is_lead:        boolean;
  booking_code:   string;
  booking_type:   string;
  booking_status: string;
  tour_name:      string;
  tour_date:      string;
}

const ID_TYPE: Record<string, string> = { rut: 'RUT', passport: 'Pasaporte' };

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

function fmtBirth(iso: string | null) {
  if (!iso) return '—';
  // Mostrar como dd/mm/yyyy
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function PasajerosTable({ initialRows }: { initialRows: PasajeroRow[] }) {
  const [search,    setSearch]    = useState('');
  const [onlyLead,  setOnlyLead]  = useState(false);

  const rows = useMemo(() => {
    let list = onlyLead ? initialRows.filter(r => r.is_lead) : initialRows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.id_number.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').toLowerCase().includes(q) ||
        r.booking_code.toLowerCase().includes(q) ||
        r.tour_name.toLowerCase().includes(q) ||
        (r.country ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [initialRows, search, onlyLead]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por nombre, documento, email, teléfono, tour…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal flex-1 min-w-64 bg-white"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyLead}
            onChange={e => setOnlyLead(e.target.checked)}
            className="rounded border-gray-300 text-teal focus:ring-teal/30"
          />
          Solo titulares
        </label>
        <span className="text-sm text-gray-400">
          {rows.length} pasajero{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">Sin resultados</p>
        ) : (
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Documento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">País</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nac.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Tour</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Fecha tour</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Reserva</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const s = STATUS_LABEL[r.booking_status];
                return (
                  <tr key={r.id} className={`${i > 0 ? 'border-t border-gray-100' : ''} hover:bg-gray-50/50 transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800 font-medium whitespace-nowrap">{r.name}</span>
                        {r.is_lead && (
                          <span className="text-[10px] font-semibold bg-teal/10 text-teal px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            titular
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className="text-xs text-gray-400 mr-1">{ID_TYPE[r.id_type] ?? r.id_type}</span>
                      {r.id_number}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {r.email || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {r.phone || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {r.country || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtBirth(r.birth_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={r.tour_name}>
                      {r.tour_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {fmtDate(r.tour_date)}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/admin/reservas?q=${r.booking_code}`}
                        className="font-mono text-xs text-teal hover:underline whitespace-nowrap"
                      >
                        {r.booking_code}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {s ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>
                          {s.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{r.booking_status}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
