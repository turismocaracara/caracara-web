'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocNumberInput, PhoneInput, parsePhone } from './PassengerFields';

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

interface EditForm {
  name:       string;
  id_type:    string;
  id_number:  string;
  email:      string;
  phone:      string;
  country:    string;
  birth_date: string;
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

const inputCls = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal w-full';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-gray-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800">{value ?? <span className="text-gray-300">—</span>}</span>
    </div>
  );
}

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[128px_1fr] items-center gap-3">
      <span className="text-xs text-gray-400">{label}</span>
      {children}
    </div>
  );
}

export default function PasajeroDetailModal({
  passengerId,
  canEdit = false,
  onClose,
}: {
  passengerId: string;
  canEdit?:    boolean;
  onClose:     () => void;
}) {
  const router                = useRouter();
  const [data,    setData]    = useState<PasajeroDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState<EditForm | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState('');

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
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { if (editing) cancelEdit(); else onClose(); } }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function startEdit() {
    if (!data) return;
    setForm({
      name:       data.name       ?? '',
      id_type:    data.id_type    ?? 'rut',
      id_number:  data.id_number  ?? '',
      email:      data.email      ?? '',
      phone:      data.phone      ?? '',
      country:    data.country    ?? '',
      birth_date: data.birth_date ?? '',
    });
    setSaveErr('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setForm(null);
    setSaveErr('');
  }

  async function saveEdit() {
    if (!form) return;
    setSaving(true);
    setSaveErr('');
    try {
      const res = await fetch(`/api/admin/passengers/${passengerId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:       form.name       || undefined,
          id_type:    form.id_type    || undefined,
          id_number:  form.id_number  || undefined,
          email:      form.email      || null,
          phone:      form.phone      || null,
          country:    form.country    || null,
          birth_date: form.birth_date || null,
        }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? 'Error al guardar');
      }
      const updated = await res.json() as PasajeroDetail;
      setData(updated);
      setEditing(false);
      setForm(null);
      router.refresh();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function set(field: keyof EditForm, value: string) {
    setForm(f => f ? { ...f, [field]: value } : f);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={editing ? undefined : onClose} aria-hidden="true" />

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
          <div className="flex items-center gap-2">
            {canEdit && data && !editing && (
              <button type="button" onClick={startEdit}
                className="text-xs font-medium text-teal border border-teal/30 bg-teal/5 hover:bg-teal/10 px-3 py-1.5 rounded-lg transition-colors">
                Editar
              </button>
            )}
            {!editing && (
              <button type="button" onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
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

          {/* ── Vista ───────────────────────────────────────────────── */}
          {data && !editing && (
            <>
              <section className="flex flex-col gap-2.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Datos personales</p>
                {(data.id_type || data.id_number) && (
                  <Row label="Documento"
                    value={`${ID_TYPE[data.id_type ?? ''] ?? data.id_type ?? ''} ${data.id_number ?? ''}`.trim()} />
                )}
                <Row label="Email"    value={data.email} />
                <Row label="Teléfono" value={
                  data.phone
                    ? (() => {
                        const p = parsePhone(data.phone);
                        return <span>{p.flag} {data.phone}</span>;
                      })()
                    : null
                } />
                <Row label="País"       value={data.country} />
                <Row label="Nacimiento" value={fmtBirth(data.birth_date)} />
              </section>

              {(data.hotel_name || data.pickup_address) && (
                <section className="flex flex-col gap-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Detalles del viaje</p>
                  {data.hotel_name     && <Row label="Hospedaje" value={data.hotel_name} />}
                  {data.pickup_address && <Row label="Pickup"    value={data.pickup_address} />}
                </section>
              )}

              {data.current_booking && (
                <section className="flex flex-col gap-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Reserva actual</p>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <a href={`/admin/reservas?q=${data.current_booking.booking_code}`}
                      onClick={e => e.stopPropagation()}
                      className="font-mono text-sm text-teal font-semibold hover:underline">
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
                            <a href={`/admin/reservas?q=${h.booking_code}`}
                              onClick={e => e.stopPropagation()}
                              className="font-mono text-xs text-teal hover:underline whitespace-nowrap">
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

          {/* ── Edición ─────────────────────────────────────────────── */}
          {data && editing && form && (
            <section className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Editar datos personales</p>

              <EditRow label="Nombre">
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  className={inputCls} placeholder="Nombre completo" />
              </EditRow>

              <EditRow label="Tipo documento">
                <select value={form.id_type} onChange={e => { set('id_type', e.target.value); set('id_number', ''); }} className={inputCls}>
                  <option value="">— Sin especificar —</option>
                  <option value="rut">RUT</option>
                  <option value="passport">Pasaporte</option>
                </select>
              </EditRow>

              <EditRow label="N° documento">
                <DocNumberInput
                  idType={(form.id_type as 'rut' | 'passport') || 'passport'}
                  value={form.id_number}
                  onChange={v => set('id_number', v)}
                  className={inputCls}
                />
              </EditRow>

              <EditRow label="Email">
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className={inputCls} placeholder="email@ejemplo.com" />
              </EditRow>

              <EditRow label="Teléfono">
                <PhoneInput
                  value={form.phone}
                  onChange={v => set('phone', v)}
                />
              </EditRow>

              <EditRow label="País">
                <input value={form.country} onChange={e => set('country', e.target.value)}
                  className={inputCls} placeholder="Chile" />
              </EditRow>

              <EditRow label="Nacimiento">
                <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)}
                  className={inputCls} />
              </EditRow>

              {saveErr && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveErr}</p>
              )}
            </section>
          )}
        </div>

        {/* Footer edit actions */}
        {editing && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button type="button" onClick={cancelEdit} disabled={saving}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-40 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={saveEdit} disabled={saving}
              className="text-sm font-semibold text-white bg-teal hover:bg-teal/90 disabled:opacity-50 px-5 py-2 rounded-lg transition-colors">
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
