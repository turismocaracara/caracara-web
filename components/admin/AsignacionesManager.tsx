'use client';

import { useState } from 'react';

export interface InstanceRow {
  id: string;
  tour_slug: string;
  tour_name: string;
  date: string;
  booking_type: string;
  current_pax: number;
  status: string;
}

export interface GuideOption {
  id: string;
  name: string;
  role: string;
}

export interface AssignmentRow {
  tour_instance_id: string;
  team_member_id: string;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
}

const TYPE_LABEL: Record<string, string> = { private: 'Privado', group: 'Grupal' };

export default function AsignacionesManager({
  instances,
  guides,
  initialAssignments,
  readOnly = false,
}: {
  instances: InstanceRow[];
  guides: GuideOption[];
  initialAssignments: AssignmentRow[];
  readOnly?: boolean;
}) {
  const [assignments, setAssignments] = useState<Record<string, string>>(
    Object.fromEntries(initialAssignments.map(a => [a.tour_instance_id, a.team_member_id]))
  );
  const [saving, setSaving] = useState<string | null>(null);

  async function assign(instanceId: string, teamMemberId: string) {
    setSaving(instanceId);
    try {
      if (!teamMemberId) {
        await fetch('/api/admin/assignments', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ tour_instance_id: instanceId }),
        });
        setAssignments(prev => {
          const next = { ...prev };
          delete next[instanceId];
          return next;
        });
        return;
      }
      const res = await fetch('/api/admin/assignments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tour_instance_id: instanceId, team_member_id: teamMemberId }),
      });
      if (res.ok) {
        setAssignments(prev => ({ ...prev, [instanceId]: teamMemberId }));
      }
    } finally {
      setSaving(null);
    }
  }

  // Agrupar por fecha
  const byDate = instances.reduce<Record<string, InstanceRow[]>>((acc, inst) => {
    (acc[inst.date] ??= []).push(inst);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort();

  if (dates.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-8 text-center bg-white rounded-xl border border-gray-100">
        Sin tours programados en los próximos 14 días
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {dates.map(date => (
        <section key={date}>
          <h2 className="text-sm font-semibold text-gray-700 capitalize mb-2">{fmtDate(date)}</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/60">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tipo</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Pax</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Guía / Conductor</th>
                </tr>
              </thead>
              <tbody>
                {byDate[date].map((inst, i) => (
                  <tr key={inst.id} className={i > 0 ? 'border-t border-gray-50' : ''}>
                    <td className="px-4 py-3 text-gray-800 font-medium">{inst.tour_name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{TYPE_LABEL[inst.booking_type] ?? inst.booking_type}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{inst.current_pax}</td>
                    <td className="px-4 py-3">
                      {readOnly ? (
                        <span className="text-xs font-medium text-teal">✓ Asignado a ti</span>
                      ) : (
                        <select
                          value={assignments[inst.id] ?? ''}
                          onChange={e => assign(inst.id, e.target.value)}
                          disabled={saving === inst.id}
                          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal bg-white disabled:opacity-50 min-w-[160px]"
                        >
                          <option value="">— Sin asignar —</option>
                          {guides.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
