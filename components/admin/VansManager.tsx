'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const VanEditModal = dynamic(() => import('./VanEditModal'), { ssr: false });

export interface VanRow {
  id:       string;
  name:     string;
  brand:    string | null;
  model:    string | null;
  year:     number | null;
  capacity: number;
  plate:    string | null;
  color:    string | null;
  notes:    string | null;
  active:   boolean;
}

export interface VanBlockRow {
  id:     string;
  van_id: string;
  date:   string;
  reason: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function VansManager({
  vans: initialVans,
  initialBlocks,
}: {
  vans:          VanRow[];
  initialBlocks: VanBlockRow[];
}) {
  const [vansList,   setVansList]   = useState<VanRow[]>(initialVans);
  const [editTarget, setEditTarget] = useState<VanRow | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);

  const [blocks,   setBlocks]   = useState(initialBlocks);
  const [vanId,    setVanId]    = useState(initialVans[0]?.id ?? '');
  const [date,     setDate]     = useState('');
  const [reason,   setReason]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [delBlock, setDelBlock] = useState<string | null>(null);
  const [blockErr, setBlockErr] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  function handleSaved(saved: VanRow) {
    setVansList(prev => {
      const idx = prev.findIndex(v => v.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    if (!vanId) setVanId(saved.id);
    setEditTarget(null);
  }

  async function deleteVan(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/vans/${id}`, { method: 'DELETE' });
      setVansList(prev => prev.filter(v => v.id !== id));
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  }

  async function addBlock() {
    if (!vanId || !date) return;
    setSaving(true);
    setBlockErr('');
    try {
      const res = await fetch('/api/admin/van-blocks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ van_id: vanId, date, reason: reason || undefined }),
      });
      const data = await res.json() as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) { setBlockErr(data.error ?? 'Error'); return; }
      setBlocks(prev => [
        ...prev,
        { id: data.id!, van_id: vanId, date, reason: reason || null },
      ].sort((a, b) => a.date.localeCompare(b.date)));
      setDate('');
      setReason('');
    } finally {
      setSaving(false);
    }
  }

  async function removeBlock(id: string) {
    setDelBlock(id);
    try {
      await fetch('/api/admin/van-blocks', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      setBlocks(prev => prev.filter(b => b.id !== id));
    } finally {
      setDelBlock(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">

      {/* ── Flota ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Flota ({vansList.length})
          </h2>
          <button
            type="button"
            onClick={() => setEditTarget('new')}
            className="flex items-center gap-1.5 bg-teal text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-teal/90 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Nueva van
          </button>
        </div>

        {vansList.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 py-10 flex flex-col items-center gap-2 text-gray-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <p className="text-sm">Sin vans registradas</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {vansList.map(van => (
              <div
                key={van.id}
                className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-4"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{van.name}</p>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      van.active ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {van.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {[van.brand, van.model, van.year].filter(Boolean).join(' ')}
                    {(van.brand || van.model || van.year) && ' · '}
                    {van.capacity} pax
                    {van.plate && ` · ${van.plate}`}
                    {van.color && ` · ${van.color}`}
                  </p>
                  {van.notes && (
                    <p className="text-xs text-gray-300 mt-0.5 truncate">{van.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {confirmId === van.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">¿Eliminar?</span>
                      <button
                        type="button"
                        onClick={() => deleteVan(van.id)}
                        disabled={deletingId === van.id}
                        className="text-xs text-red-600 font-semibold hover:underline disabled:opacity-40"
                      >
                        {deletingId === van.id ? '…' : 'Sí'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditTarget(van)}
                        className="text-xs text-teal font-medium hover:underline px-2 py-1"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(van.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                      >
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Bloqueos ── */}
      {vansList.length > 0 && (
        <>
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Bloquear fecha (mantención / uso personal)
            </h2>
            <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Van</label>
                  <select
                    value={vanId}
                    onChange={e => setVanId(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white"
                  >
                    {vansList.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Fecha</label>
                  <input
                    type="date"
                    min={today}
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-500">Motivo (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Revisión técnica"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
                  />
                </div>
              </div>
              {blockErr && <p className="text-xs text-red-600">{blockErr}</p>}
              <button
                type="button"
                onClick={addBlock}
                disabled={saving || !vanId || !date}
                className="self-start bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando…' : 'Bloquear fecha'}
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Bloqueos próximos ({blocks.filter(b => b.date >= today).length})
            </h2>
            {blocks.filter(b => b.date >= today).length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl border border-gray-100">
                Sin bloqueos programados
              </p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 bg-gray-50/60">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Van</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Fecha</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Motivo</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {blocks
                      .filter(b => b.date >= today)
                      .map((b, i) => {
                        const vanName = vansList.find(v => v.id === b.van_id)?.name ?? '—';
                        return (
                          <tr key={b.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                            <td className="px-4 py-3 text-gray-700 font-medium">{vanName}</td>
                            <td className="px-4 py-3 text-gray-600">{fmtDate(b.date)}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{b.reason ?? '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeBlock(b.id)}
                                disabled={delBlock === b.id}
                                className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                              >
                                {delBlock === b.id ? '…' : 'Eliminar'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal */}
      {editTarget !== null && (
        <VanEditModal
          van={editTarget === 'new' ? null : editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
