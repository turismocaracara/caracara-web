'use client';

import { useState } from 'react';

export interface RefundRow {
  id:            string;
  booking_code:  string;
  tour_name:     string;
  total_amount:  number | null;
  refund_amount: number | null;
  refund_status: string;
  cancelled_at:  string | null;
  client_name:   string;
  client_email:  string;
}

function fmtCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DevolucionesManager({ initialRows }: { initialRows: RefundRow[] }) {
  const [rows, setRows]     = useState(initialRows);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError]   = useState('');

  async function act(id: string, action: 'approve' | 'mark_processed') {
    setLoadingId(id);
    setError('');
    try {
      const res = await fetch('/api/admin/approve-refund', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ booking_id: id, action }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? 'Error'); return; }
      setRows(prev => action === 'approve'
        ? prev.map(r => r.id === id ? { ...r, refund_status: 'approved' } : r)
        : prev.filter(r => r.id !== id)
      );
    } finally {
      setLoadingId(null);
    }
  }

  const pending  = rows.filter(r => r.refund_status === 'pending_approval');
  const approved = rows.filter(r => r.refund_status === 'approved');

  function Row({ r, children }: { r: RefundRow; children: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-4 py-3 bg-white">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">
            {r.client_name} · <span className="font-mono text-xs text-teal">{r.booking_code}</span>
          </p>
          <p className="text-xs text-gray-400 truncate">
            {r.tour_name} · {r.client_email}
            {r.cancelled_at && <> · cancelada {fmtDate(r.cancelled_at)}</>}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-gray-900">{fmtCLP(r.refund_amount ?? 0)}</span>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Pendientes de aprobar ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl border border-gray-100">
            Sin solicitudes pendientes
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map(r => (
              <Row key={r.id} r={r}>
                <button
                  type="button"
                  onClick={() => act(r.id, 'approve')}
                  disabled={loadingId === r.id}
                  className="text-xs font-medium bg-teal text-white px-3 py-1.5 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {loadingId === r.id ? '…' : 'Aprobar'}
                </button>
              </Row>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Aprobadas — pendientes de procesar en MercadoPago ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl border border-gray-100">
            Sin devoluciones aprobadas
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {approved.map(r => (
              <Row key={r.id} r={r}>
                <button
                  type="button"
                  onClick={() => act(r.id, 'mark_processed')}
                  disabled={loadingId === r.id}
                  className="text-xs font-medium bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {loadingId === r.id ? '…' : 'Marcar procesada'}
                </button>
              </Row>
            ))}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-2">
          La devolución real del dinero se hace manualmente desde el panel de MercadoPago (no se ejecuta automáticamente desde aquí). Marca &quot;procesada&quot; una vez que hayas hecho la devolución ahí.
        </p>
      </section>
    </div>
  );
}
