'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BookingCalendar from '@/components/BookingCalendar';
import AgencyRegistrationModal, { type Agency } from './AgencyRegistrationModal';

export interface AdminTourOption {
  slug:           string;
  name_es:        string;
  has_picnic:     boolean;
  duration_hours: number | null;
}

interface PassengerData {
  name:           string;
  id_type:        'rut' | 'passport';
  id_number:      string;
  email:          string;
  phone:          string;
  country:        string;
  birth_date:     string;
  pickup_address: string;
  hotel_name:     string;
}

function emptyPassenger(): PassengerData {
  return { name:'', id_type:'passport', id_number:'', email:'', phone:'', country:'', birth_date:'', pickup_address:'', hotel_name:'' };
}

const TOUR_LANGUAGES: { code: 'es'|'en'|'pt'; label: string }[] = [
  { code:'es', label:'Español' },
  { code:'en', label:'Inglés'  },
  { code:'pt', label:'Portugués' },
];

const PAYMENT_STATUS  = [{ v:'pending', l:'Pendiente' }, { v:'partial', l:'Parcial' }, { v:'paid', l:'Pagado' }] as const;
const PAYMENT_METHODS = [
  { v:'cash',        l:'Efectivo'      },
  { v:'transfer',    l:'Transferencia' },
  { v:'deposit',     l:'Depósito'      },
  { v:'mercadopago', l:'MercadoPago'   },
  { v:'invoice',     l:'Factura'       },
  { v:'other',       l:'Otro'          },
] as const;

const inputClass  = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full';
const selectClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full bg-white';

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({ n, title, subtitle }: { n: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-1">
      <span className="mt-0.5 w-6 h-6 rounded-full bg-teal text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
        {n}
      </span>
      <div>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label:string; required?:boolean; hint?:string; children:React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-orange ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function Counter({ value, onChange, min=1, max=18 }: { value:number; onChange:(n:number)=>void; min?:number; max?:number }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(value-1)} disabled={value<=min}
        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center font-semibold hover:border-teal hover:text-teal transition-colors disabled:opacity-30">−</button>
      <span className="text-base font-semibold w-6 text-center">{value}</span>
      <button type="button" onClick={() => onChange(value+1)} disabled={value>=max}
        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center font-semibold hover:border-teal hover:text-teal transition-colors disabled:opacity-30">+</button>
    </div>
  );
}

function Toggle({ value, onChange }: { value:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${value ? 'bg-teal' : 'bg-gray-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ── Selector de tour con dropdown propio ──────────────────────────────────────

function TourSearchDropdown({
  tours, selected, onSelect, onQuickCreate, creating,
}: {
  tours:          AdminTourOption[];
  selected:       AdminTourOption | null;
  onSelect:       (t: AdminTourOption) => void;
  onQuickCreate:  (name: string)       => void;
  creating:       boolean;
}) {
  const [query,    setQuery]    = useState(selected?.name_es ?? '');
  const [open,     setOpen]     = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);

  // Sincronizar si selected cambia desde fuera (e.g. quick-create)
  useEffect(() => { setQuery(selected?.name_es ?? ''); }, [selected]);

  // Cerrar al click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim().length === 0
    ? tours
    : tours.filter(t => t.name_es.toLowerCase().includes(query.toLowerCase()));

  const exactMatch  = tours.find(t => t.name_es.toLowerCase() === query.trim().toLowerCase());
  const canCreate   = query.trim().length >= 2 && !exactMatch;

  function handleSelect(t: AdminTourOption) {
    onSelect(t);
    setQuery(t.name_es);
    setOpen(false);
  }

  function handleCreate() {
    onQuickCreate(query.trim());
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onSelect(null as unknown as AdminTourOption); }}
          placeholder="Buscar tour…"
          className="border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-teal w-full"
        />
        {selected && (
          <button type="button" onClick={() => { setQuery(''); onSelect(null as unknown as AdminTourOption); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 && !canCreate && (
            <p className="text-xs text-gray-400 px-4 py-3">Sin resultados.</p>
          )}
          {filtered.map(t => (
            <button key={t.slug} type="button" onMouseDown={() => handleSelect(t)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-teal/5 transition-colors ${
                selected?.slug === t.slug ? 'bg-teal/5 font-medium text-teal' : 'text-gray-700'
              }`}>
              {selected?.slug === t.slug && (
                <svg className="w-3.5 h-3.5 text-teal flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>{t.name_es}</span>
              {t.has_picnic && <span className="ml-auto text-[10px] text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">picnic</span>}
            </button>
          ))}
          {canCreate && (
            <button type="button" onMouseDown={handleCreate} disabled={creating}
              className="w-full text-left px-4 py-2.5 text-sm text-teal font-medium flex items-center gap-2 border-t border-gray-100 hover:bg-teal/5 transition-colors disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {creating ? 'Creando…' : `Crear "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Formulario principal ──────────────────────────────────────────────────────

export default function ManualBookingForm({
  tours: initialTours,
  agencies: initialAgencies = [],
  onSuccess,
}: {
  tours:      AdminTourOption[];
  agencies?:  Agency[];
  onSuccess?: (result: { code: string; status: string }) => void;
}) {
  const router = useRouter();

  // ── Sección 1: Tour ───────────────────────────────────────────────────────
  const [isAgency,        setIsAgency]        = useState(false);
  const [agencyName,      setAgencyName]      = useState('');
  const [agencyId,        setAgencyId]        = useState<string | null>(null);
  const [agencyList,      setAgencyList]      = useState<Agency[]>(initialAgencies);
  const [showAgencyModal, setShowAgencyModal] = useState(false);

  const [selectedTour,  setSelectedTour]  = useState<AdminTourOption | null>(null);
  const [tourList,      setTourList]      = useState<AdminTourOption[]>(initialTours);
  const [creatingTour,  setCreatingTour]  = useState(false);

  const [bookingType,    setBookingType]    = useState<'private'|'group'>('private');
  const [tourDate,       setTourDate]       = useState('');
  const [availableSpots, setAvailableSpots] = useState(18);
  const [pax,            setPax]            = useState(1);
  const [groupsCount,    setGroupsCount]    = useState(1);

  // Picnic + duración (después del pax)
  const [hasPicnic,       setHasPicnic]       = useState(false);
  const [showPicnicNotes, setShowPicnicNotes] = useState(false);
  const [picnicNotes,     setPicnicNotes]     = useState('');
  const [durationHours,   setDurationHours]   = useState('');

  // ── Sección 2: Pasajeros ──────────────────────────────────────────────────
  const [passengers,    setPassengers]    = useState<PassengerData[]>([emptyPassenger()]);
  const [tourLanguages, setTourLanguages] = useState<('es'|'en'|'pt')[]>(['es']);

  // ── Sección 3: Operaciones (opcional) ────────────────────────────────────
  const [outsourced,  setOutsourced]  = useState(false);
  const [guideNotes,  setGuideNotes]  = useState('');

  // ── Sección 4: Cobranza ───────────────────────────────────────────────────
  const [totalAmount,   setTotalAmount]   = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState('');
  const [amountPaid,     setAmountPaid]     = useState('');
  const [receiptRef,     setReceiptRef]     = useState('');
  const [billingNotes,   setBillingNotes]   = useState('');

  // ── UI ────────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState<{ code:string; status:string } | null>(null);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const tourSlug       = selectedTour?.slug ?? '';
  const pricePerPerson = totalAmount && pax > 0 ? Math.round(Number(totalAmount) / pax) : null;

  const matchedAgency    = isAgency && agencyName.trim().length >= 2
    ? agencyList.find(a => a.fantasy_name.toLowerCase() === agencyName.trim().toLowerCase())
    : undefined;
  const canRegisterAgency = isAgency && agencyName.trim().length >= 2 && !matchedAgency;

  // ── Handlers: origen ─────────────────────────────────────────────────────

  function handleOriginChange(agency: boolean) {
    setIsAgency(agency);
    if (!agency) { setAgencyName(''); setAgencyId(null); }
    setGroupsCount(1);
    if (agency) {
      setPassengers(prev => [prev[0] ?? emptyPassenger()]);
    } else {
      setPassengers(prev => {
        const lead = prev[0] ?? emptyPassenger();
        return pax <= 1 ? [lead] : [lead, ...Array.from({ length: pax-1 }, emptyPassenger)];
      });
    }
  }

  function handleAgencyNameChange(value: string) {
    setAgencyName(value);
    const match = agencyList.find(a => a.fantasy_name.toLowerCase() === value.trim().toLowerCase());
    setAgencyId(match?.id ?? null);
  }

  function handleAgencySaved(agency: Agency) {
    setAgencyList(prev => [...prev, agency]);
    setAgencyName(agency.fantasy_name);
    setAgencyId(agency.id);
    setShowAgencyModal(false);
  }

  // ── Handlers: tour ────────────────────────────────────────────────────────

  function handleTourSelect(t: AdminTourOption | null) {
    setSelectedTour(t);
    if (t) {
      setHasPicnic(t.has_picnic);
      setDurationHours(t.duration_hours != null ? String(t.duration_hours) : '');
    }
  }

  async function handleQuickCreateTour(name: string) {
    setCreatingTour(true);
    setError('');
    try {
      const res  = await fetch('/api/admin/tours/quick-create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name_es: name }),
      });
      const data = await res.json() as AdminTourOption & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al crear el tour');
      const sorted = [...tourList, data].sort((a, b) => a.name_es.localeCompare(b.name_es, 'es'));
      setTourList(sorted);
      handleTourSelect(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear tour');
    } finally {
      setCreatingTour(false);
    }
  }

  // ── Handlers: fecha / pax ─────────────────────────────────────────────────

  function handleDateSelect(date: string, status: 'available'|'forming'|'full'|'blocked'|'past', spots: number) {
    setTourDate(date);
    setAvailableSpots(spots > 0 ? spots : 18);
    if (status === 'forming') setBookingType('group');
    setPax(prev => Math.min(prev, spots > 0 ? spots : 18));
  }

  function handlePaxChange(n: number) {
    const newPax = Math.max(1, Math.min(18, n));
    setPax(newPax);
    setGroupsCount(prev => Math.min(prev, newPax));
    if (!isAgency) {
      setPassengers(prev => {
        if (prev.length === newPax) return prev;
        if (prev.length < newPax) return [...prev, ...Array.from({ length: newPax-prev.length }, emptyPassenger)];
        return prev.slice(0, newPax);
      });
    }
  }

  function handleGroupsCountChange(n: number) {
    const newCount = Math.max(1, Math.min(pax, n));
    setGroupsCount(newCount);
    setPassengers(prev => {
      if (prev.length === newCount) return prev;
      if (prev.length < newCount) return [...prev, ...Array.from({ length: newCount-prev.length }, emptyPassenger)];
      return prev.slice(0, newCount);
    });
  }

  // ── Handlers: pasajeros ───────────────────────────────────────────────────

  function toggleTourLanguage(code: 'es'|'en'|'pt') {
    setTourLanguages(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }

  function updatePassenger(i: number, field: keyof PassengerData, value: string) {
    setPassengers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  const paxExceedsSpots = tourDate !== '' && pax > availableSpots;

  // ── Validación ────────────────────────────────────────────────────────────

  function formValid(): boolean {
    if (!selectedTour || !tourDate || paxExceedsSpots) return false;
    if (isAgency && agencyName.trim().length < 2) return false;
    if (isAgency) {
      for (const p of passengers) {
        if (p.name.trim().length < 2 || p.phone.trim().length < 6 || p.pickup_address.trim().length < 3) return false;
      }
    } else {
      const lead = passengers[0];
      if (!lead || lead.name.trim().length < 2 || lead.id_number.trim().length < 3) return false;
      if (!lead.email.includes('@') || lead.phone.trim().length < 6 || lead.country.trim().length < 2) return false;
      for (let i = 1; i < passengers.length; i++) {
        const p = passengers[i];
        const hasAny = p.name.trim() || p.id_number.trim();
        if (hasAny && (p.name.trim().length < 2 || p.id_number.trim().length < 3)) return false;
      }
    }
    return true;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setLoading(true); setError('');
    try {
      let passengersPayload;
      if (isAgency) {
        passengersPayload = passengers.map((p, i) => ({
          name: p.name, phone: p.phone || undefined,
          pickup_address: p.pickup_address || undefined, hotel_name: p.hotel_name || undefined,
          id_type: p.id_type || undefined, id_number: p.id_number || undefined,
          email: p.email || undefined, country: p.country || undefined, is_lead: i === 0,
        }));
      } else {
        passengersPayload = passengers
          .map((p, i) => i === 0
            ? { name:p.name, id_type:p.id_type, id_number:p.id_number, email:p.email, phone:p.phone, country:p.country,
                birth_date:p.birth_date||undefined, pickup_address:p.pickup_address||undefined, hotel_name:p.hotel_name||undefined, is_lead:true }
            : { name:p.name, id_type:p.id_type||undefined, id_number:p.id_number||undefined,
                pickup_address:p.pickup_address||undefined, hotel_name:p.hotel_name||undefined, is_lead:false }
          )
          .filter((p, i) => i === 0 || (p.name as string).trim().length >= 2);
      }

      const res = await fetch('/api/admin/manual-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tour_slug:      tourSlug,
          tour_date:      tourDate,
          booking_type:   bookingType,
          pax,
          passengers:     passengersPayload,
          tour_languages: tourLanguages,
          locale:         'es',
          agency_name:    isAgency && agencyName.trim() ? agencyName.trim() : undefined,
          agency_id:      agencyId ?? undefined,
          groups_count:   isAgency && bookingType==='group' ? groupsCount : undefined,
          has_picnic:     hasPicnic,
          duration_hours: durationHours ? Number(durationHours) : undefined,
          picnic_notes:   picnicNotes || undefined,
          guide_notes:    guideNotes  || undefined,
          outsourced:     outsourced  || undefined,
          total_amount:     totalAmount ? Number(totalAmount) : undefined,
          price_per_person: pricePerPerson ?? undefined,
          payment_status:   paymentStatus   || undefined,
          payment_method:   paymentMethod   || undefined,
          amount_paid:      amountPaid      ? Number(amountPaid)      : undefined,
          receipt_ref:      receiptRef      || undefined,
          billing_notes:    billingNotes    || undefined,
        }),
      });

      const body = await res.json().catch(() => ({})) as { booking_code?:string; status?:string; error?:string };
      if (!res.ok) throw new Error(body.error ?? 'Error al crear la reserva');
      const result = { code: body.booking_code!, status: body.status! };
      if (onSuccess) { onSuccess(result); } else { setSuccess(result); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="bg-teal/5 border border-teal/20 rounded-2xl p-8 text-center flex flex-col items-center gap-4 max-w-md">
        <div className="w-16 h-16 bg-teal/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-bold text-teal">{success.code}</p>
          <p className="font-semibold text-gray-800 mt-1">
            {success.status === 'confirmed' ? 'Reserva confirmada' : 'Reserva en espera de mínimo'}
          </p>
        </div>
        <p className="text-sm text-gray-500">Se envió un email de confirmación al cliente.</p>
        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.push('/admin/reservas')}
            className="bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 transition-colors">
            Ver reservas
          </button>
          <button type="button" onClick={() => window.location.reload()}
            className="border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:border-gray-300 transition-colors">
            Crear otra
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-5 max-w-3xl">

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 1 — Información del tour
        ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-5">
          <SectionHeader n={1} title="Información del tour" />

          {/* Origen */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Origen</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value:false, label:'Tour propio CaraCara', desc:'Cliente directo — web, WhatsApp, teléfono' },
                { value:true,  label:'De otra agencia',      desc:'Grupo enviado por agencia o tour operador' },
              ] as const).map(opt => (
                <button key={String(opt.value)} type="button" onClick={() => handleOriginChange(opt.value)}
                  className={`flex flex-col gap-0.5 text-left border-2 rounded-xl px-4 py-3 transition-all ${
                    isAgency === opt.value ? 'border-teal bg-teal/5 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <span className={`text-xs font-semibold ${isAgency===opt.value ? 'text-teal' : 'text-gray-600'}`}>{opt.label}</span>
                  <span className="text-[11px] text-gray-400">{opt.desc}</span>
                </button>
              ))}
            </div>

            {isAgency && (
              <div className="flex flex-col gap-2">
                <Field label="Nombre de la agencia" required>
                  <input list="agency-suggestions" value={agencyName} onChange={e => handleAgencyNameChange(e.target.value)}
                    placeholder="Escribe o selecciona una agencia…" className={`${inputClass} max-w-sm`} />
                  <datalist id="agency-suggestions">
                    {agencyList.map(a => <option key={a.id} value={a.fantasy_name} />)}
                  </datalist>
                </Field>
                {matchedAgency && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 max-w-sm">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Registrada · <span className="font-medium">{matchedAgency.razon_social}</span></span>
                  </div>
                )}
                {canRegisterAgency && (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-sm">
                    <p className="text-xs text-amber-700 flex-1">
                      <span className="font-semibold">&ldquo;{agencyName}&rdquo;</span> no está registrada.
                    </p>
                    <button type="button" onClick={() => setShowAgencyModal(true)}
                      className="text-xs font-semibold text-teal hover:underline whitespace-nowrap">
                      Registrar agencia
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Tour + Modalidad */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Tour</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Tour" required>
                <TourSearchDropdown
                  tours={tourList}
                  selected={selectedTour}
                  onSelect={t => handleTourSelect(t ?? null)}
                  onQuickCreate={handleQuickCreateTour}
                  creating={creatingTour}
                />
              </Field>
              <Field label="Modalidad" required>
                <div className="grid grid-cols-2 gap-2">
                  {(['private','group'] as const).map(type => (
                    <button key={type} type="button" onClick={() => setBookingType(type)}
                      className={`border-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                        bookingType===type ? 'border-teal bg-teal/5 text-teal' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {type==='private' ? 'Privado' : 'Grupal'}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Fecha */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Fecha</p>
            <div className="border border-gray-200 rounded-xl p-3 max-w-sm">
              <BookingCalendar tourSlug={tourSlug} bookingType={bookingType} selected={tourDate} onSelect={handleDateSelect} locale="es" />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Pax + Grupos */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Capacidad</p>
            <div className="flex items-start gap-10 flex-wrap">
              <Field label="N° de pasajeros" required>
                <Counter value={pax} onChange={handlePaxChange} min={1} max={availableSpots>0 ? Math.min(availableSpots,18) : 18} />
              </Field>
              {isAgency && bookingType==='group' && (
                <Field label="Grupos" hint="Sub-grupos de esta agencia">
                  <Counter value={groupsCount} onChange={handleGroupsCountChange} min={1} max={pax} />
                </Field>
              )}
            </div>
            {paxExceedsSpots && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Solo quedan {availableSpots} cupo(s) para este día.
              </p>
            )}
          </div>

          {/* Picnic + Duración — DESPUÉS del pax */}
          {selectedTour && (
            <>
              <hr className="border-gray-100" />
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Detalles del tour</p>
                <div className="flex flex-col gap-3">
                  {/* Picnic */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-28 flex-shrink-0">¿Incluye picnic?</span>
                      <Toggle value={hasPicnic} onChange={setHasPicnic} />
                      <span className={`text-xs font-medium ${hasPicnic ? 'text-teal' : 'text-gray-400'}`}>
                        {hasPicnic ? 'Sí' : 'No'}
                      </span>
                      <button type="button" onClick={() => setShowPicnicNotes(p => !p)}
                        className="ml-auto text-[11px] text-teal hover:underline font-medium">
                        {showPicnicNotes ? '− Ocultar detalles' : '+ Agregar detalles'}
                      </button>
                    </div>
                    {showPicnicNotes && (
                      <textarea value={picnicNotes} onChange={e => setPicnicNotes(e.target.value)} rows={2}
                        placeholder="Menú, restricciones dietéticas, notas al guía…"
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
                    )}
                  </div>
                  {/* Duración */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-medium text-gray-600 w-28 flex-shrink-0">Duración</span>
                    <input type="number" min={0.5} max={24} step={0.5} value={durationHours}
                      onChange={e => setDurationHours(e.target.value)} placeholder="horas"
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-24" />
                    {selectedTour.duration_hours != null && !durationHours && (
                      <span className="text-xs text-gray-400">
                        Último: {selectedTour.duration_hours}h
                        <button type="button" className="ml-1 text-teal hover:underline"
                          onClick={() => setDurationHours(String(selectedTour.duration_hours))}>usar</button>
                      </span>
                    )}
                    {durationHours && <span className="text-xs text-gray-400">Se actualizará el tour.</span>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 2 — Pasajeros
        ════════════════════════════════════════════════════════════════════ */}
        {isAgency ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
            <SectionHeader
              n={2}
              title={passengers.length === 1 ? 'Titular del grupo' : `Titulares de los ${passengers.length} grupos`}
              subtitle="Nombre, teléfono y pickup obligatorios."
            />

            {passengers.map((p, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
                {passengers.length > 1 && (
                  <p className="text-xs font-semibold text-teal">
                    Grupo {i+1}{i===0 && <span className="ml-1 font-normal text-gray-400">· contacto principal</span>}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nombre completo" required>
                    <input value={p.name} onChange={e => updatePassenger(i,'name',e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Teléfono" required>
                    <input type="tel" value={p.phone} onChange={e => updatePassenger(i,'phone',e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <Field label="Dirección de pickup" required hint="Punto de recogida del grupo">
                  <input value={p.pickup_address} onChange={e => updatePassenger(i,'pickup_address',e.target.value)}
                    placeholder="Hotel Austral, Av. O'Higgins 1234" className={inputClass} />
                </Field>
                <details className="group">
                  <summary className="text-[11px] font-medium text-gray-400 cursor-pointer hover:text-gray-600 select-none list-none flex items-center gap-1">
                    <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Datos adicionales opcionales
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <Field label="Hospedaje">
                      <input value={p.hotel_name} onChange={e => updatePassenger(i,'hotel_name',e.target.value)}
                        placeholder="Hotel Austral" className={inputClass} />
                    </Field>
                    <Field label="Email">
                      <input type="email" value={p.email} onChange={e => updatePassenger(i,'email',e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Tipo de documento">
                      <select value={p.id_type} onChange={e => updatePassenger(i,'id_type',e.target.value as 'rut'|'passport')} className={selectClass}>
                        <option value="passport">Pasaporte</option>
                        <option value="rut">RUT</option>
                      </select>
                    </Field>
                    <Field label="N° de documento">
                      <input value={p.id_number} onChange={e => updatePassenger(i,'id_number',e.target.value)} className={inputClass} />
                    </Field>
                    <Field label="País de origen">
                      <input value={p.country} onChange={e => updatePassenger(i,'country',e.target.value)} className={inputClass} />
                    </Field>
                  </div>
                </details>
              </div>
            ))}

            <Field label="Idioma(s) del tour">
              <div className="flex gap-2 flex-wrap">
                {TOUR_LANGUAGES.map(lang => (
                  <button key={lang.code} type="button" onClick={() => toggleTourLanguage(lang.code)}
                    className={`border-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      tourLanguages.includes(lang.code) ? 'border-teal bg-teal/5 text-teal' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>{lang.label}</button>
                ))}
              </div>
            </Field>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
            <SectionHeader n={2} title="Pasajeros" />
            {passengers.map((p, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-teal">
                    {i===0 ? 'Titular (contacto principal)' : `Pasajero ${i+1}`}
                  </p>
                  {i > 0 && <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">opcional</span>}
                </div>
                {i > 0 && <p className="text-xs text-gray-400 -mt-2">Déjalo en blanco si no tienes el dato aún.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nombre completo" required={i===0}>
                    <input value={p.name} onChange={e => updatePassenger(i,'name',e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Tipo de documento" required={i===0}>
                    <select value={p.id_type} onChange={e => updatePassenger(i,'id_type',e.target.value as 'rut'|'passport')} className={selectClass}>
                      <option value="passport">Pasaporte</option><option value="rut">RUT</option>
                    </select>
                  </Field>
                  <Field label="N° de documento" required={i===0}>
                    <input value={p.id_number} onChange={e => updatePassenger(i,'id_number',e.target.value)} className={inputClass} />
                  </Field>
                  {i===0 && (
                    <>
                      <Field label="País de origen" required>
                        <input value={p.country} onChange={e => updatePassenger(i,'country',e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Fecha de nacimiento" required>
                        <input type="date" value={p.birth_date} onChange={e => updatePassenger(i,'birth_date',e.target.value)}
                          max={new Date().toISOString().slice(0,10)} className={inputClass} />
                      </Field>
                      <Field label="Email" required>
                        <input type="email" value={p.email} onChange={e => updatePassenger(i,'email',e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Teléfono" required>
                        <input type="tel" value={p.phone} onChange={e => updatePassenger(i,'phone',e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Dirección de pickup">
                        <input value={p.pickup_address} onChange={e => updatePassenger(i,'pickup_address',e.target.value)}
                          placeholder="Hotel Austral, Av. O'Higgins 1234" className={inputClass} />
                      </Field>
                      <Field label="Hospedaje">
                        <input value={p.hotel_name} onChange={e => updatePassenger(i,'hotel_name',e.target.value)} className={inputClass} />
                      </Field>
                    </>
                  )}
                </div>
                {i===0 && (
                  <Field label="Idioma(s) del tour">
                    <div className="flex gap-2 flex-wrap">
                      {TOUR_LANGUAGES.map(lang => (
                        <button key={lang.code} type="button" onClick={() => toggleTourLanguage(lang.code)}
                          className={`border-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            tourLanguages.includes(lang.code) ? 'border-teal bg-teal/5 text-teal' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}>{lang.label}</button>
                      ))}
                    </div>
                  </Field>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 3 — Operaciones (opcional)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
          <SectionHeader n={3} title="Operaciones" subtitle="Guía, van y externalización — se puede completar después." />

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 w-32 flex-shrink-0">¿Tour externalizado?</span>
            <Toggle value={outsourced} onChange={setOutsourced} />
            <span className={`text-xs font-medium ${outsourced ? 'text-orange' : 'text-gray-400'}`}>
              {outsourced ? 'Sí — operado por otro proveedor' : 'No'}
            </span>
          </div>

          <Field label="Notas al guía / conductor">
            <textarea rows={2} value={guideNotes} onChange={e => setGuideNotes(e.target.value)}
              placeholder="Instrucciones de ruta, necesidades especiales, puntos de pickup en orden…"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
          </Field>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            SECCIÓN 4 — Cobranza
        ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
          <SectionHeader n={4} title="Cobranza" />

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <Field label="Total cobrado (CLP)">
              <input type="number" min={0} value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
                placeholder="Ej: 180000" className={inputClass} />
            </Field>
            {pricePerPerson !== null && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600">Por persona</span>
                <div className="flex items-center h-[38px] px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-teal">
                  ${pricePerPerson.toLocaleString('es-CL')}
                </div>
                <p className="text-[11px] text-gray-400">{pax} pax</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Estado del pago */}
            <Field label="Estado del pago">
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_STATUS.map(s => (
                  <button key={s.v} type="button" onClick={() => setPaymentStatus(prev => prev===s.v ? '' : s.v)}
                    className={`border-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors text-center ${
                      paymentStatus===s.v
                        ? s.v==='paid' ? 'border-green-400 bg-green-50 text-green-700'
                        : s.v==='partial' ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-gray-400 bg-gray-50 text-gray-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>{s.l}</button>
                ))}
              </div>
            </Field>

            {/* Monto pagado (solo si parcial) */}
            {paymentStatus === 'partial' && (
              <Field label="Monto pagado (CLP)">
                <input type="number" min={0} value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                  placeholder="Ej: 90000" className={inputClass} />
              </Field>
            )}
          </div>

          {/* Forma de pago */}
          <Field label="Forma de pago">
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map(m => (
                <button key={m.v} type="button" onClick={() => setPaymentMethod(prev => prev===m.v ? '' : m.v)}
                  className={`border-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    paymentMethod===m.v ? 'border-teal bg-teal/5 text-teal' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>{m.l}</button>
              ))}
            </div>
          </Field>

          <Field label="N° de comprobante / referencia">
            <input value={receiptRef} onChange={e => setReceiptRef(e.target.value)}
              placeholder="Ej: 000345678 (transferencia), recibo N°12, etc."
              className={`${inputClass} max-w-sm`} />
          </Field>

          <Field label="Notas de cobranza">
            <textarea rows={2} value={billingNotes} onChange={e => setBillingNotes(e.target.value)}
              placeholder="Cuotas, acuerdos especiales, pendiente de factura, etc."
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
          </Field>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button type="button" disabled={!formValid() || loading} onClick={handleSubmit}
          className="self-start bg-teal text-white font-semibold px-6 py-3 rounded-xl hover:bg-teal/90 disabled:opacity-50 transition-colors">
          {loading ? 'Creando reserva…' : 'Crear reserva'}
        </button>
      </div>

      {showAgencyModal && (
        <AgencyRegistrationModal
          initialName={agencyName}
          onClose={() => setShowAgencyModal(false)}
          onSaved={handleAgencySaved}
        />
      )}
    </>
  );
}
