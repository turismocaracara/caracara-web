'use client';

import { useEffect, useState } from 'react';

interface HistoryEntry {
  booking_code: string;
  booking_type: string;
  status:       string;
  tour_name:    string;
  tour_date:    string;
  total_amount: number | null;
}

interface PasajeroDetail {
  id:             string;
  name:           string;
  id_type:        string | null;
  id_number:      string | null;
  email:          string | null;
  phone:          string | null;
  country:        string | null;
  birth_date:     string | null;
  is_lead:        boolean;
  pickup_address: string | null;
  hotel_name:     string | null;
  current_booking: {
    booking_code: string;
    booking_type: string;
    status:       string;
  } | null;
  history: HistoryEntry[];
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
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtCLP(n: number | null) {
  if (!n) return null;
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800">{value ?? <span className="text-gray-300">—</span>}</span>
    </div>
  );
}

export default function PasajeroDetailModal({
  passengerId,
  onClose,
}: {
  passengerId: string;
  onClose: () => void;
}) {
  const [data,    setData]    = useState<PasajeroDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/admin/passengers/${passengerId}`)
      .then(r => r.ok ? r.json() : r.json().then((b: { error?: string }) => Promise.reject(b.error ?? 'Error')))
      .then((d: PasajeroDetail) => setData(d))
      .catch((e: unknown) => setError(typeof e === 'string' ? e : 'Error al cargar el pasajero'))
      .finally(() => setLoading(false));
  }, [passengerId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-lg mx-4 my-6 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-48px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900 text-base">
              {loading ? 'Cargando…' : (data?.name ?? 'Pasajero')}
            </h2>
            {data?.is_lead && (
              <span className="text-[10px] font-semibold bg-teal/10 text-teal px-1.5 py-0.5 rounded-full">
                titular
              </span>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
          )}

          {data && (
            <>
              {/* Datos personales */}
              <section className="flex flex-col gap-2.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Datos personales</p>
                {(data.id_type || data.id_number) && (
                  <Row label="Documento"
                    value={`${ID_TYPE[data.id_type ?? ''] ?? data.id_type ?? ''} ${data.id_number ?? ''}`.trim()} />
                )}
                <Row label="Email"       value={data.email} />
                <Row label="Teléfono"    value={data.phone} />
                <Row label="País"        value={data.country} />
                <Row label="Nacimiento"  value={fmtBirth(data.birth_date)} />
              </section>

              {/* Detalles del viaje */}
              {(data.hotel_name || data.pickup_address) && (
                <section className="flex flex-col gap-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Detalles del viaje</p>
                  {data.hotel_name     && <Row label="Hospedaje"  value={data.hotel_name} />}
                  {data.pickup_address && <Row label="Pickup"     value={data.pickup_address} />}
                </section>
              )}

              {/* Reserva actual */}
              {data.current_booking && (
                <section className="flex flex-col gap-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Reserva actual</p>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <a
                      href={`/admin/reservas?q=${data.current_booking.booking_code}`}
                      onClick={e => e.stopPropagation()}
                      className="font-mono text-sm text-teal font-semibold hover:underline"
                    >
                      {data.current_booking.booking_code}
                    </a>
                    <span className="text-xs text-gray-400">
                      {data.current_booking.booking_type === 'private' ? 'Privado' : 'Grupal'}
                    </span>
                    {(() => {
                      const s = STATUS_LABEL[data.current_booking.status];
                      return s ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
                      ) : null;
                    })()}
                  </div>
                </section>
              )}

              {/* Historial de tours */}
              <section className="flex flex-col gap-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Historial de tours
                  {data.history.length > 0 && (
                    <span className="ml-2 normal-case font-normal text-gray-300">
                      {data.history.length} {data.history.length === 1 ? 'reserva' : 'reservas'}
                    </span>
                  )}
                </p>

                {data.history.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Sin historial registrado.</p>
                ) : (
                  <div className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    {data.history.map((h, i) => {
                      const s = STATUS_LABEL[h.status];
                      return (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 font-medium truncate">{h.tour_name}</p>
                            <p className="text-xs text-gray-400">{fmtDate(h.tour_date)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {fmtCLP(h.total_amount) && (
                              <span className="text-xs text-gray-500">{fmtCLP(h.total_amount)}</span>
                            )}
                            {s && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
                            )}
                            <a
                              href={`/admin/reservas?q=${h.booking_code}`}
                              onClick={e => e.stopPropagation()}
                              className="font-mono text-xs text-teal hover:underline whitespace-nowrap"
                            >
                              {h.booking_code}
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
