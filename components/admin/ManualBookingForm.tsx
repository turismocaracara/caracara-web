'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BookingCalendar from '@/components/BookingCalendar';

export interface AdminTourOption {
  slug: string;
  name_es: string;
}

interface PassengerData {
  name:      string;
  id_type:   'rut' | 'passport';
  id_number: string;
  email:     string;
  phone:     string;
  country:   string;
}

function emptyPassenger(): PassengerData {
  return { name: '', id_type: 'passport', id_number: '', email: '', phone: '', country: '' };
}

const inputClass  = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full';
const selectClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full bg-white';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-orange ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function ManualBookingForm({ tours }: { tours: AdminTourOption[] }) {
  const router = useRouter();

  const [tourSlug, setTourSlug]       = useState(tours[0]?.slug ?? '');
  const [bookingType, setBookingType] = useState<'private' | 'group'>('private');
  const [tourDate, setTourDate]       = useState('');
  const [availableSpots, setAvailableSpots] = useState(18);
  const [pax, setPax]                 = useState(1);
  const [passengers, setPassengers]   = useState<PassengerData[]>([emptyPassenger()]);
  const [notes, setNotes]             = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState<{ code: string; status: string } | null>(null);

  function handleDateSelect(date: string, status: 'available' | 'forming' | 'full' | 'blocked' | 'past', spots: number) {
    setTourDate(date);
    setAvailableSpots(spots > 0 ? spots : 18);
    if (status === 'forming') setBookingType('group');
    setPax(prev => Math.min(prev, spots > 0 ? spots : 18));
  }

  function handlePaxChange(n: number) {
    const newPax = Math.max(1, Math.min(18, n));
    setPax(newPax);
    setPassengers(prev => {
      if (prev.length === newPax) return prev;
      if (prev.length < newPax) return [...prev, ...Array.from({ length: newPax - prev.length }, emptyPassenger)];
      return prev.slice(0, newPax);
    });
  }

  function updatePassenger(i: number, field: keyof PassengerData, value: string) {
    setPassengers(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  const paxExceedsSpots = tourDate !== '' && pax > availableSpots;

  function formValid(): boolean {
    if (!tourSlug || !tourDate || paxExceedsSpots) return false;
    return passengers.every(p =>
      p.name.trim().length >= 2 &&
      p.id_number.trim().length >= 3 &&
      p.email.includes('@') &&
      p.phone.trim().length >= 6 &&
      p.country.trim().length >= 2
    );
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/manual-booking', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tour_slug:    tourSlug,
          tour_date:    tourDate,
          booking_type: bookingType,
          pax,
          passengers:   passengers.map((p, i) => ({ ...p, is_lead: i === 0 })),
          locale:       'es',
          notes:        notes || undefined,
          total_amount: totalAmount ? Number(totalAmount) : undefined,
        }),
      });
      const body = await res.json().catch(() => ({})) as { booking_code?: string; status?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Error al crear la reserva');
      setSuccess({ code: body.booking_code!, status: body.status! });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la reserva');
    } finally {
      setLoading(false);
    }
  }

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
          <p className="text-ink font-semibold mt-1">
            {success.status === 'confirmed' ? 'Reserva confirmada' : 'Reserva en espera de mínimo'}
          </p>
        </div>
        <p className="text-sm text-gray-500">
          Se envió un email de confirmación al cliente con su código de reserva.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => router.push('/admin/reservas')}
            className="bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 transition-colors"
          >
            Ver reservas
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:border-gray-300 transition-colors"
          >
            Crear otra
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Tour + fecha + tipo + pax */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-gray-800 text-sm">Tour y fecha</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tour" required>
            <select value={tourSlug} onChange={e => setTourSlug(e.target.value)} className={selectClass}>
              {tours.map(t => <option key={t.slug} value={t.slug}>{t.name_es}</option>)}
            </select>
          </Field>

          <Field label="Modalidad" required>
            <div className="grid grid-cols-2 gap-2">
              {(['private', 'group'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBookingType(type)}
                  className={`border-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    bookingType === type ? 'border-teal bg-teal/5 text-teal' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {type === 'private' ? 'Privado' : 'Grupal'}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Fecha del tour" required>
          <div className="border border-gray-200 rounded-xl p-3 max-w-sm">
            <BookingCalendar
              tourSlug={tourSlug}
              bookingType={bookingType}
              selected={tourDate}
              onSelect={handleDateSelect}
              locale="es"
            />
          </div>
        </Field>

        <Field label="Número de pasajeros" required>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => handlePaxChange(pax - 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center font-semibold hover:border-teal hover:text-teal transition-colors">−</button>
            <span className="text-base font-semibold w-6 text-center">{pax}</span>
            <button type="button" onClick={() => handlePaxChange(pax + 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center font-semibold hover:border-teal hover:text-teal transition-colors">+</button>
          </div>
        </Field>

        {paxExceedsSpots && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Solo quedan {availableSpots} cupo(s) para este día. Elige otra fecha o reduce el número de pasajeros.
          </p>
        )}
      </div>

      {/* Pasajeros */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-gray-800 text-sm">Datos de los pasajeros</h3>
        {passengers.map((p, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
            <p className="text-xs font-semibold text-teal">{i === 0 ? 'Pasajero líder (contacto)' : `Pasajero ${i + 1}`}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre completo" required>
                <input value={p.name} onChange={e => updatePassenger(i, 'name', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Tipo de documento" required>
                <select value={p.id_type} onChange={e => updatePassenger(i, 'id_type', e.target.value as 'rut' | 'passport')} className={selectClass}>
                  <option value="passport">Pasaporte</option>
                  <option value="rut">RUT</option>
                </select>
              </Field>
              <Field label="Número de documento" required>
                <input value={p.id_number} onChange={e => updatePassenger(i, 'id_number', e.target.value)} className={inputClass} />
              </Field>
              <Field label="País de origen" required>
                <input value={p.country} onChange={e => updatePassenger(i, 'country', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Email" required>
                <input type="email" value={p.email} onChange={e => updatePassenger(i, 'email', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Teléfono" required>
                <input type="tel" value={p.phone} onChange={e => updatePassenger(i, 'phone', e.target.value)} className={inputClass} />
              </Field>
            </div>
          </div>
        ))}
      </div>

      {/* Notas + monto */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-gray-800 text-sm">Detalles adicionales</h3>
        <Field label="Monto total cobrado (CLP, opcional)">
          <input
            type="number"
            min={0}
            placeholder="Ej: 180000"
            value={totalAmount}
            onChange={e => setTotalAmount(e.target.value)}
            className={`${inputClass} max-w-xs`}
          />
        </Field>
        <Field label="Notas internas (opcional)">
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Forma de pago, acuerdos especiales, etc."
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none"
          />
        </Field>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="button"
        disabled={!formValid() || loading}
        onClick={handleSubmit}
        className="self-start bg-teal text-white font-semibold px-6 py-3 rounded-xl hover:bg-teal/90 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creando reserva…' : 'Crear reserva'}
      </button>
    </div>
  );
}
