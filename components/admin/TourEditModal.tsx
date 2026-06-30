'use client';

import { useEffect, useState, useCallback } from 'react';
import TourEditForm, { type TourDetail, type ScheduleRow } from './TourEditForm';

interface ModalState {
  tour: TourDetail | null;
  schedules: ScheduleRow[];
  loading: boolean;
  error: string;
}

export default function TourEditModal({
  slug,
  onClose,
  onSaved,
}: {
  slug: string | null; // null = new tour
  onClose: () => void;
  onSaved: (slug: string, nameEs: string) => void;
}) {
  const [state, setState] = useState<ModalState>({
    tour:      null,
    schedules: [],
    loading:   slug !== null, // if editing, need to load; if new, no load
    error:     '',
  });

  const loadTour = useCallback(async () => {
    if (slug === null) return;
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const [tourRes, schedRes] = await Promise.all([
        fetch(`/api/admin/tours/${slug}`),
        fetch(`/api/admin/tour-schedules?slug=${slug}`),
      ]);
      if (!tourRes.ok) throw new Error('No se pudo cargar el tour');
      const tour = await tourRes.json() as TourDetail;
      const schedules = schedRes.ok ? (await schedRes.json() as ScheduleRow[]) : [];
      setState({ tour, schedules, loading: false, error: '' });
    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Error al cargar',
      }));
    }
  }, [slug]);

  useEffect(() => {
    loadTour();
  }, [loadTour]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  function handleSaved(savedSlug: string) {
    // Pass back slug + name so the table can update
    const nameEs = state.tour?.name_es ?? '';
    onSaved(savedSlug, nameEs);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl mx-4 my-6 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-48px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">
              {slug === null ? 'Nuevo tour' : (state.tour?.name_es ?? 'Editar tour')}
            </h2>
            {state.tour?.slug && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">{state.tour.slug}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-6">
          {state.loading && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <svg className="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Cargando…
            </div>
          )}

          {state.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {state.error}
              <button onClick={loadTour} className="ml-2 underline">Reintentar</button>
            </div>
          )}

          {!state.loading && !state.error && (
            <TourEditForm
              tour={state.tour}
              initialSchedules={state.schedules}
              onSaved={handleSaved}
            />
          )}
        </div>
      </div>
    </div>
  );
}
