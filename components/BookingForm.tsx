'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface BookingFormProps {
  tourName: string;
  tourSlug: string;
}

export default function BookingForm({ tourName, tourSlug: _tourSlug }: BookingFormProps) {
  const t = useTranslations('booking');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    passengers: '',
    notes: '',
  });

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const msg = encodeURIComponent(
      `*Solicitud de reserva — ${tourName}*\n\n` +
        `Nombre: ${form.name}\n` +
        `Email: ${form.email}\n` +
        `Teléfono: ${form.phone}\n` +
        `Fecha: ${form.date}\n` +
        `Pasajeros: ${form.passengers}\n` +
        `Notas: ${form.notes || 'Ninguna'}`
    );

    window.open(`https://wa.me/56991384957?text=${msg}`, '_blank');
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <p className="text-green-800 font-medium">{t('success')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-500 italic">{t('priceNote')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t('name')} *</label>
          <input
            name="name"
            required
            value={form.name}
            onChange={onChange}
            placeholder={t('namePlaceholder')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t('email')} *</label>
          <input
            name="email"
            type="email"
            required
            value={form.email}
            onChange={onChange}
            placeholder={t('emailPlaceholder')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t('phone')} *</label>
          <input
            name="phone"
            required
            value={form.phone}
            onChange={onChange}
            placeholder={t('phonePlaceholder')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t('date')} *</label>
          <input
            name="date"
            type="date"
            required
            value={form.date}
            onChange={onChange}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t('passengers')} *</label>
          <input
            name="passengers"
            type="number"
            min="1"
            max="9"
            required
            value={form.passengers}
            onChange={onChange}
            placeholder={t('passengersPlaceholder')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t('notes')}</label>
        <textarea
          name="notes"
          rows={3}
          value={form.notes}
          onChange={onChange}
          placeholder={t('notesPlaceholder')}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-orange hover:bg-orange-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors disabled:opacity-60"
      >
        {loading ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
