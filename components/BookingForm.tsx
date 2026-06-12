'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import BookingCalendar from './BookingCalendar';

interface BookingFormProps {
  tourName: string;
  tourSlug: string;
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

const COUNTRIES = [
  'Argentina', 'Australia', 'Bolivia', 'Brasil', 'Canadá', 'Chile', 'Colombia',
  'Ecuador', 'España', 'Estados Unidos', 'Francia', 'Alemania', 'Italia', 'México',
  'Nueva Zelanda', 'Paraguay', 'Perú', 'Portugal', 'Reino Unido', 'Suiza', 'Uruguay',
  'Venezuela', 'Otro',
];

const CANCELLATION_POLICY = [
  { days: '≥ 9 días', es: '100% de devolución', en: '100% refund', pt: '100% de reembolso' },
  { days: '7–8 días',  es: '75% de devolución',  en: '75% refund',  pt: '75% de reembolso'  },
  { days: '5–6 días',  es: '50% de devolución',  en: '50% refund',  pt: '50% de reembolso'  },
  { days: '3–4 días',  es: '25% de devolución',  en: '25% refund',  pt: '25% de reembolso'  },
  { days: '1–2 días',  es: 'Sin devolución',      en: 'No refund',   pt: 'Sem reembolso'     },
];

function Input({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">
        {label}{required && <span className="text-orange ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full';
const selectClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full bg-white';

export default function BookingForm({ tourName, tourSlug }: BookingFormProps) {
  const t   = useTranslations('booking');
  const locale = useLocale() as 'es' | 'en' | 'pt';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingCode, setBookingCode] = useState('');

  // Paso 1
  const [bookingType, setBookingType]     = useState<'private' | 'group'>('private');
  const [tourDate, setTourDate]           = useState('');
  const [dateIsForming, setDateIsForming]   = useState(false);
  const [availableSpots, setAvailableSpots] = useState(18);
  const [pax, setPax]                       = useState(2);

  function handleDateSelect(date: string, status: 'available' | 'forming' | 'full' | 'blocked' | 'past', spots: number) {
    setTourDate(date);
    const forming = status === 'forming';
    setDateIsForming(forming);
    setAvailableSpots(spots > 0 ? spots : 18);
    if (forming) setBookingType('group');
    // Ajustar pax si supera los cupos disponibles
    setPax(prev => Math.min(prev, spots > 0 ? spots : 18));
  }

  // Paso 2 — pasajeros
  const [passengers, setPassengers] = useState<PassengerData[]>([emptyPassenger()]);

  // Paso 3
  const [notes, setNotes] = useState('');

  // ─── Sincronizar array de pasajeros con pax ──────────────
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

  // ─── Validaciones por paso ────────────────────────────────
  const paxExceedsSpots = tourDate !== '' && pax > availableSpots;

  function step1Valid(): boolean {
    return tourDate !== '' && pax >= 1 && !paxExceedsSpots;
  }

  function step2Valid(): boolean {
    return passengers.every(p =>
      p.name.trim().length >= 2 &&
      p.id_number.trim().length >= 3 &&
      p.email.includes('@') &&
      p.phone.trim().length >= 6 &&
      p.country.trim().length >= 2
    );
  }

  // ─── Submit ───────────────────────────────────────────────
  async function handleSubmit() {
    setLoading(true);
    setError('');

    const payload = {
      tour_slug:    tourSlug,
      tour_date:    tourDate,
      booking_type: bookingType,
      pax,
      passengers:   passengers.map((p, i) => ({ ...p, is_lead: i === 0 })),
      locale,
      notes: notes || undefined,
    };

    try {
      const res = await fetch('/api/bookings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? t('error'));
      }

      const data = await res.json() as { booking_code: string };
      setBookingCode(data.booking_code);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  }

  // ─── Etiquetas i18n inline ───────────────────────────────
  const labels = {
    es: {
      step1Title:   'Detalles del tour',
      step2Title:   'Datos de los pasajeros',
      step3Title:   'Resumen y confirmación',
      private:      'Tour privado (van exclusiva)',
      group:        'Tour grupal (plaza compartida)',
      date:         'Fecha del tour',
      paxCount:     'Número de pasajeros',
      passengerN:   (n: number, lead: boolean) => lead ? `Pasajero líder (tú)` : `Pasajero ${n}`,
      fullName:     'Nombre completo',
      idType:       'Tipo de documento',
      idNumber:     'Número de documento',
      email:        'Email',
      phone:        'Teléfono (con código de país)',
      country:      'País de origen',
      rut:          'RUT',
      passport:     'Pasaporte',
      notes:        'Notas adicionales (opcional)',
      notesHint:    'Alergias, niños, movilidad reducida, etc.',
      policy:       'Política de cancelación',
      policyNote:   'La devolución requiere aprobación del administrador.',
      confirm:      'Confirmar reserva',
      back:         'Volver',
      next:         'Continuar',
      tourType:     'Modalidad',
      summary:      'Resumen de tu reserva',
      privateTourMsg: 'Te contactaremos por WhatsApp para coordinar el pago y confirmar tu reserva.',
      groupTourMsg:   'Tu reserva se confirma si el tour alcanza el mínimo de pasajeros antes de las 20:00 del día anterior.',
      days:         'antes',
    },
    en: {
      step1Title:   'Tour details',
      step2Title:   'Passenger information',
      step3Title:   'Summary & confirmation',
      private:      'Private tour (exclusive van)',
      group:        'Group tour (shared seats)',
      date:         'Tour date',
      paxCount:     'Number of passengers',
      passengerN:   (n: number, lead: boolean) => lead ? `Lead passenger (you)` : `Passenger ${n}`,
      fullName:     'Full name',
      idType:       'ID type',
      idNumber:     'ID number',
      email:        'Email',
      phone:        'Phone (with country code)',
      country:      'Country of origin',
      rut:          'RUT (Chilean ID)',
      passport:     'Passport',
      notes:        'Additional notes (optional)',
      notesHint:    'Allergies, children, reduced mobility, etc.',
      policy:       'Cancellation policy',
      policyNote:   'Refunds require administrator approval.',
      confirm:      'Confirm booking',
      back:         'Back',
      next:         'Continue',
      tourType:     'Tour type',
      summary:      'Booking summary',
      privateTourMsg: 'We will contact you via WhatsApp to arrange payment and confirm your booking.',
      groupTourMsg:   'Your booking is confirmed if the tour reaches the minimum passengers by 20:00 the day before.',
      days:         'before',
    },
    pt: {
      step1Title:   'Detalhes do tour',
      step2Title:   'Dados dos passageiros',
      step3Title:   'Resumo e confirmação',
      private:      'Tour privado (van exclusiva)',
      group:        'Tour em grupo (lugares compartilhados)',
      date:         'Data do tour',
      paxCount:     'Número de passageiros',
      passengerN:   (n: number, lead: boolean) => lead ? `Passageiro responsável (você)` : `Passageiro ${n}`,
      fullName:     'Nome completo',
      idType:       'Tipo de documento',
      idNumber:     'Número do documento',
      email:        'Email',
      phone:        'Telefone (com código do país)',
      country:      'País de origem',
      rut:          'RUT (ID chileno)',
      passport:     'Passaporte',
      notes:        'Observações adicionais (opcional)',
      notesHint:    'Alergias, crianças, mobilidade reduzida, etc.',
      policy:       'Política de cancelamento',
      policyNote:   'Os reembolsos requerem aprovação do administrador.',
      confirm:      'Confirmar reserva',
      back:         'Voltar',
      next:         'Continuar',
      tourType:     'Modalidade',
      summary:      'Resumo da sua reserva',
      privateTourMsg: 'Entraremos em contato pelo WhatsApp para combinar o pagamento e confirmar sua reserva.',
      groupTourMsg:   'Sua reserva é confirmada se o tour atingir o mínimo de passageiros até as 20:00 do dia anterior.',
      days:         'antes',
    },
  }[locale];

  // ─── Paso 5 — Confirmación ───────────────────────────────
  if (step === 5) {
    return (
      <div className="bg-teal/5 border border-teal/20 rounded-2xl p-8 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-teal/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-bold text-teal">{bookingCode}</p>
          <p className="text-ink font-semibold mt-1">{t('success')}</p>
        </div>
        <p className="text-sm text-gray-500 max-w-sm">
          {bookingType === 'private' ? labels.privateTourMsg : labels.groupTourMsg}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
              s < step ? 'bg-teal text-white' : s === step ? 'bg-teal text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {s < step ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            {s < 3 && <div className={`h-0.5 flex-1 transition-colors ${s < step ? 'bg-teal' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ─── Paso 1 ─────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <h3 className="font-semibold text-ink text-lg">{labels.step1Title}</h3>

          {/* Fecha — calendario con disponibilidad real */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">
              {labels.date}<span className="text-orange ml-0.5">*</span>
            </label>
            <div className="border border-gray-200 rounded-xl p-3">
              <BookingCalendar
                tourSlug={tourSlug}
                bookingType={bookingType}
                selected={tourDate}
                onSelect={handleDateSelect}
                locale={locale}
              />
            </div>
          </div>

          {/* Tipo de tour */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">{labels.tourType}<span className="text-orange ml-0.5">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(['private', 'group'] as const).map(type => {
                const disabledPrivate = type === 'private' && dateIsForming;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={disabledPrivate}
                    onClick={() => !disabledPrivate && setBookingType(type)}
                    title={disabledPrivate ? (locale === 'en' ? 'No private vans available on this date' : locale === 'pt' ? 'Sem vans disponíveis nesta data' : 'No hay vans libres esta fecha') : undefined}
                    className={`border-2 rounded-xl p-3 text-sm font-medium text-left transition-colors ${
                      disabledPrivate
                        ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                        : bookingType === type
                        ? 'border-teal bg-teal/5 text-teal'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {type === 'private' ? labels.private : labels.group}
                  </button>
                );
              })}
            </div>
            {dateIsForming && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                {locale === 'en'
                  ? 'This date only accepts group bookings — all private vans are taken.'
                  : locale === 'pt'
                  ? 'Esta data aceita apenas reservas em grupo — todas as vans privadas estão ocupadas.'
                  : 'Esta fecha solo acepta tour grupal — las vans privadas están ocupadas.'}
              </p>
            )}
          </div>

          {/* Pax */}
          <Input label={labels.paxCount} required>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handlePaxChange(pax - 1)}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-lg font-semibold hover:border-teal hover:text-teal transition-colors"
              >−</button>
              <span className="text-lg font-semibold w-8 text-center">{pax}</span>
              <button
                type="button"
                onClick={() => handlePaxChange(pax + 1)}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-lg font-semibold hover:border-teal hover:text-teal transition-colors"
              >+</button>
              <span className="text-sm text-gray-400 ml-1">(máx. 18)</span>
            </div>
          </Input>

          {paxExceedsSpots && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {locale === 'en'
                ? `Only ${availableSpots} spot(s) available on this date. Please choose another date or reduce the number of passengers.`
                : locale === 'pt'
                ? `Apenas ${availableSpots} vaga(s) disponível nesta data. Escolha outra data ou reduza o número de passageiros.`
                : `Solo quedan ${availableSpots} cupo(s) para este día. Elige otra fecha o reduce el número de pasajeros.`}
            </p>
          )}

          <button
            type="button"
            disabled={!step1Valid()}
            onClick={() => setStep(2)}
            className="bg-teal hover:bg-teal/90 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors mt-2"
          >
            {labels.next} →
          </button>
        </div>
      )}

      {/* ─── Paso 2 ─────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <h3 className="font-semibold text-ink text-lg">{labels.step2Title}</h3>

          {passengers.map((p, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4 flex flex-col gap-3 bg-gray-50/50">
              <p className="text-sm font-semibold text-teal border-b border-gray-100 pb-2">
                {labels.passengerN(i + 1, i === 0)}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input label={labels.fullName} required>
                  <input
                    value={p.name}
                    onChange={e => updatePassenger(i, 'name', e.target.value)}
                    placeholder="María García"
                    className={inputClass}
                  />
                </Input>

                <Input label={labels.idType} required>
                  <select
                    value={p.id_type}
                    onChange={e => updatePassenger(i, 'id_type', e.target.value as 'rut' | 'passport')}
                    className={selectClass}
                  >
                    <option value="passport">{labels.passport}</option>
                    <option value="rut">{labels.rut}</option>
                  </select>
                </Input>

                <Input label={labels.idNumber} required>
                  <input
                    value={p.id_number}
                    onChange={e => updatePassenger(i, 'id_number', e.target.value)}
                    placeholder={p.id_type === 'rut' ? '12.345.678-9' : 'AA123456'}
                    className={inputClass}
                  />
                </Input>

                <Input label={labels.country} required>
                  <select
                    value={p.country}
                    onChange={e => updatePassenger(i, 'country', e.target.value)}
                    className={selectClass}
                  >
                    <option value="">—</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Input>

                <Input label={labels.email} required>
                  <input
                    type="email"
                    value={p.email}
                    onChange={e => updatePassenger(i, 'email', e.target.value)}
                    placeholder="maria@email.com"
                    className={inputClass}
                  />
                </Input>

                <Input label={labels.phone} required>
                  <input
                    type="tel"
                    value={p.phone}
                    onChange={e => updatePassenger(i, 'phone', e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className={inputClass}
                  />
                </Input>
              </div>
            </div>
          ))}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:border-gray-300 transition-colors">
              ← {labels.back}
            </button>
            <button
              type="button"
              disabled={!step2Valid()}
              onClick={() => setStep(3)}
              className="flex-1 bg-teal hover:bg-teal/90 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {labels.next} →
            </button>
          </div>
        </div>
      )}

      {/* ─── Paso 3 ─────────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <h3 className="font-semibold text-ink text-lg">{labels.step3Title}</h3>

          {/* Resumen */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 flex flex-col gap-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">{labels.summary}</p>
            {[
              ['Tour', tourName],
              [labels.date, tourDate],
              [labels.tourType, bookingType === 'private' ? labels.private : labels.group],
              [labels.paxCount, String(pax)],
              [labels.email, passengers[0].email],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm gap-4">
                <span className="text-gray-500">{k}</span>
                <span className="text-ink font-medium text-right">{v}</span>
              </div>
            ))}
          </div>

          {/* Nota de pago */}
          <div className="bg-orange/5 border border-orange/20 rounded-xl p-4">
            <p className="text-sm text-gray-700">
              {bookingType === 'private' ? labels.privateTourMsg : labels.groupTourMsg}
            </p>
          </div>

          {/* Notas */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">{labels.notes}</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={labels.notesHint}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none"
            />
          </div>

          {/* Política de cancelación */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">{labels.policy}</p>
            <div className="flex flex-col gap-1">
              {CANCELLATION_POLICY.map(row => (
                <div key={row.days} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gray-400 w-14 text-right shrink-0">{row.days}</span>
                  <span className="text-gray-300">•</span>
                  <span>{row[locale]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">{labels.policyNote}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:border-gray-300 transition-colors">
              ← {labels.back}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="flex-1 bg-orange hover:bg-orange/90 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? '...' : labels.confirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
