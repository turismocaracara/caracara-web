'use client';

import { useState, Fragment } from 'react';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface PassengerInfo {
  name:       string;
  id_type:    string;
  id_number:  string;
  birth_date: string | null;
  is_lead:    boolean;
}

export interface InstanceRow {
  id:              string;
  tour_slug:       string;
  tour_name:       string;
  date:            string;
  booking_type:    string;
  current_pax:     number;
  status:          string;
  passengers?:     PassengerInfo[];
  tour_languages?: string[];
}

export interface GuideOption {
  id:   string;
  name: string;
  role: string;
}

export interface AssignmentRow {
  tour_instance_id: string;
  team_member_id:   string;
  role_in_tour:     string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
}

function fmtBirthDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const TYPE_LABEL:     Record<string, string> = { private: 'Privado', group: 'Grupal' };
const ID_TYPE_LABEL:  Record<string, string> = { rut: 'RUT', passport: 'Pasaporte' };
const LANGUAGE_LABEL: Record<string, string> = { es: 'Español', en: 'Inglés', pt: 'Portugués' };

// ─── Component ────────────────────────────────────────────────────────────────

type RoleKey = 'guide' | 'driver';
type AssignmentMap = Record<string, { guide?: string; driver?: string }>;

export default function AsignacionesManager({
  instances,
  guides,
  initialAssignments,
  readOnly = false,
}: {
  instances:          InstanceRow[];
  guides:             GuideOption[];
  initialAssignments: AssignmentRow[];
  readOnly?:          boolean;
}) {
  // Construir mapa { instanceId → { guide?: memberId, driver?: memberId } }
  const [assignments, setAssignments] = useState<AssignmentMap>(() => {
    const map: AssignmentMap = {};
    for (const a of initialAssignments) {
      map[a.tour_instance_id] ??= {};
      if (a.role_in_tour === 'guide')  map[a.tour_instance_id].guide  = a.team_member_id;
      if (a.role_in_tour === 'driver') map[a.tour_instance_id].driver = a.team_member_id;
    }
    return map;
  });

  const [saving,   setSaving]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(instanceId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(instanceId) ? next.delete(instanceId) : next.add(instanceId);
      return next;
    });
  }

  async function assign(instanceId: string, teamMemberId: string, role: RoleKey) {
    setSaving(`${instanceId}-${role}`);
    try {
      if (!teamMemberId) {
        // Limpiar asignación
        await fetch('/api/admin/assignments', {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ tour_instance_id: instanceId, role_in_tour: role }),
        });
        setAssignments(prev => {
          const next = { ...prev, [instanceId]: { ...prev[instanceId] } };
          delete next[instanceId][role];
          return next;
        });
        return;
      }
      const res = await fetch('/api/admin/assignments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tour_instance_id: instanceId,
          team_member_id:   teamMemberId,
          role_in_tour:     role,
        }),
      });
      if (res.ok) {
        setAssignments(prev => ({
          ...prev,
          [instanceId]: { ...prev[instanceId], [role]: teamMemberId },
        }));
      }
    } finally { setSaving(null); }
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

  const dropdown = (instanceId: string, role: RoleKey, label: string) => {
    const currentId = assignments[instanceId]?.[role] ?? '';
    const savingKey = `${instanceId}-${role}`;
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-gray-400 font-medium">{label}</span>
        <select
          value={currentId}
          onChange={e => assign(instanceId, e.target.value, role)}
          disabled={saving === savingKey}
          className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-teal bg-white disabled:opacity-50 min-w-[140px]"
        >
          <option value="">— Sin asignar —</option>
          {guides.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>
    );
  };

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
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Guía</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Conductor</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Pasajeros</th>
                </tr>
              </thead>
              <tbody>
                {byDate[date].map((inst, i) => {
                  const isExpanded = expanded.has(inst.id);
                  const passengers = inst.passengers ?? [];
                  return (
                    <Fragment key={inst.id}>
                      <tr className={i > 0 ? 'border-t border-gray-50' : ''}>
                        <td className="px-4 py-3 text-gray-800 font-medium">{inst.tour_name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{TYPE_LABEL[inst.booking_type] ?? inst.booking_type}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{inst.current_pax}</td>
                        {readOnly ? (
                          <td colSpan={2} className="px-4 py-3">
                            <span className="text-xs font-medium text-teal">✓ Asignado a ti</span>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-3">{dropdown(inst.id, 'guide', 'Guía')}</td>
                            <td className="px-4 py-3">{dropdown(inst.id, 'driver', 'Conductor')}</td>
                          </>
                        )}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(inst.id)}
                            disabled={passengers.length === 0}
                            className="text-xs font-medium text-teal hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-default"
                          >
                            {passengers.length === 0 ? 'Sin pasajeros' : isExpanded ? 'Ocultar ▾' : `Ver ${passengers.length} ▸`}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && passengers.length > 0 && (
                        <tr key={`${inst.id}-detail`} className="border-t border-gray-50 bg-gray-50/40">
                          <td colSpan={6} className="px-4 py-3">
                            {(inst.tour_languages?.length ?? 0) > 0 && (
                              <p className="text-xs text-gray-500 mb-2">
                                Idioma(s) del tour:{' '}
                                <span className="font-medium text-gray-700">
                                  {inst.tour_languages!.map(l => LANGUAGE_LABEL[l] ?? l).join(', ')}
                                </span>
                              </p>
                            )}
                            <div className="flex flex-col gap-1.5">
                              {passengers.map((p, idx) => (
                                <div key={idx} className="flex items-center gap-3 text-xs">
                                  <span className="font-medium text-gray-800 min-w-[160px]">
                                    {p.name}{p.is_lead && <span className="text-teal ml-1">(titular)</span>}
                                  </span>
                                  <span className="text-gray-500">
                                    {ID_TYPE_LABEL[p.id_type] ?? p.id_type}: {p.id_number}
                                  </span>
                                  {p.is_lead && p.birth_date && (
                                    <span className="text-gray-400">· Nac. {fmtBirthDate(p.birth_date)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
