'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ManualBookingForm, { type AdminTourOption } from './ManualBookingForm';
import { type Agency } from './AgencyRegistrationModal';
import { type ServiceProvider } from './ServiceProviderModal';

export default function NewBookingButton({
  tours,
  agencies = [],
  guides = [],
  vans = [],
  serviceProviders = [],
}: {
  tours:             AdminTourOption[];
  agencies?:         Agency[];
  guides?:           { id: string; name: string; role: string }[];
  vans?:             { id: string; name: string; plate: string | null; capacity: number }[];
  serviceProviders?: ServiceProvider[];
}) {
  const [open, setOpen]       = useState(false);
  const [success, setSuccess] = useState<{ code: string; status: string } | null>(null);
  const router                = useRouter();

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Bloquear scroll del body
  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden'; }
    else      { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function handleClose() {
    setOpen(false);
    setSuccess(null);
  }

  function handleSuccess(result: { code: string; status: string }) {
    setSuccess(result);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setSuccess(null); setOpen(true); }}
        className="flex items-center gap-1.5 bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 transition-colors whitespace-nowrap"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nueva reserva
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-3xl mx-4 my-6 bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-48px)]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-semibold text-gray-900 text-base">Nueva reserva manual</h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-6">
              {success ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="w-14 h-14 bg-teal/10 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-teal">{success.code}</p>
                    <p className="text-gray-700 font-semibold mt-1">
                      {success.status === 'confirmed' ? 'Reserva confirmada' : 'Reserva en espera de mínimo'}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500">Se envió un email de confirmación al cliente.</p>
                  <div className="flex gap-3 mt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 transition-colors"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSuccess(null); }}
                      className="border border-gray-200 text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      Crear otra
                    </button>
                  </div>
                </div>
              ) : (
                <ManualBookingForm
                  tours={tours}
                  agencies={agencies}
                  guides={guides}
                  vans={vans}
                  serviceProviders={serviceProviders}
                  onSuccess={handleSuccess}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
