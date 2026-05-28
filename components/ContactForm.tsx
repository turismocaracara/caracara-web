'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function ContactForm() {
  const t = useTranslations('contact');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const msg = encodeURIComponent(
      `*Mensaje desde la web*\n\n` +
        `Nombre: ${form.name}\n` +
        `Email: ${form.email}\n` +
        `Teléfono: ${form.phone}\n\n` +
        `Mensaje: ${form.message}`
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
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t('phone')}</label>
        <input
          name="phone"
          value={form.phone}
          onChange={onChange}
          placeholder={t('phonePlaceholder')}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t('message')} *</label>
        <textarea
          name="message"
          required
          rows={5}
          value={form.message}
          onChange={onChange}
          placeholder={t('messagePlaceholder')}
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
