'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BookingCalendar from '@/components/BookingCalendar';
import AgencyRegistrationModal, { type Agency } from './AgencyRegistrationModal';
import ServiceProviderModal, { type ServiceProvider } from './ServiceProviderModal';
import {
  formatRut, validateRut, DocNumberInput,
  DIAL_CODES, parsePhone, PhoneInput,
} from './PassengerFields';

interface ClientMatch {
  id:         string;
  name:       string;
  email:      string | null;
  phone:      string | null;
  country:    string | null;
  id_type:    'rut' | 'passport' | null;
  id_number:  string | null;
  birth_date: string | null;
}

function PassengerLookup({ onSelect }: { onSelect: (c: ClientMatch) => void }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<ClientMatch[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.length < 3) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/clients/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json() as ClientMatch[];
          setResults(data);
          setOpen(data.length > 0);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    search(val);
  }

  function handleSelect(c: ClientMatch) {
    onSelect(c);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar por nombre, RUT o email…"
          className="border border-dashed border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-teal w-full bg-gray-50 placeholder:text-gray-400"
        />
        {loading && (
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {results.map(c => (
            <button key={c.id} type="button" onMouseDown={() => handleSelect(c)}
              className="w-full text-left px-3 py-2.5 hover:bg-teal/5 transition-colors border-b border-gray-50 last:border-0">
              <p className="text-xs font-semibold text-gray-800">{c.name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {[c.email, c.id_number, c.phone].filter(Boolean).join(' · ')}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface GuideOption { id: string; name: string; role: string; }
export interface VanOption   { id: string; name: string; plate: string | null; capacity: number; }

interface TourStop {
  key:          string;
  name:         string;
  arrival_time: string;
  duration_min: string;
  notes:        string;
}

const CC_ROLE_BUTTONS = [
  { key: 'guide',        label: 'Guía'           },
  { key: 'driver',       label: 'Chofer'         },
  { key: 'guide_driver', label: 'Guía-Conductor' },
  { key: 'van',          label: 'Van'            },
] as const;

function resizeArr(arr: string[], n: number): string[] {
  if (n > arr.length) return [...arr, ...Array<string>(n - arr.length).fill('')];
  return arr.slice(0, n);
}

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

// ─────────────────────────────────────────────────────────────────────────────
// RUT chileno: formato y validación de dígito verificador
// ─────────────────────────────────────────────────────────────────────────────


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

const STEP_LABELS = ['Tour', 'Pasajeros', 'Operaciones', 'Detalles', 'Cobranza'];

const inputClass  = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full';
const selectClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full bg-white';

// ─────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-6">
      {STEP_LABELS.map((label, i) => {
        const n      = i + 1;
        const done   = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                done   ? 'bg-teal text-white' :
                active ? 'bg-teal text-white ring-4 ring-teal/20' :
                         'bg-gray-100 text-gray-400'
              }`}>
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : n}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block whitespace-nowrap transition-colors ${
                active ? 'text-teal' : done ? 'text-gray-500' : 'text-gray-300'
              }`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-colors ${done ? 'bg-teal' : 'bg-gray-100'}`} />
            )}
          </div>
        );
      })}
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

// ─────────────────────────────────────────────────────────────────────────────
// Dropdown de tour
// ─────────────────────────────────────────────────────────────────────────────

function TourSearchDropdown({
  tours, selected, onSelect, onQuickCreate, creating,
}: {
  tours:         AdminTourOption[];
  selected:      AdminTourOption | null;
  onSelect:      (t: AdminTourOption | null) => void;
  onQuickCreate: (name: string) => void;
  creating:      boolean;
}) {
  const [query,  setQuery]  = useState(selected?.name_es ?? '');
  const [open,   setOpen]   = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(selected?.name_es ?? ''); }, [selected]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered  = query.trim().length === 0
    ? tours
    : tours.filter(t => t.name_es.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = tours.find(t => t.name_es.toLowerCase() === query.trim().toLowerCase());
  const canCreate  = query.trim().length >= 2 && !exactMatch;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input value={query} onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onSelect(null); }}
          placeholder="Buscar tour…"
          className="border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-teal w-full" />
        {selected && (
          <button type="button" onClick={() => { setQuery(''); onSelect(null); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 && !canCreate && <p className="text-xs text-gray-400 px-4 py-3">Sin resultados.</p>}
          {filtered.map(t => (
            <button key={t.slug} type="button" onMouseDown={() => { onSelect(t); setQuery(t.name_es); setOpen(false); }}
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
            <button type="button" onMouseDown={() => { onQuickCreate(query.trim()); setOpen(false); }} disabled={creating}
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

// ─────────────────────────────────────────────────────────────────────────────
// Formulario principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ManualBookingForm({
  tours: initialTours,
  agencies: initialAgencies = [],
  guides = [],
  vans = [],
  serviceProviders: initialProviders = [],
  onSuccess,
}: {
  tours:             AdminTourOption[];
  agencies?:         Agency[];
  guides?:           GuideOption[];
  vans?:             VanOption[];
  serviceProviders?: ServiceProvider[];
  onSuccess?: (result: { code: string; status: string }) => void;
}) {
  const router = useRouter();

  // ── Paso actual ───────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── Paso 1: Tour ──────────────────────────────────────────────────────────
  const [isAgency,        setIsAgency]        = useState(false);
  const [agencyName,      setAgencyName]      = useState('');
  const [agencyId,        setAgencyId]        = useState<string | null>(null);
  const [agencyList,      setAgencyList]      = useState<Agency[]>(initialAgencies);
  const [showAgencyModal, setShowAgencyModal] = useState(false);

  const [selectedTour, setSelectedTour] = useState<AdminTourOption | null>(null);
  const [tourList,     setTourList]     = useState<AdminTourOption[]>(initialTours);
  const [creatingTour, setCreatingTour] = useState(false);

  const [bookingType,    setBookingType]    = useState<'private'|'group'>('private');
  const [tourDate,       setTourDate]       = useState('');
  const [availableSpots, setAvailableSpots] = useState(18);
  const [pax,            setPax]            = useState(1);
  const [groupsCount,    setGroupsCount]    = useState(1);

  const [hasPicnic,       setHasPicnic]       = useState(false);
  const [showPicnicNotes, setShowPicnicNotes] = useState(false);
  const [picnicNotes,     setPicnicNotes]     = useState('');
  const [durationHours,   setDurationHours]   = useState('');

  // ── Paso 2: Pasajeros ─────────────────────────────────────────────────────
  const [passengers,    setPassengers]    = useState<PassengerData[]>([emptyPassenger()]);
  const [tourLanguages, setTourLanguages] = useState<('es'|'en'|'pt')[]>(['es']);

  // ── Paso 3: Operaciones — CaraCara ────────────────────────────────────────
  const [ccRoles,       setCcRoles]       = useState<Set<string>>(new Set());
  const [ccGuide,       setCcGuide]       = useState({ members: [''] as string[], fees: [''] as string[] });
  const [ccDriver,      setCcDriver]      = useState({ members: [''] as string[], fees: [''] as string[] });
  const [ccGuideDriver, setCcGuideDriver] = useState({ members: [''] as string[], fees: [''] as string[] });
  const [ccVan,         setCcVan]         = useState({ vanIds: [''] as string[] });
  // ── Paso 3: Operaciones — Externalizado ───────────────────────────────────
  const [extRoles,       setExtRoles]       = useState<Set<string>>(new Set());
  const [extSameAgency,  setExtSameAgency]  = useState(true);
  const [extShared,      setExtShared]      = useState<{ search: string; agency: Agency|null; provider: ServiceProvider|null; fee: string; scope: string }>({
    search: '', agency: null, provider: null, fee: '', scope: '',
  });
  const [extGuide,       setExtGuide]       = useState<{ qty: number; search: string; agency: Agency|null; provider: ServiceProvider|null; fee: string }>({ qty: 1, search: '', agency: null, provider: null, fee: '' });
  const [extDriver,      setExtDriver]      = useState<{ qty: number; search: string; agency: Agency|null; provider: ServiceProvider|null; fee: string }>({ qty: 1, search: '', agency: null, provider: null, fee: '' });
  const [extGuideDriver, setExtGuideDriver] = useState<{ qty: number; search: string; agency: Agency|null; provider: ServiceProvider|null; fee: string }>({ qty: 1, search: '', agency: null, provider: null, fee: '' });
  const [extVan,         setExtVan]         = useState<{ qty: number; search: string; agency: Agency|null; provider: ServiceProvider|null; fee: string }>({ qty: 1, search: '', agency: null, provider: null, fee: '' });
  // ── Paso 3: Operaciones — Compartido ──────────────────────────────────────
  const [guideNotes,        setGuideNotes]        = useState('');
  const [providerList,      setProviderList]       = useState<ServiceProvider[]>(initialProviders);
  const [showProviderModal, setShowProviderModal]  = useState(false);
  const [activeProviderCtx, setActiveProviderCtx] = useState<'shared'|'guide'|'driver'|'guide_driver'|'van'>('shared');

  // ── Paso 4: Detalles del tour ─────────────────────────────────────────────
  const [agencyDoc,            setAgencyDoc]            = useState<File | null>(null);
  const [departureTime,        setDepartureTime]        = useState('');
  const [departureAddress,     setDepartureAddress]     = useState('');
  const [agencyDepartureNotes, setAgencyDepartureNotes] = useState('');
  const [meetingPoint,         setMeetingPoint]         = useState('');
  const [tourStops,            setTourStops]            = useState<TourStop[]>([]);
  const [equipment,            setEquipment]            = useState('');
  const [dietaryRestrictions,  setDietaryRestrictions]  = useState('');
  const [physicalLevel,        setPhysicalLevel]        = useState('');
  const [accessibilityNotes,   setAccessibilityNotes]   = useState('');
  const [specialRequests,      setSpecialRequests]      = useState('');
  const [materialsNeeded,      setMaterialsNeeded]      = useState('');

  // ── Paso 5: Cobranza ──────────────────────────────────────────────────────
  const [paymentDoc,    setPaymentDoc]    = useState<File | null>(null);
  const [totalAmount,   setTotalAmount]   = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amountPaid,    setAmountPaid]    = useState('');
  const [receiptRef,    setReceiptRef]    = useState('');
  const [billingNotes,  setBillingNotes]  = useState('');

  // ── UI ────────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState<{ code:string; status:string } | null>(null);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const tourSlug       = selectedTour?.slug ?? '';
  const paxExceedsSpots = tourDate !== '' && pax > availableSpots;
  const pricePerPerson = totalAmount && pax > 0 ? Math.round(Number(totalAmount) / pax) : null;

  const matchedAgency     = isAgency && agencyName.trim().length >= 2
    ? agencyList.find(a => a.fantasy_name.toLowerCase() === agencyName.trim().toLowerCase())
    : undefined;
  const canRegisterAgency = isAgency && agencyName.trim().length >= 2 && !matchedAgency;

  // ── Validación por paso ───────────────────────────────────────────────────

  function stepValid(n: number): boolean {
    if (n === 1) {
      if (!selectedTour || !tourDate || paxExceedsSpots) return false;
      if (isAgency && agencyName.trim().length < 2) return false;
      return true;
    }
    if (n === 2) {
      if (isAgency) {
        for (const p of passengers) {
          if (p.name.trim().length < 2 || p.phone.trim().length < 6 || p.pickup_address.trim().length < 3) return false;
        }
      } else {
        const lead = passengers[0];
        if (!lead || lead.name.trim().length < 2 || lead.id_number.trim().length < 3) return false;
        if (!lead.email.includes('@') || lead.phone.trim().length < 6 || lead.country.trim().length < 2) return false;
        if (lead.pickup_address.trim().length < 3) return false;
        for (let i = 1; i < passengers.length; i++) {
          const p = passengers[i];
          const hasAny = p.name.trim() || p.id_number.trim();
          if (hasAny && (p.name.trim().length < 2 || p.id_number.trim().length < 3)) return false;
        }
      }
      return true;
    }
    return true; // pasos 3 y 4 son opcionales
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleOriginChange(agency: boolean) {
    setIsAgency(agency);
    if (!agency) { setAgencyName(''); setAgencyId(null); }
    setGroupsCount(1);
    setPassengers(agency
      ? prev => [prev[0] ?? emptyPassenger()]
      : prev => {
          const lead = prev[0] ?? emptyPassenger();
          return pax <= 1 ? [lead] : [lead, ...Array.from({ length: pax-1 }, emptyPassenger)];
        }
    );
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

  function toggleTourLanguage(code: 'es'|'en'|'pt') {
    setTourLanguages(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }

  function updatePassenger(i: number, field: keyof PassengerData, value: string) {
    setPassengers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
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

      let agencyDocUrl: string | undefined;
      if (agencyDoc) {
        const fd = new FormData();
        fd.append('file', agencyDoc);
        const uploadRes = await fetch('/api/admin/upload-booking-doc', { method: 'POST', body: fd });
        if (uploadRes.ok) {
          const uploadBody = await uploadRes.json() as { url: string };
          agencyDocUrl = uploadBody.url;
        }
      }

      let paymentDocUrl: string | undefined;
      if (paymentDoc) {
        const fd = new FormData();
        fd.append('file', paymentDoc);
        const uploadRes = await fetch('/api/admin/upload-booking-doc', { method: 'POST', body: fd });
        if (uploadRes.ok) {
          const uploadBody = await uploadRes.json() as { url: string };
          paymentDocUrl = uploadBody.url;
        }
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
          has_picnic:          hasPicnic,
          duration_hours:      durationHours ? Number(durationHours) : undefined,
          picnic_notes:        picnicNotes   || undefined,
          guide_notes: guideNotes || undefined,
          van_id: ccRoles.has('van') ? (ccVan.vanIds.find(Boolean) ?? undefined) : undefined,
          participants_ops: (() => {
            const ops: Array<{
              source: 'internal'|'external';
              team_member_id?: string; agency_id?: string; service_provider_id?: string;
              role?: string; fee?: number; scope?: string;
            }> = [];
            // CaraCara — un ops por cada persona asignada
            if (ccRoles.has('guide'))
              ccGuide.members.forEach((m, i) => { if (m) ops.push({ source:'internal', team_member_id:m, role:'guide', fee:ccGuide.fees[i]?Number(ccGuide.fees[i]):undefined }); });
            if (ccRoles.has('driver'))
              ccDriver.members.forEach((m, i) => { if (m) ops.push({ source:'internal', team_member_id:m, role:'driver', fee:ccDriver.fees[i]?Number(ccDriver.fees[i]):undefined }); });
            if (ccRoles.has('guide_driver'))
              ccGuideDriver.members.forEach((m, i) => { if (m) ops.push({ source:'internal', team_member_id:m, role:'guide_driver', fee:ccGuideDriver.fees[i]?Number(ccGuideDriver.fees[i]):undefined }); });
            // Externos
            if (extRoles.size > 0) {
              if (extSameAgency && (extShared.agency || extShared.provider)) {
                ops.push({
                  source: 'external',
                  agency_id: extShared.agency?.id,
                  service_provider_id: extShared.provider?.id,
                  role: Array.from(extRoles).join(','),
                  fee: extShared.fee ? Number(extShared.fee) : undefined,
                  scope: extShared.scope || undefined,
                });
              } else if (!extSameAgency) {
                const extMap: Record<string, { qty: number; agency: Agency|null; provider: ServiceProvider|null; fee: string }> = {
                  guide: extGuide, driver: extDriver, guide_driver: extGuideDriver, van: extVan,
                };
                for (const role of Array.from(extRoles)) {
                  const c = extMap[role];
                  if (c && (c.agency || c.provider))
                    ops.push({ source:'external', agency_id:c.agency?.id, service_provider_id:c.provider?.id, role, fee:c.fee?Number(c.fee):undefined, scope:c.qty>1?`Cantidad: ${c.qty}`:undefined });
                }
              }
            }
            return ops.length > 0 ? ops : undefined;
          })(),
          departure_time:          departureTime        || undefined,
          departure_address:       departureAddress     || undefined,
          agency_departure_notes:  agencyDepartureNotes || undefined,
          meeting_point:           meetingPoint         || undefined,
          tour_stops: tourStops.length > 0 ? tourStops.map(s => ({
            name:         s.name,
            arrival_time: s.arrival_time || undefined,
            duration_min: s.duration_min ? Number(s.duration_min) : undefined,
            notes:        s.notes        || undefined,
          })) : undefined,
          equipment_notes:      equipment            || undefined,
          dietary_restrictions: dietaryRestrictions  || undefined,
          physical_level:       physicalLevel        || undefined,
          accessibility_notes:  accessibilityNotes   || undefined,
          special_requests:     specialRequests      || undefined,
          materials_needed:     materialsNeeded      || undefined,
          agency_doc_url:       agencyDocUrl,
          payment_doc_url:      paymentDocUrl,
          total_amount:     totalAmount ? Number(totalAmount) : undefined,
          price_per_person: pricePerPerson ?? undefined,
          payment_status:   paymentStatus  || undefined,
          payment_method:   paymentMethod  || undefined,
          amount_paid:      amountPaid ? Number(amountPaid) : undefined,
          receipt_ref:      receiptRef  || undefined,
          billing_notes:    billingNotes || undefined,
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

  // Personas ya asignadas en CaraCara (cualquier rol) — para filtrar dropdowns
  const assignedCcMembers = new Set(
    [...ccGuide.members, ...ccDriver.members, ...ccGuideDriver.members].filter(Boolean)
  );
  // Vans ya asignadas en CaraCara
  const assignedCcVans = new Set(ccVan.vanIds.filter(Boolean));

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
      <div className="flex flex-col max-w-3xl">

        {/* Indicador de paso */}
        <StepIndicator current={step} />

        {/* ══════════════════════════════════════════════════════════════════
            PASO 1 — Información del tour
        ══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="flex flex-col gap-5">

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
                    tours={tourList} selected={selectedTour}
                    onSelect={handleTourSelect} onQuickCreate={handleQuickCreateTour} creating={creatingTour}
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

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PASO 2 — Pasajeros
        ══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            {isAgency ? (
              <>
                <p className="text-sm text-gray-500">
                  {passengers.length === 1 ? 'Titular del grupo' : `Titulares de los ${passengers.length} grupos`}
                  <span className="ml-1 text-xs text-gray-400">· nombre, teléfono y pickup obligatorios</span>
                </p>

                {passengers.map((p, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
                    {passengers.length > 1 && (
                      <p className="text-xs font-semibold text-teal">
                        Grupo {i+1}{i===0 && <span className="ml-1 font-normal text-gray-400">· contacto principal</span>}
                      </p>
                    )}
                    <PassengerLookup onSelect={c => {
                      setPassengers(prev => prev.map((pp, idx) => idx !== i ? pp : {
                        ...pp,
                        name:       c.name,
                        email:      c.email      ?? pp.email,
                        phone:      c.phone      ?? pp.phone,
                        country:    c.country    ?? pp.country,
                        id_type:    c.id_type    ?? pp.id_type,
                        id_number:  c.id_number  ?? pp.id_number,
                        birth_date: c.birth_date ?? pp.birth_date,
                      }));
                    }} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Nombre completo" required>
                        <input value={p.name} onChange={e => updatePassenger(i,'name',e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Teléfono" required>
                        <PhoneInput
                          value={p.phone}
                          onChange={v => updatePassenger(i,'phone',v)}
                          required
                        />
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
                          <select value={p.id_type} onChange={e => {
                            updatePassenger(i,'id_type',e.target.value);
                            updatePassenger(i,'id_number','');
                          }} className={selectClass}>
                            <option value="passport">Pasaporte</option>
                            <option value="rut">RUT</option>
                          </select>
                        </Field>
                        <Field label="N° de documento">
                          <DocNumberInput
                            idType={p.id_type}
                            value={p.id_number}
                            onChange={v => updatePassenger(i,'id_number',v)}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="País de origen">
                          <input value={p.country} onChange={e => updatePassenger(i,'country',e.target.value)} className={inputClass} />
                        </Field>
                      </div>
                    </details>
                  </div>
                ))}
              </>
            ) : (
              <>
                {passengers.map((p, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-teal">
                        {i===0 ? 'Titular (contacto principal)' : `Pasajero ${i+1}`}
                      </p>
                      {i > 0 && <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">opcional</span>}
                    </div>
                    {i > 0 && <p className="text-xs text-gray-400 -mt-2">Déjalo en blanco si no tienes el dato aún.</p>}
                    <PassengerLookup onSelect={c => {
                      setPassengers(prev => prev.map((pp, idx) => idx !== i ? pp : {
                        ...pp,
                        name:       c.name,
                        email:      c.email      ?? pp.email,
                        phone:      c.phone      ?? pp.phone,
                        country:    c.country    ?? pp.country,
                        id_type:    c.id_type    ?? pp.id_type,
                        id_number:  c.id_number  ?? pp.id_number,
                        birth_date: c.birth_date ?? pp.birth_date,
                      }));
                    }} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Nombre completo" required={i===0}>
                        <input value={p.name} onChange={e => updatePassenger(i,'name',e.target.value)} className={inputClass} />
                      </Field>
                      <Field label="Tipo de documento" required={i===0}>
                        <select value={p.id_type} onChange={e => {
                          updatePassenger(i,'id_type',e.target.value);
                          updatePassenger(i,'id_number','');
                        }} className={selectClass}>
                          <option value="passport">Pasaporte</option>
                          <option value="rut">RUT</option>
                        </select>
                      </Field>
                      <Field label="N° de documento" required={i===0}>
                        <DocNumberInput
                          idType={p.id_type}
                          value={p.id_number}
                          onChange={v => updatePassenger(i,'id_number',v)}
                          required={i===0}
                          className={inputClass}
                        />
                      </Field>
                      {i===0 && (
                        <>
                          <Field label="País de origen" required>
                            <input value={p.country} onChange={e => updatePassenger(i,'country',e.target.value)} className={inputClass} />
                          </Field>
                          <Field label="Fecha de nacimiento">
                            <input type="date" value={p.birth_date} onChange={e => updatePassenger(i,'birth_date',e.target.value)}
                              max={new Date().toISOString().slice(0,10)} className={inputClass} />
                          </Field>
                          <Field label="Email" required>
                            <input type="email" value={p.email} onChange={e => updatePassenger(i,'email',e.target.value)} className={inputClass} />
                          </Field>
                          <Field label="Teléfono" required>
                            <PhoneInput
                              value={p.phone}
                              onChange={v => updatePassenger(i,'phone',v)}
                              required
                            />
                          </Field>
                          <Field label="Dirección de pickup" required>
                            <input value={p.pickup_address} onChange={e => updatePassenger(i,'pickup_address',e.target.value)}
                              placeholder="Hotel Austral, Av. O'Higgins 1234" className={inputClass} />
                          </Field>
                          <Field label="Hospedaje">
                            <input value={p.hotel_name} onChange={e => updatePassenger(i,'hotel_name',e.target.value)} className={inputClass} />
                          </Field>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

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
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PASO 3 — Operaciones
        ══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-gray-400">Información opcional — se puede completar después.</p>

            {/* ── CaraCara ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">CaraCara</p>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {CC_ROLE_BUTTONS.map(r => (
                  <button key={r.key} type="button"
                    onClick={() => setCcRoles(prev => { const n = new Set(prev); if (n.has(r.key)) n.delete(r.key); else n.add(r.key); return n; })}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                      ccRoles.has(r.key) ? 'border-teal bg-teal/5 text-teal' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Card: Guía CaraCara */}
              {ccRoles.has('guide') && (
                <div className="border border-teal/20 bg-teal/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-teal">Guía</p>
                    <div className="flex items-center gap-3">
                      <Counter value={ccGuide.members.length} min={1} max={6}
                        onChange={n => setCcGuide(s => ({ members: resizeArr(s.members, n), fees: resizeArr(s.fees, n) }))} />
                      <button type="button" onClick={() => setCcRoles(prev => { const n = new Set(prev); n.delete('guide'); return n; })}
                        className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  {ccGuide.members.map((m, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label={ccGuide.members.length > 1 ? `Persona ${i + 1}` : 'Persona del equipo'}>
                        <select value={m} onChange={e => setCcGuide(s => ({ ...s, members: s.members.map((x, j) => j === i ? e.target.value : x) }))} className={selectClass}>
                          <option value="">— Sin asignar —</option>
                          {guides.filter(g => !assignedCcMembers.has(g.id) || g.id === m).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Honorario bruto (CLP)">
                        <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={ccGuide.fees[i] ?? ''} placeholder="Ej: 45000"
                          onChange={e => setCcGuide(s => ({ ...s, fees: s.fees.map((x, j) => j === i ? e.target.value : x) }))} className={inputClass} />
                      </Field>
                    </div>
                  ))}
                </div>
              )}

              {/* Card: Chofer CaraCara */}
              {ccRoles.has('driver') && (
                <div className="border border-teal/20 bg-teal/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-teal">Chofer</p>
                    <div className="flex items-center gap-3">
                      <Counter value={ccDriver.members.length} min={1} max={6}
                        onChange={n => setCcDriver(s => ({ members: resizeArr(s.members, n), fees: resizeArr(s.fees, n) }))} />
                      <button type="button" onClick={() => setCcRoles(prev => { const n = new Set(prev); n.delete('driver'); return n; })}
                        className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  {ccDriver.members.map((m, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label={ccDriver.members.length > 1 ? `Persona ${i + 1}` : 'Persona del equipo'}>
                        <select value={m} onChange={e => setCcDriver(s => ({ ...s, members: s.members.map((x, j) => j === i ? e.target.value : x) }))} className={selectClass}>
                          <option value="">— Sin asignar —</option>
                          {guides.filter(g => !assignedCcMembers.has(g.id) || g.id === m).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Honorario bruto (CLP)">
                        <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={ccDriver.fees[i] ?? ''} placeholder="Ej: 30000"
                          onChange={e => setCcDriver(s => ({ ...s, fees: s.fees.map((x, j) => j === i ? e.target.value : x) }))} className={inputClass} />
                      </Field>
                    </div>
                  ))}
                </div>
              )}

              {/* Card: Guía-Conductor CaraCara */}
              {ccRoles.has('guide_driver') && (
                <div className="border border-teal/20 bg-teal/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-teal">Guía-Conductor</p>
                    <div className="flex items-center gap-3">
                      <Counter value={ccGuideDriver.members.length} min={1} max={6}
                        onChange={n => setCcGuideDriver(s => ({ members: resizeArr(s.members, n), fees: resizeArr(s.fees, n) }))} />
                      <button type="button" onClick={() => setCcRoles(prev => { const n = new Set(prev); n.delete('guide_driver'); return n; })}
                        className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  {ccGuideDriver.members.map((m, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label={ccGuideDriver.members.length > 1 ? `Persona ${i + 1}` : 'Persona del equipo'}>
                        <select value={m} onChange={e => setCcGuideDriver(s => ({ ...s, members: s.members.map((x, j) => j === i ? e.target.value : x) }))} className={selectClass}>
                          <option value="">— Sin asignar —</option>
                          {guides.filter(g => !assignedCcMembers.has(g.id) || g.id === m).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Honorario bruto (CLP)">
                        <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={ccGuideDriver.fees[i] ?? ''} placeholder="Ej: 55000"
                          onChange={e => setCcGuideDriver(s => ({ ...s, fees: s.fees.map((x, j) => j === i ? e.target.value : x) }))} className={inputClass} />
                      </Field>
                    </div>
                  ))}
                </div>
              )}

              {/* Card: Van CaraCara */}
              {ccRoles.has('van') && (
                <div className="border border-teal/20 bg-teal/5 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-teal">Van</p>
                    <div className="flex items-center gap-3">
                      <Counter value={ccVan.vanIds.length} min={1} max={6}
                        onChange={n => setCcVan(s => ({ vanIds: resizeArr(s.vanIds, n) }))} />
                      <button type="button" onClick={() => setCcRoles(prev => { const n = new Set(prev); n.delete('van'); return n; })}
                        className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                  {ccVan.vanIds.map((vid, i) => (
                    <Field key={i} label={ccVan.vanIds.length > 1 ? `Vehículo ${i + 1}` : 'Vehículo'}>
                      <select value={vid} onChange={e => setCcVan(s => ({ vanIds: s.vanIds.map((x, j) => j === i ? e.target.value : x) }))} className={`${selectClass} max-w-sm`}>
                        <option value="">— Sin asignar —</option>
                        {vans.filter(v => !assignedCcVans.has(v.id) || v.id === vid).map(v => <option key={v.id} value={v.id}>{v.name}{v.plate ? ` · ${v.plate}` : ''} ({v.capacity} pax)</option>)}
                      </select>
                    </Field>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* ── Externalizado ────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Externalizado</p>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {CC_ROLE_BUTTONS.map(r => (
                  <button key={r.key} type="button"
                    onClick={() => setExtRoles(prev => { const n = new Set(prev); if (n.has(r.key)) n.delete(r.key); else n.add(r.key); return n; })}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                      extRoles.has(r.key) ? 'border-orange bg-orange/5 text-orange' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>

              {extRoles.size > 0 && (
                <>
                  {/* Toggle misma agencia / separado */}
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs font-medium self-start">
                    {([
                      { v: true,  l: 'Todo con la misma agencia' },
                      { v: false, l: 'Servicios separados' },
                    ] as const).map(opt => (
                      <button key={String(opt.v)} type="button" onClick={() => setExtSameAgency(opt.v)}
                        className={`px-4 py-2 transition-colors ${
                          extSameAgency === opt.v ? 'bg-orange text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}>
                        {opt.l}
                      </button>
                    ))}
                  </div>

                  {/* Card única — misma agencia */}
                  {extSameAgency && (
                    <div className="border border-orange/20 bg-orange/5 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-orange">
                          {Array.from(extRoles).map(r => CC_ROLE_BUTTONS.find(b => b.key === r)?.label ?? r).join(' + ')}
                        </p>
                        <button type="button" onClick={() => setExtRoles(new Set())}
                          className="text-gray-300 hover:text-red-400 transition-colors p-0.5 flex-shrink-0">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <Field label="Agencia o proveedor">
                        <input list="ext-shared-datalist" value={extShared.search}
                          onChange={e => {
                            const val = e.target.value;
                            const mA = agencyList.find(a => a.fantasy_name.toLowerCase() === val.trim().toLowerCase());
                            const mP = providerList.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
                            setExtShared(s => ({ ...s, search: val, agency: mA ?? null, provider: mP ?? null }));
                          }}
                          placeholder="Buscar agencia o proveedor…"
                          className={inputClass}
                        />
                        <datalist id="ext-shared-datalist">
                          {agencyList.map(a => <option key={a.id} value={a.fantasy_name} />)}
                          {providerList.map(pr => <option key={pr.id} value={pr.name} />)}
                        </datalist>
                        {extShared.agency && (
                          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span>Agencia · <span className="font-medium">{extShared.agency.razon_social}</span></span>
                          </div>
                        )}
                        {!extShared.agency && extShared.provider && (
                          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span>{extShared.provider.name}</span>
                          </div>
                        )}
                        {!extShared.agency && !extShared.provider && extShared.search.trim().length >= 2 && (
                          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                            <p className="text-xs text-amber-700 flex-1"><span className="font-semibold">&ldquo;{extShared.search}&rdquo;</span> no está registrado.</p>
                            <button type="button" onClick={() => { setActiveProviderCtx('shared'); setShowProviderModal(true); }}
                              className="text-xs font-semibold text-teal hover:underline whitespace-nowrap">
                              Registrar proveedor
                            </button>
                          </div>
                        )}
                      </Field>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Monto total bruto (CLP)">
                          <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={extShared.fee} placeholder="Ej: 120000"
                            onChange={e => setExtShared(s => ({ ...s, fee: e.target.value }))} className={inputClass} />
                        </Field>
                      </div>
                      <Field label="¿Qué contempla?" hint="Transporte, guía, entradas, alimentación…">
                        <textarea rows={2} value={extShared.scope} placeholder="Describe qué incluye el servicio…"
                          onChange={e => setExtShared(s => ({ ...s, scope: e.target.value }))}
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
                      </Field>
                    </div>
                  )}

                  {/* Cards separadas por rol */}
                  {!extSameAgency && (
                    <>
                      {extRoles.has('guide') && (
                        <div className="border border-orange/20 bg-orange/5 rounded-xl p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <p className="text-xs font-semibold text-orange">Guía externo</p>
                              <Counter value={extGuide.qty} min={1} max={10} onChange={n => setExtGuide(s => ({ ...s, qty: n }))} />
                            </div>
                            <button type="button" onClick={() => setExtRoles(prev => { const n = new Set(prev); n.delete('guide'); return n; })}
                              className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <Field label="Agencia o proveedor">
                            <input list="ext-sep-guide" value={extGuide.search}
                              onChange={e => {
                                const val = e.target.value;
                                const mA = agencyList.find(a => a.fantasy_name.toLowerCase() === val.trim().toLowerCase());
                                const mP = providerList.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
                                setExtGuide(s => ({ ...s, search: val, agency: mA ?? null, provider: mP ?? null }));
                              }}
                              placeholder="Buscar agencia o proveedor…" className={inputClass} />
                            <datalist id="ext-sep-guide">
                              {agencyList.map(a => <option key={a.id} value={a.fantasy_name} />)}
                              {providerList.map(pr => <option key={pr.id} value={pr.name} />)}
                            </datalist>
                            {extGuide.agency && (
                              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>Agencia · <span className="font-medium">{extGuide.agency.razon_social}</span></span>
                              </div>
                            )}
                            {!extGuide.agency && extGuide.provider && (
                              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>{extGuide.provider.name}</span>
                              </div>
                            )}
                            {!extGuide.agency && !extGuide.provider && extGuide.search.trim().length >= 2 && (
                              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                                <p className="text-xs text-amber-700 flex-1"><span className="font-semibold">&ldquo;{extGuide.search}&rdquo;</span> no está registrado.</p>
                                <button type="button" onClick={() => { setActiveProviderCtx('guide'); setShowProviderModal(true); }}
                                  className="text-xs font-semibold text-teal hover:underline whitespace-nowrap">Registrar proveedor</button>
                              </div>
                            )}
                          </Field>
                          <Field label="Monto bruto (CLP)">
                            <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={extGuide.fee} placeholder="Ej: 60000"
                              onChange={e => setExtGuide(s => ({ ...s, fee: e.target.value }))} className={`${inputClass} max-w-xs`} />
                          </Field>
                        </div>
                      )}

                      {extRoles.has('driver') && (
                        <div className="border border-orange/20 bg-orange/5 rounded-xl p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <p className="text-xs font-semibold text-orange">Chofer externo</p>
                              <Counter value={extDriver.qty} min={1} max={10} onChange={n => setExtDriver(s => ({ ...s, qty: n }))} />
                            </div>
                            <button type="button" onClick={() => setExtRoles(prev => { const n = new Set(prev); n.delete('driver'); return n; })}
                              className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <Field label="Agencia o proveedor">
                            <input list="ext-sep-driver" value={extDriver.search}
                              onChange={e => {
                                const val = e.target.value;
                                const mA = agencyList.find(a => a.fantasy_name.toLowerCase() === val.trim().toLowerCase());
                                const mP = providerList.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
                                setExtDriver(s => ({ ...s, search: val, agency: mA ?? null, provider: mP ?? null }));
                              }}
                              placeholder="Buscar agencia o proveedor…" className={inputClass} />
                            <datalist id="ext-sep-driver">
                              {agencyList.map(a => <option key={a.id} value={a.fantasy_name} />)}
                              {providerList.map(pr => <option key={pr.id} value={pr.name} />)}
                            </datalist>
                            {extDriver.agency && (
                              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>Agencia · <span className="font-medium">{extDriver.agency.razon_social}</span></span>
                              </div>
                            )}
                            {!extDriver.agency && extDriver.provider && (
                              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>{extDriver.provider.name}</span>
                              </div>
                            )}
                            {!extDriver.agency && !extDriver.provider && extDriver.search.trim().length >= 2 && (
                              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                                <p className="text-xs text-amber-700 flex-1"><span className="font-semibold">&ldquo;{extDriver.search}&rdquo;</span> no está registrado.</p>
                                <button type="button" onClick={() => { setActiveProviderCtx('driver'); setShowProviderModal(true); }}
                                  className="text-xs font-semibold text-teal hover:underline whitespace-nowrap">Registrar proveedor</button>
                              </div>
                            )}
                          </Field>
                          <Field label="Monto bruto (CLP)">
                            <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={extDriver.fee} placeholder="Ej: 50000"
                              onChange={e => setExtDriver(s => ({ ...s, fee: e.target.value }))} className={`${inputClass} max-w-xs`} />
                          </Field>
                        </div>
                      )}

                      {extRoles.has('guide_driver') && (
                        <div className="border border-orange/20 bg-orange/5 rounded-xl p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <p className="text-xs font-semibold text-orange">Guía-Conductor externo</p>
                              <Counter value={extGuideDriver.qty} min={1} max={10} onChange={n => setExtGuideDriver(s => ({ ...s, qty: n }))} />
                            </div>
                            <button type="button" onClick={() => setExtRoles(prev => { const n = new Set(prev); n.delete('guide_driver'); return n; })}
                              className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <Field label="Agencia o proveedor">
                            <input list="ext-sep-guidedriver" value={extGuideDriver.search}
                              onChange={e => {
                                const val = e.target.value;
                                const mA = agencyList.find(a => a.fantasy_name.toLowerCase() === val.trim().toLowerCase());
                                const mP = providerList.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
                                setExtGuideDriver(s => ({ ...s, search: val, agency: mA ?? null, provider: mP ?? null }));
                              }}
                              placeholder="Buscar agencia o proveedor…" className={inputClass} />
                            <datalist id="ext-sep-guidedriver">
                              {agencyList.map(a => <option key={a.id} value={a.fantasy_name} />)}
                              {providerList.map(pr => <option key={pr.id} value={pr.name} />)}
                            </datalist>
                            {extGuideDriver.agency && (
                              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>Agencia · <span className="font-medium">{extGuideDriver.agency.razon_social}</span></span>
                              </div>
                            )}
                            {!extGuideDriver.agency && extGuideDriver.provider && (
                              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>{extGuideDriver.provider.name}</span>
                              </div>
                            )}
                            {!extGuideDriver.agency && !extGuideDriver.provider && extGuideDriver.search.trim().length >= 2 && (
                              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                                <p className="text-xs text-amber-700 flex-1"><span className="font-semibold">&ldquo;{extGuideDriver.search}&rdquo;</span> no está registrado.</p>
                                <button type="button" onClick={() => { setActiveProviderCtx('guide_driver'); setShowProviderModal(true); }}
                                  className="text-xs font-semibold text-teal hover:underline whitespace-nowrap">Registrar proveedor</button>
                              </div>
                            )}
                          </Field>
                          <Field label="Monto bruto (CLP)">
                            <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={extGuideDriver.fee} placeholder="Ej: 80000"
                              onChange={e => setExtGuideDriver(s => ({ ...s, fee: e.target.value }))} className={`${inputClass} max-w-xs`} />
                          </Field>
                        </div>
                      )}

                      {extRoles.has('van') && (
                        <div className="border border-orange/20 bg-orange/5 rounded-xl p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <p className="text-xs font-semibold text-orange">Transporte externo</p>
                              <Counter value={extVan.qty} min={1} max={10} onChange={n => setExtVan(s => ({ ...s, qty: n }))} />
                            </div>
                            <button type="button" onClick={() => setExtRoles(prev => { const n = new Set(prev); n.delete('van'); return n; })}
                              className="text-gray-300 hover:text-red-400 transition-colors p-0.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <Field label="Agencia o proveedor">
                            <input list="ext-sep-van" value={extVan.search}
                              onChange={e => {
                                const val = e.target.value;
                                const mA = agencyList.find(a => a.fantasy_name.toLowerCase() === val.trim().toLowerCase());
                                const mP = providerList.find(p => p.name.toLowerCase() === val.trim().toLowerCase());
                                setExtVan(s => ({ ...s, search: val, agency: mA ?? null, provider: mP ?? null }));
                              }}
                              placeholder="Buscar agencia o proveedor…" className={inputClass} />
                            <datalist id="ext-sep-van">
                              {agencyList.map(a => <option key={a.id} value={a.fantasy_name} />)}
                              {providerList.map(pr => <option key={pr.id} value={pr.name} />)}
                            </datalist>
                            {extVan.agency && (
                              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>Agencia · <span className="font-medium">{extVan.agency.razon_social}</span></span>
                              </div>
                            )}
                            {!extVan.agency && extVan.provider && (
                              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-1">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                <span>{extVan.provider.name}</span>
                              </div>
                            )}
                            {!extVan.agency && !extVan.provider && extVan.search.trim().length >= 2 && (
                              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                                <p className="text-xs text-amber-700 flex-1"><span className="font-semibold">&ldquo;{extVan.search}&rdquo;</span> no está registrado.</p>
                                <button type="button" onClick={() => { setActiveProviderCtx('van'); setShowProviderModal(true); }}
                                  className="text-xs font-semibold text-teal hover:underline whitespace-nowrap">Registrar proveedor</button>
                              </div>
                            )}
                          </Field>
                          <Field label="Monto bruto (CLP)">
                            <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={extVan.fee} placeholder="Ej: 70000"
                              onChange={e => setExtVan(s => ({ ...s, fee: e.target.value }))} className={`${inputClass} max-w-xs`} />
                          </Field>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PASO 4 — Detalles del tour
        ══════════════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-gray-400">Toda la información de este paso es opcional.</p>

            {/* ── Documento adjunto ──────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-600">Documento de la agencia (opcional)</label>
              <div className="relative">
                <input type="file" id="agency-doc-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={e => setAgencyDoc(e.target.files?.[0] ?? null)}
                  className="hidden" />
                <label htmlFor="agency-doc-input"
                  className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-teal hover:bg-teal/5 transition-colors w-full">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {agencyDoc
                    ? <span className="text-sm text-gray-700 truncate">{agencyDoc.name}</span>
                    : <span className="text-sm text-gray-400">Adjuntar PDF, Word, Excel o imagen…</span>
                  }
                </label>
                {agencyDoc && (
                  <button type="button" onClick={() => setAgencyDoc(null)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* ── Picnic y duración ──────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Picnic y duración</p>
              <div className="flex flex-col gap-3">
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
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-medium text-gray-600 w-28 flex-shrink-0">Duración</span>
                  <input type="number" onWheel={e => e.currentTarget.blur()} min={0.5} max={24} step={0.5} value={durationHours}
                    onChange={e => setDurationHours(e.target.value)} placeholder="horas"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-24" />
                  {selectedTour?.duration_hours != null && !durationHours && (
                    <span className="text-xs text-gray-400">
                      Último: {selectedTour.duration_hours}h
                      <button type="button" className="ml-1 text-teal hover:underline"
                        onClick={() => setDurationHours(String(selectedTour!.duration_hours))}>usar</button>
                    </span>
                  )}
                  {durationHours && <span className="text-xs text-gray-400">Se actualizará el tour.</span>}
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* ── Horario de partida ─────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Horario de partida</p>
              {isAgency ? (
                <Field label="Horarios definidos por la agencia">
                  <textarea rows={2} value={agencyDepartureNotes}
                    onChange={e => setAgencyDepartureNotes(e.target.value)}
                    placeholder="Ej: pickup 08:00 en hotel, salida 08:30 desde terminal…"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
                </Field>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Hora primer punto">
                    <input type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)}
                      className={inputClass} />
                  </Field>
                  <Field label="Dirección primer punto">
                    <input type="text" value={departureAddress} onChange={e => setDepartureAddress(e.target.value)}
                      placeholder="Ej: Av. Libertad 1234, Puerto Montt"
                      className={inputClass} />
                  </Field>
                </div>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* ── Punto de encuentro ─────────────────────────────────────── */}
            <Field label="Punto de encuentro (opcional)" hint="Para coordinar a guías y choferes">
              <input type="text" value={meetingPoint} onChange={e => setMeetingPoint(e.target.value)}
                placeholder="Ej: Lobby Hotel Austral — 08:30 h"
                className={inputClass} />
            </Field>

            <hr className="border-gray-100" />

            {/* ── Puntos a visitar ───────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Puntos a visitar</p>
                <div className="h-px flex-1 bg-gray-100" />
                <button type="button"
                  onClick={() => setTourStops(s => [...s, { key: String(Date.now()), name: '', arrival_time: '', duration_min: '', notes: '' }])}
                  className="text-[11px] text-teal hover:underline font-medium whitespace-nowrap">
                  + Agregar parada
                </button>
              </div>
              {tourStops.length === 0 && (
                <p className="text-xs text-gray-400 italic">Sin paradas definidas. Puramente informativo para el equipo.</p>
              )}
              {tourStops.map((stop, idx) => (
                <div key={stop.key} className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest w-5 text-center">{idx + 1}</span>
                    <input type="text" value={stop.name} placeholder="Nombre / lugar"
                      onChange={e => setTourStops(s => s.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-teal flex-1" />
                    <input type="time" value={stop.arrival_time}
                      onChange={e => setTourStops(s => s.map((x, i) => i === idx ? { ...x, arrival_time: e.target.value } : x))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-teal w-28" />
                    <input type="number" onWheel={e => e.currentTarget.blur()} min={0} max={480} value={stop.duration_min} placeholder="min"
                      onChange={e => setTourStops(s => s.map((x, i) => i === idx ? { ...x, duration_min: e.target.value } : x))}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-teal w-20" />
                    <button type="button"
                      onClick={() => setTourStops(s => s.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-400 transition-colors p-0.5 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <input type="text" value={stop.notes} placeholder="Notas (opcional)"
                    onChange={e => setTourStops(s => s.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-teal w-full ml-7" />
                </div>
              ))}
            </div>

            <hr className="border-gray-100" />

            {/* ── Equipamiento sugerido ─────────────────────────────────── */}
            <Field label="Equipamiento sugerido (opcional)">
              <textarea rows={2} value={equipment} onChange={e => setEquipment(e.target.value)}
                placeholder="Ej: Calzado de trekking, ropa de abrigo, botella de agua…"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
            </Field>

            {/* ── Restricciones alimentarias ────────────────────────────── */}
            <Field label="Restricciones alimentarias (opcional)">
              <textarea rows={2} value={dietaryRestrictions} onChange={e => setDietaryRestrictions(e.target.value)}
                placeholder="Ej: 2 vegetarianos, 1 celíaco, alergia a frutos secos…"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
            </Field>

            {/* ── Nivel de condición física ──────────────────────────────── */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-600">Nivel de condición física (opcional)</label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { v: 'low',       l: 'Bajo'     },
                  { v: 'moderate',  l: 'Moderado'  },
                  { v: 'high',      l: 'Alto'      },
                  { v: 'very_high', l: 'Muy alto'  },
                ] as const).map(opt => (
                  <button key={opt.v} type="button"
                    onClick={() => setPhysicalLevel(prev => prev === opt.v ? '' : opt.v)}
                    className={`border-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                      physicalLevel === opt.v ? 'border-teal bg-teal/5 text-teal' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Notas de accesibilidad ────────────────────────────────── */}
            <Field label="Notas de accesibilidad (opcional)">
              <textarea rows={2} value={accessibilityNotes} onChange={e => setAccessibilityNotes(e.target.value)}
                placeholder="Ej: Pasajero en silla de ruedas, adulto mayor con movilidad reducida…"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
            </Field>

            {/* ── Solicitudes especiales ────────────────────────────────── */}
            <Field label="Solicitudes especiales del grupo (opcional)">
              <textarea rows={2} value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
                placeholder="Ej: Celebración de cumpleaños, fotografía, sorpresa…"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
            </Field>

            {/* ── Materiales a preparar ──────────────────────────────────── */}
            <Field label="Materiales a preparar (opcional)">
              <textarea rows={2} value={materialsNeeded} onChange={e => setMaterialsNeeded(e.target.value)}
                placeholder="Ej: Entradas al parque, mapas, botiquín, banner…"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
            </Field>

            <hr className="border-gray-100" />

            {/* ── Notas generales al equipo ──────────────────────────────── */}
            <Field label="Notas generales al equipo">
              <textarea rows={3} value={guideNotes} onChange={e => setGuideNotes(e.target.value)}
                placeholder="Instrucciones de ruta, orden de pickups, necesidades especiales del grupo…"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
            </Field>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PASO 5 — Cobranza
        ══════════════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <div className="flex flex-col gap-4">

            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <Field label="Total cobrado (CLP)">
                <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
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

            <Field label="Estado del pago">
              <div className="flex gap-2">
                {PAYMENT_STATUS.map(s => (
                  <button key={s.v} type="button" onClick={() => setPaymentStatus(prev => prev===s.v ? '' : s.v)}
                    className={`border-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                      paymentStatus===s.v
                        ? s.v==='paid'    ? 'border-green-400 bg-green-50 text-green-700'
                        : s.v==='partial' ? 'border-amber-400 bg-amber-50 text-amber-700'
                        :                   'border-gray-400 bg-gray-50 text-gray-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>{s.l}</button>
                ))}
              </div>
            </Field>

            {paymentStatus === 'partial' && (
              <Field label="Monto pagado (CLP)">
                <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                  placeholder="Ej: 90000" className={`${inputClass} max-w-xs`} />
              </Field>
            )}

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
              <textarea rows={3} value={billingNotes} onChange={e => setBillingNotes(e.target.value)}
                placeholder="Cuotas, acuerdos especiales, pendiente de factura, etc."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none w-full" />
            </Field>

            {/* ── Comprobante de pago ────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-600">Comprobante de pago (opcional)</label>
              <div className="relative">
                <input type="file" id="payment-doc-input" accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={e => setPaymentDoc(e.target.files?.[0] ?? null)}
                  className="hidden" />
                <label htmlFor="payment-doc-input"
                  className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-teal hover:bg-teal/5 transition-colors w-full">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {paymentDoc
                    ? <span className="text-sm text-gray-700 truncate">{paymentDoc.name}</span>
                    : <span className="text-sm text-gray-400">Adjuntar comprobante (PDF o imagen)…</span>
                  }
                </label>
                {paymentDoc && (
                  <button type="button" onClick={() => setPaymentDoc(null)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Navegación ─────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-5 mt-5 border-t border-gray-100">
          <button type="button" onClick={() => setStep(s => s - 1)} disabled={step === 1}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </button>

          {step < 5 ? (
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={!stepValid(step)}
              className="flex items-center gap-1.5 bg-teal text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Siguiente
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit}
              disabled={!stepValid(1) || !stepValid(2) || loading}
              className="bg-teal text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading ? 'Creando reserva…' : 'Crear reserva'}
            </button>
          )}
        </div>
      </div>

      {showAgencyModal && (
        <AgencyRegistrationModal
          initialName={agencyName}
          onClose={() => setShowAgencyModal(false)}
          onSaved={handleAgencySaved}
        />
      )}

      {showProviderModal && (
        <ServiceProviderModal
          initialName={
            activeProviderCtx === 'shared'       ? extShared.search :
            activeProviderCtx === 'guide'        ? extGuide.search :
            activeProviderCtx === 'driver'       ? extDriver.search :
            activeProviderCtx === 'guide_driver' ? extGuideDriver.search :
            extVan.search
          }
          onClose={() => setShowProviderModal(false)}
          onSaved={provider => {
            setProviderList(prev => [...prev, provider].sort((a, b) => a.name.localeCompare(b.name, 'es')));
            const patch = { provider, agency: null as Agency|null, search: provider.name };
            if      (activeProviderCtx === 'shared')       setExtShared(s => ({ ...s, ...patch }));
            else if (activeProviderCtx === 'guide')        setExtGuide(s => ({ ...s, ...patch }));
            else if (activeProviderCtx === 'driver')       setExtDriver(s => ({ ...s, ...patch }));
            else if (activeProviderCtx === 'guide_driver') setExtGuideDriver(s => ({ ...s, ...patch }));
            else                                           setExtVan(s => ({ ...s, ...patch }));
            setShowProviderModal(false);
          }}
        />
      )}
    </>
  );
}
