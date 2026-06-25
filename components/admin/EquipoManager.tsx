'use client';

import { useState } from 'react';

export interface TeamMemberRow {
  id: string;
  name: string;
  email: string | null;
  role: 'admin' | 'admin_secondary' | 'guide';
  is_admin_secondary: boolean;
  is_guide: boolean;
  permissions: Record<string, boolean>;
  active: boolean;
  created_at: string;
}

const PERMISSIONS = [
  { key: 'manual_booking',  label: 'Reservas manuales',  desc: 'Crear reservas sin aprobación' },
  { key: 'view_financials', label: 'Ver finanzas',        desc: 'Contabilidad y costos' },
  { key: 'manage_vans',     label: 'Gestionar vans',      desc: 'Mantenciones y bloqueos' },
  { key: 'manage_team',     label: 'Gestionar equipo',    desc: 'Agregar y editar miembros' },
  { key: 'view_reports',    label: 'Ver reportes',        desc: 'Reportes de operación' },
] as const;

type PermKey = typeof PERMISSIONS[number]['key'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Admin secundario y guía no son excluyentes — alguien puede tener ambos a la vez
// (ej. lleva la oficina con ciertos permisos Y también sale a guiar tours puntuales).
function RoleBadges({ member }: { member: { role: string; is_admin_secondary: boolean; is_guide: boolean } }) {
  if (member.role === 'admin') {
    return (
      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
        Admin
      </span>
    );
  }
  return (
    <div className="flex gap-1.5">
      {member.is_admin_secondary && (
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
          Admin secundario
        </span>
      )}
      {member.is_guide && (
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-teal/10 text-teal border-teal/20">
          Guía / Conductor
        </span>
      )}
      {!member.is_admin_secondary && !member.is_guide && (
        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
          Sin rol asignado
        </span>
      )}
    </div>
  );
}

// ── Selector de rol (Admin | Admin secundario / Guía combinables) ───────────
function RoleSelector({
  isAdmin, isAdminSecondary, isGuide,
  onChange,
}: {
  isAdmin: boolean;
  isAdminSecondary: boolean;
  isGuide: boolean;
  onChange: (next: { isAdmin: boolean; isAdminSecondary: boolean; isGuide: boolean }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-500">Rol</label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={() => onChange({ isAdmin: !isAdmin, isAdminSecondary, isGuide })}
          className="accent-teal"
        />
        Admin (acceso total)
      </label>
      {!isAdmin && (
        <div className="flex flex-col gap-1.5 pl-1">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isAdminSecondary}
              onChange={() => onChange({ isAdmin, isAdminSecondary: !isAdminSecondary, isGuide })}
              className="accent-teal"
            />
            Admin secundario — permisos configurables
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isGuide}
              onChange={() => onChange({ isAdmin, isAdminSecondary, isGuide: !isGuide })}
              className="accent-teal"
            />
            Guía / Conductor — sin permisos, solo ve sus tours asignados
          </label>
        </div>
      )}
    </div>
  );
}

// ── Fila editable ────────────────────────────────────────────────────────────
function MemberRow({
  member,
  isCurrentUser,
  onUpdate,
  onDelete,
}: {
  member: TeamMemberRow;
  isCurrentUser: boolean;
  onUpdate: (id: string, patch: Partial<TeamMemberRow>) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded,         setExpanded]         = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [isAdmin,          setIsAdmin]          = useState(member.role === 'admin');
  const [isAdminSecondary, setIsAdminSecondary] = useState(member.is_admin_secondary);
  const [isGuide,          setIsGuide]          = useState(member.is_guide);
  const [perms,            setPerms]            = useState<Record<string, boolean>>(member.permissions ?? {});
  const [active,           setActive]           = useState(member.active);
  const [deleting,         setDeleting]         = useState(false);

  const isDirty =
    isAdmin          !== (member.role === 'admin') ||
    isAdminSecondary !== member.is_admin_secondary ||
    isGuide          !== member.is_guide           ||
    active           !== member.active             ||
    JSON.stringify(perms) !== JSON.stringify(member.permissions ?? {});

  function handleRoleChange(next: { isAdmin: boolean; isAdminSecondary: boolean; isGuide: boolean }) {
    setIsAdmin(next.isAdmin);
    setIsAdminSecondary(next.isAdmin ? false : next.isAdminSecondary);
    setIsGuide(next.isAdmin ? false : next.isGuide);
  }

  async function save() {
    setSaving(true);
    try {
      const role = isAdmin ? 'admin' : isAdminSecondary ? 'admin_secondary' : 'guide';
      const patch: Record<string, unknown> = {};
      if (role             !== member.role)             patch.role               = role;
      if (isAdminSecondary !== member.is_admin_secondary) patch.is_admin_secondary = isAdminSecondary;
      if (isGuide          !== member.is_guide)           patch.is_guide           = isGuide;
      if (active           !== member.active)             patch.active             = active;
      if (JSON.stringify(perms) !== JSON.stringify(member.permissions ?? {})) patch.permissions = perms;

      const res = await fetch(`/api/admin/team/${member.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(patch),
      });
      if (res.ok) {
        onUpdate(member.id, {
          role: role as TeamMemberRow['role'],
          is_admin_secondary: isAdminSecondary,
          is_guide: isGuide,
          active,
          permissions: perms,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`¿Eliminar a ${member.name} del equipo?`)) return;
    setDeleting(true);
    await fetch(`/api/admin/team/${member.id}`, { method: 'DELETE' });
    onDelete(member.id);
  }

  function togglePerm(key: PermKey) {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className={`border-b border-gray-50 last:border-0 ${!active ? 'opacity-50' : ''}`}>
      {/* Fila principal */}
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Avatar inicial */}
        <div className="w-8 h-8 rounded-full bg-teal/10 text-teal flex items-center justify-center font-semibold text-sm shrink-0">
          {member.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{member.name}</p>
          <p className="text-xs text-gray-400 truncate">
            {member.email ?? '—'} · desde {fmtDate(member.created_at)}
          </p>
        </div>

        <RoleBadges member={member} />

        {/* Toggle activo */}
        <button
          type="button"
          onClick={() => {
            if (isCurrentUser) return;
            setActive(a => !a);
          }}
          title={isCurrentUser ? 'No puedes desactivarte a ti mismo' : undefined}
          disabled={isCurrentUser}
          className={`relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 disabled:opacity-30 focus:outline-none ${
            active ? 'bg-teal' : 'bg-gray-200'
          }`}
        >
          <span className={`absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform duration-200 ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>

        {/* Editar */}
        {!isCurrentUser && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-2 py-1 rounded hover:bg-gray-50"
          >
            {expanded ? 'Cerrar' : 'Editar'}
          </button>
        )}
      </div>

      {/* Panel de edición */}
      {expanded && (
        <div className="bg-gray-50/60 px-4 py-4 flex flex-col gap-4 border-t border-gray-100">
          <RoleSelector
            isAdmin={isAdmin}
            isAdminSecondary={isAdminSecondary}
            isGuide={isGuide}
            onChange={handleRoleChange}
          />

          {/* Permisos — solo si tiene el flag de admin secundario */}
          {isAdminSecondary && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-500">Permisos</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PERMISSIONS.map(p => (
                  <label
                    key={p.key}
                    className="flex items-start gap-2.5 bg-white border border-gray-100 rounded-lg px-3 py-2.5 cursor-pointer hover:border-gray-200 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!perms[p.key]}
                      onChange={() => togglePerm(p.key)}
                      className="mt-0.5 accent-teal"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-800">{p.label}</p>
                      <p className="text-[11px] text-gray-400">{p.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-3">
            {isDirty && (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="bg-teal text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            )}
            <button
              type="button"
              onClick={remove}
              disabled={deleting}
              className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40 ml-auto"
            >
              {deleting ? 'Eliminando…' : 'Eliminar del equipo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulario de invite ─────────────────────────────────────────────────────
function InviteForm({ onInvited }: { onInvited: (m: TeamMemberRow) => void }) {
  const [email,            setEmail]            = useState('');
  const [name,             setName]             = useState('');
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [isAdminSecondary, setIsAdminSecondary] = useState(false);
  const [isGuide,          setIsGuide]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');
  const [done,             setDone]             = useState(false);

  function handleRoleChange(next: { isAdmin: boolean; isAdminSecondary: boolean; isGuide: boolean }) {
    setIsAdmin(next.isAdmin);
    setIsAdminSecondary(next.isAdmin ? false : next.isAdminSecondary);
    setIsGuide(next.isAdmin ? false : next.isGuide);
  }

  async function submit() {
    if (!email || !name) return;
    setSaving(true);
    setError('');
    try {
      const role = isAdmin ? 'admin' : isAdminSecondary ? 'admin_secondary' : 'guide';
      const res = await fetch('/api/admin/team', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email, name, role,
          is_admin_secondary: isAdminSecondary,
          is_guide: isGuide,
          permissions: {},
        }),
      });
      const data = await res.json() as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Error'); return; }
      onInvited({
        id:          data.id!,
        name,
        email,
        role:        role as TeamMemberRow['role'],
        is_admin_secondary: isAdminSecondary,
        is_guide:    isGuide,
        permissions: {},
        active:      true,
        created_at:  new Date().toISOString(),
      });
      setEmail(''); setName(''); setIsAdmin(false); setIsAdminSecondary(false); setIsGuide(true);
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-700">Invitar nuevo miembro</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Nombre</label>
          <input
            type="text"
            placeholder="Sebastián Torres"
            value={name}
            onChange={e => setName(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Email</label>
          <input
            type="email"
            placeholder="nombre@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
        </div>
      </div>

      <RoleSelector
        isAdmin={isAdmin}
        isAdminSecondary={isAdminSecondary}
        isGuide={isGuide}
        onChange={handleRoleChange}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
      {done  && (
        <p className="text-xs text-teal font-medium">
          ✓ Miembro agregado y email de activación enviado
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={saving || !email || !name}
        className="self-start bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Enviando invitación…' : 'Enviar invitación'}
      </button>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function EquipoManager({
  initialMembers,
  currentUserEmail,
}: {
  initialMembers:   TeamMemberRow[];
  currentUserEmail: string;
}) {
  const [members, setMembers] = useState(initialMembers);

  function handleUpdate(id: string, patch: Partial<TeamMemberRow>) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  function handleDelete(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id));
  }

  function handleInvited(m: TeamMemberRow) {
    setMembers(prev => [...prev, m]);
  }

  function rank(m: TeamMemberRow) {
    if (m.role === 'admin') return 0;
    if (m.is_admin_secondary) return 1;
    if (m.is_guide) return 2;
    return 3;
  }
  const sorted = [...members].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="flex flex-col gap-8">
      {/* Lista de miembros */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Miembros ({members.length})
        </h2>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {sorted.map(m => (
            <MemberRow
              key={m.id}
              member={m}
              isCurrentUser={m.email === currentUserEmail}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
          {members.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Sin miembros aún
            </p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {members.filter(m => m.active).length} activos · {members.filter(m => !m.active).length} inactivos
        </p>
      </section>

      {/* Invite form */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Agregar miembro
        </h2>
        <InviteForm onInvited={handleInvited} />
        <p className="text-xs text-gray-400 mt-2">
          Se enviará un email con un link de activación para que el miembro cree su contraseña.
        </p>
      </section>

      {/* Referencia de permisos */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Referencia de permisos (Admin secundario)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PERMISSIONS.map(p => (
            <div key={p.key} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-700">{p.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{p.desc}</p>
              <p className="text-[10px] font-mono text-gray-300 mt-1">{p.key}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
