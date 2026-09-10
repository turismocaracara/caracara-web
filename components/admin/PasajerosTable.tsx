'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { parsePhone } from './PassengerFields';

const PasajeroDetailModal = dynamic(() => import('./PasajeroDetailModal'), { ssr: false });

export interface PasajeroRow {
  id:         string;
  name:       string;
  id_type:    string;
  id_number:  string;
  email:      string | null;
  phone:      string | null;
  country:    string | null;
  birth_date: string | null;
  is_lead:    boolean;
}

const ID_TYPE: Record<string, string> = { rut: 'RUT', passport: 'Pasaporte' };

function fmtBirth(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function PasajerosTable({
  initialRows,
  canEdit = false,
}: {
  initialRows: PasajeroRow[];
  canEdit?:    boolean;
}) {
  const [search,     setSearch]     = useState('');
  const [onlyLead,   setOnlyLead]   = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = onlyLead ? initialRows.filter(r => r.is_lead) : initialRows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.id_number ?? '').toLowerCase().includes(q) ||
        (r.email     ?? '').toLowerCase().includes(q) ||
        (r.phone     ?? '').toLowerCase().includes(q) ||
        (r.country   ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [initialRows, search, onlyLead]);

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Buscar por nombre, documento, email, teléfono, país…"
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Documento</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Teléfono</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">País</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nacimiento</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`${i > 0 ? 'border-t border-gray-100' : ''} hover:bg-gray-50 transition-colors cursor-pointer`}
                  >
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
                      {r.id_number
                        ? <><span className="text-xs text-gray-400 mr-1">{ID_TYPE[r.id_type] ?? r.id_type}</span>{r.id_number}</>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {r.email || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {r.phone
                        ? (() => { const p = parsePhone(r.phone); return <span>{p.flag} {r.phone}</span>; })()
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {r.country || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtBirth(r.birth_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedId && (
        <PasajeroDetailModal
          passengerId={selectedId}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
