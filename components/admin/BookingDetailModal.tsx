'use client';

import { useEffect, useState, useCallback } from 'react';

interface TourInfo {
  name_es: string;
  slug: string;
  duration_hours: number | null;
  has_picnic: boolean;
  category: string | null;
}

interface TourInstanceInfo {
  id: string;
  date: string;
  current_pax: number;
  max_pax: number;
  outsourced: boolean;
  guide_notes: string | null;
  tours: TourInfo | TourInfo[] | null;
  vans: { name: string; plate: string | null; capacity: number } | null;
}

interface PassengerInfo {
  id: string;
  name: string;
  id_type: string | null;
  id_number: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  birth_date: string | null;
  is_lead: boolean;
  pickup_type: string | null;
  pickup_address: string | null;
  hotel_name: string | null;
}

interface BookingDetail {
  id:                  string;
  booking_code:        string;
  booking_type:        string;
  pax:                 number;
  status:              string;
  price_per_person:    number | null;
  total_amount:        number | null;
  credit_applied:      number | null;
  amount_usd_approx:   number | null;
  fx_rate_at_booking:  number | null;
  display_currency:    string | null;
  locale:              string;
  tour_languages:      string[] | null;
  source:              string;
  agency_name:         string | null;
  groups_count:        number | null;
  internal_notes:      string | null;
  mp_payment_id:       string | null;
  created_at:          string;
  reserved_until:      string | null;
  cancelled_at:        string | null;
  cancellation_reason: string | null;
  cancellation_by:     string | null;
  refund_amount:       number | null;
  refund_status:       string | null;
  refund_processed_at: string | null;
  tour_instances: TourInstanceInfo | TourInstanceInfo[] | null;
  clients: { name: string; email: string; phone: string | null; country: string | null } | { name: string; email: string; phone: string | null; country: string | null }[] | null;
  passengers: PassengerInfo | PassengerInfo[];
  guides: { name: string; role: string }[];
  entered_by_member: { name: string; role: string } | null;
}

// ── Etiquetas ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  reserved:        { label: 'Reservado',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending_payment: { label: 'Pago pend.',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  waiting_min:     { label: 'En espera',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  confirmed:       { label: 'Confirmada',  cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled:       { label: 'Cancelada',   cls: 'bg-red-50 text-red-600 border-red-200' },
  refunded:        { label: 'Devuelta',    cls: 'bg-gray-50 text-gray-500 border-gray-200' },
};

const LOCALE_LABEL: Record<string, string>  = { es: 'Español', en: 'Inglés', pt: 'Portugués' };
const ID_TYPE:      Record<string, string>  = { rut: 'RUT', passport: 'Pasaporte' };

const SOURCE_LABEL: Record<string, { label: string; desc: string }> = {
  online:    { label: 'Web CaraCara',    desc: 'Reserva directa en el sitio web' },
  manual:    { label: 'Admin (manual)',  desc: 'Ingresada por el equipo interno' },
  whatsapp:  { label: 'WhatsApp',        desc: 'Coordinada por WhatsApp' },
};

const CATEGORY_LABEL: Record<string, string> = {
  cajon:      'Cajón del Maipo',
  valparaiso: 'Valparaíso',
  santiago:   'Santiago',
  vinedos:    'Viñedos',
  trekking:   'Trekking',
  aventura:   'Aventura',
};

const PICKUP_LABEL: Record<string, string> = {
  address:       'Dirección particular',
  meeting_point: 'Punto de encuentro',
  own_transport: 'Movilización propia',
};

const CANCEL_REASON: Record<string, string> = {
  client_request:  'Solicitud del cliente',
  min_not_reached: 'Mínimo no alcanzado',
  force_majeure:   'Fuerza mayor',
  payment_timeout: 'Pago no completado',
};

const CANCEL_BY: Record<string, string> = {
  client: 'Cliente',
  admin:  'Equipo interno',
  system: 'Sistema automático',
};

const REFUND_STATUS: Record<string, { label: string; cls: string }> = {
  pending_approval: { label: 'Pendiente de aprobación', cls: 'text-orange-600' },
  approved:         { label: 'Aprobada',                cls: 'text-blue-600' },
  processed:        { label: 'Procesada',               cls: 'text-green-600' },
  not_applicable:   { label: 'No aplica',               cls: 'text-gray-400' },
  credit_issued:    { label: 'Crédito emitido',         cls: 'text-purple-600' },
};

const ROLE_LABEL: Record<string, string> = {
  admin:  'Admin',
  guide:  'Guía',
  driver: 'Conductor',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCLP(n: number | null) {
  if (!n) return '—';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtBirth(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function many<T>(v: T | T[] | null | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// ── Componentes internos ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
      {children}
    </h3>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 flex-1">{children}</span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-gray-50 rounded-xl px-4 py-1">{children}</div>;
}

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {children}
    </span>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

export default function BookingDetailModal({
  bookingId,
  onClose,
}: {
  bookingId: string;
  onClose: () => void;
}) {
  const [data,    setData]    = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`/api/admin/bookings/${bookingId}`);
      const json = await res.json() as BookingDetail & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Error al cargar');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const inst       = data ? one(data.tour_instances) : null;
  const tour       = inst  ? one(inst.tours)         : null;
  const client     = data ? one(data.clients)        : null;
  const passengers = data ? many(data.passengers).sort((a, b) => (b.is_lead ? 1 : 0) - (a.is_lead ? 1 : 0)) : [];
  const guides          = data?.guides ?? [];
  const enteredByMember = data?.entered_by_member ?? null;
  const statusInfo = data ? (STATUS_LABEL[data.status] ?? { label: data.status, cls: 'bg-gray-50 text-gray-500 border-gray-200' }) : null;
  const isCancelled = data?.status === 'cancelled' || data?.status === 'refunded';
  const sourceInfo  = data ? (SOURCE_LABEL[data.source] ?? { label: data.source, desc: '' }) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 w-full max-w-xl mx-4 my-6 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-48px)]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono font-bold text-teal text-base">{data?.booking_code ?? '…'}</span>
            {statusInfo && <Badge cls={statusInfo.cls}>{statusInfo.label}</Badge>}
            {data && sourceInfo && (
              <Badge cls="bg-gray-50 text-gray-500 border-gray-200">{sourceInfo.label}</Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">

          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Cargando…
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
              <button onClick={load} className="ml-2 underline">Reintentar</button>
            </div>
          )}

          {data && !loading && (
            <>
              {/* ─── Tour ───────────────────────────────────────────── */}
              <section>
                <SectionTitle>Tour</SectionTitle>
                <Card>
                  <Row label="Nombre">{tour?.name_es ?? '—'}</Row>
                  <Row label="Fecha">{inst?.date ? fmtDate(inst.date) : '—'}</Row>
                  {tour?.duration_hours && (
                    <Row label="Duración">{tour.duration_hours} horas</Row>
                  )}
                  {tour?.category && (
                    <Row label="Categoría">{CATEGORY_LABEL[tour.category] ?? tour.category}</Row>
                  )}
                  <Row label="Modalidad">
                    <Badge cls={data.booking_type === 'private'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                    }>
                      {data.booking_type === 'private' ? 'Privado' : 'Grupal'}
                    </Badge>
                    {tour?.has_picnic && (
                      <Badge cls="ml-2 bg-green-50 text-green-700 border-green-200">🧺 Picnic incluido</Badge>
                    )}
                  </Row>
                  <Row label="Idioma(s)">
                    {(data.tour_languages ?? [data.locale]).map(l => LOCALE_LABEL[l] ?? l).join(', ')}
                  </Row>
                </Card>
              </section>

              {/* ─── Grupo / Operaciones ────────────────────────────── */}
              {inst && (
                <section>
                  <SectionTitle>Operaciones del grupo</SectionTitle>
                  <Card>
                    <Row label="Pax del grupo">
                      <span className="font-semibold">{inst.current_pax}</span>
                      <span className="text-gray-400 ml-1">/ {inst.max_pax} máx</span>
                      <span className="text-gray-400 ml-2">· esta reserva: {data.pax} pax</span>
                    </Row>
                    <Row label="Van asignada">
                      {inst.vans
                        ? <>
                            <span className="font-medium">{inst.vans.name}</span>
                            {inst.vans.plate && <span className="text-gray-400 ml-1">({inst.vans.plate})</span>}
                            <span className="text-gray-400 ml-2">· cap. {inst.vans.capacity}</span>
                          </>
                        : <span className="text-gray-400 italic">Sin asignar</span>
                      }
                    </Row>
                    <Row label="Guías / Conductores">
                      {guides.length > 0
                        ? <div className="flex flex-wrap gap-1">
                            {guides.map((g, i) => (
                              <span key={i} className="text-xs bg-teal/10 text-teal px-2 py-0.5 rounded-full font-medium">
                                {g.name}
                                {g.role && <span className="ml-1 opacity-60">· {ROLE_LABEL[g.role] ?? g.role}</span>}
                              </span>
                            ))}
                          </div>
                        : <span className="text-gray-400 italic">Sin asignar</span>
                      }
                    </Row>
                    <Row label="Operado por">
                      {inst.outsourced
                        ? <Badge cls="bg-amber-50 text-amber-700 border-amber-200">Tour externalizado</Badge>
                        : <span className="text-gray-700">CaraCara (propio)</span>
                      }
                    </Row>
                    {data.groups_count && data.groups_count > 1 && (
                      <Row label="Sub-grupos (agencia)">
                        {data.groups_count} grupos
                        {data.pax > 0 && (
                          <span className="text-gray-400 ml-2">
                            · ~{Math.round(data.pax / data.groups_count)} pax/grupo
                          </span>
                        )}
                      </Row>
                    )}
                    {inst.guide_notes && (
                      <Row label="Notas al guía">
                        <span className="text-gray-600 italic">{inst.guide_notes}</span>
                      </Row>
                    )}
                  </Card>
                </section>
              )}

              {/* ─── Cliente ─────────────────────────────────────────── */}
              <section>
                <SectionTitle>Cliente</SectionTitle>
                <Card>
                  <Row label="Nombre">{client?.name ?? '—'}</Row>
                  <Row label="Email">{client?.email ?? '—'}</Row>
                  {client?.phone   && <Row label="Teléfono">{client.phone}</Row>}
                  {client?.country && <Row label="País">{client.country}</Row>}
                </Card>
              </section>

              {/* ─── Pasajeros ───────────────────────────────────────── */}
              <section>
                <SectionTitle>Pasajeros ({passengers.length})</SectionTitle>
                <div className="flex flex-col gap-2">
                  {passengers.map(p => (
                    <div key={p.id} className="bg-gray-50 rounded-xl px-4 py-3">
                      {/* Nombre + badges */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-medium text-gray-800">{p.name}</span>
                        {p.is_lead && (
                          <Badge cls="bg-teal/10 text-teal border-teal/20">titular</Badge>
                        )}
                        {p.country && (
                          <span className="text-xs text-gray-400">{p.country}</span>
                        )}
                      </div>

                      {/* Documento + nacimiento */}
                      {(p.id_type || p.id_number) && (
                        <p className="text-xs text-gray-400">
                          {p.id_type ? (ID_TYPE[p.id_type] ?? p.id_type) : 'Doc'}: <span className="font-mono">{p.id_number ?? '—'}</span>
                          {p.birth_date && ` · Nac. ${fmtBirth(p.birth_date)}`}
                        </p>
                      )}

                      {/* Contacto */}
                      {(p.email || p.phone) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {p.email}{p.email && p.phone && ' · '}{p.phone}
                        </p>
                      )}

                      {/* Hospedaje */}
                      {p.hotel_name && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          <span className="text-gray-400">Hospedaje:</span> {p.hotel_name}
                        </p>
                      )}

                      {/* Pickup */}
                      {(p.pickup_address || p.pickup_type) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.pickup_type && !p.pickup_address && (
                            <span className="text-gray-500">{PICKUP_LABEL[p.pickup_type] ?? p.pickup_type}</span>
                          )}
                          {p.pickup_address && (
                            <><span className="text-gray-400">Pickup:</span> <span className="text-gray-600">{p.pickup_address}</span></>
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* ─── Pago / Comercial ────────────────────────────────── */}
              <section>
                <SectionTitle>Pago y canal de venta</SectionTitle>
                <Card>
                  {data.price_per_person && (
                    <Row label="Precio por pax">{fmtCLP(data.price_per_person)}</Row>
                  )}
                  <Row label="Total">{fmtCLP(data.total_amount)}</Row>
                  {(data.credit_applied ?? 0) > 0 && (
                    <Row label="Crédito aplicado">− {fmtCLP(data.credit_applied)}</Row>
                  )}
                  {data.display_currency && data.display_currency !== 'CLP' && (
                    <Row label="Moneda del cliente">
                      {data.display_currency}
                      {data.amount_usd_approx && ` · ~${data.amount_usd_approx} USD`}
                      {data.fx_rate_at_booking && (
                        <span className="text-gray-400 ml-2 text-xs">TC: {Number(data.fx_rate_at_booking).toFixed(2)}</span>
                      )}
                    </Row>
                  )}
                  <Row label="Origen">
                    {data.agency_name ? (
                      <>
                        <Badge cls="bg-amber-50 text-amber-700 border-amber-200">Agencia externa</Badge>
                        <span className="ml-2 font-semibold text-gray-800">{data.agency_name}</span>
                      </>
                    ) : (
                      <span className="text-gray-700">Tour propio CaraCara</span>
                    )}
                  </Row>
                  <Row label="Canal de entrada">
                    <span className="font-medium">{sourceInfo?.label ?? data.source}</span>
                    {sourceInfo?.desc && <span className="text-gray-400 ml-2 text-xs">· {sourceInfo.desc}</span>}
                  </Row>
                  {enteredByMember && (
                    <Row label="Ingresado por">
                      <span className="font-medium">{enteredByMember.name}</span>
                      <span className="text-gray-400 ml-1 text-xs">· {ROLE_LABEL[enteredByMember.role] ?? enteredByMember.role}</span>
                    </Row>
                  )}
                  {data.mp_payment_id && (
                    <Row label="ID MercadoPago">
                      <span className="font-mono text-xs">{data.mp_payment_id}</span>
                    </Row>
                  )}
                  {data.status === 'pending_payment' && data.reserved_until && (
                    <Row label="Reserva válida hasta">
                      <span className="text-orange-600 text-xs">{fmtDateTime(data.reserved_until)}</span>
                    </Row>
                  )}
                </Card>
              </section>

              {/* ─── Cancelación (solo si aplica) ────────────────────── */}
              {isCancelled && (
                <section>
                  <SectionTitle>Cancelación</SectionTitle>
                  <Card>
                    {data.cancellation_reason && (
                      <Row label="Motivo">{CANCEL_REASON[data.cancellation_reason] ?? data.cancellation_reason}</Row>
                    )}
                    {data.cancellation_by && (
                      <Row label="Cancelado por">{CANCEL_BY[data.cancellation_by] ?? data.cancellation_by}</Row>
                    )}
                    {data.cancelled_at && (
                      <Row label="Fecha">{fmtDateTime(data.cancelled_at)}</Row>
                    )}
                    {data.refund_amount != null && data.refund_amount > 0 && (
                      <Row label="Monto devuelto">{fmtCLP(data.refund_amount)}</Row>
                    )}
                    {data.refund_status && (
                      <Row label="Estado devolución">
                        <span className={`font-medium ${REFUND_STATUS[data.refund_status]?.cls ?? 'text-gray-500'}`}>
                          {REFUND_STATUS[data.refund_status]?.label ?? data.refund_status}
                        </span>
                        {data.refund_processed_at && (
                          <span className="text-gray-400 ml-2 text-xs">· {fmtDateTime(data.refund_processed_at)}</span>
                        )}
                      </Row>
                    )}
                  </Card>
                </section>
              )}

              {/* ─── Notas internas ──────────────────────────────────── */}
              {data.internal_notes && (
                <section>
                  <SectionTitle>Notas internas</SectionTitle>
                  <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-100 rounded-xl px-4 py-3 whitespace-pre-wrap">
                    {data.internal_notes}
                  </p>
                </section>
              )}

              <p className="text-xs text-gray-400 text-right">
                Creada el {fmtDateTime(data.created_at)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
