'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface TeamMemberRow {
  id:                 string;
  name:               string;
  email:              string | null;
  role:               'admin' | 'admin_secondary' | 'guide';
  is_admin_secondary: boolean;
  is_guide:           boolean;
  permissions:        Record<string, boolean>;
  active:             boolean;
  created_at:         string;
  // Perfil personal
  phone:              string | null;
  emergency_name:     string | null;
  emergency_phone:    string | null;
  rut:                string | null;
  birthdate:          string | null;
  address:            string | null;
  civil_status:       string | null;
  blood_type:         string | null;
  allergies:          string | null;
  notes:              string | null;
  // Habilitaciones
  languages:          string[] | null;
  license_class:      string | null;
  // Vínculo laboral
  employment_type:    string | null;
  contract_type:      string | null;
  contract_start:     string | null;
  contract_end:       string | null;
  afp:                string | null;
  health_insurance_type: string | null;
  health_insurance_name: string | null;
  honorarios_payment_type: string | null;
  // Financiero (solo si canViewFinancials)
  salary_base:              number | null;
  has_bonus:                boolean | null;
  bonus_description:        string | null;
  honorarios_rate_per_tour: number | null;
  bank_name:                string | null;
  bank_account_type:        string | null;
  bank_account_number:      string | null;
}

interface MemberDocument {
  id:         string;
  type:       string;
  expires_at: string | null;
  notes:      string | null;
  file_url:   string | null;
  updated_at: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PERMISSIONS = [
  { key: 'manual_booking',  label: 'Reservas manuales',  desc: 'Crear reservas sin aprobación' },
  { key: 'view_financials', label: 'Ver finanzas',        desc: 'Contabilidad y costos' },
  { key: 'manage_vans',     label: 'Gestionar vans',      desc: 'Mantenciones y bloqueos' },
  { key: 'manage_team',     label: 'Gestionar equipo',    desc: 'Agregar y editar miembros' },
  { key: 'view_reports',    label: 'Ver reportes',        desc: 'Reportes de operación' },
] as const;

const DOC_TYPES = [
  'contrato','cedula','licencia','primeros_auxilios',
  'certificado_antecedentes','psicotecnico','examen_medico','otro',
] as const;

const DOC_LABELS: Record<string, string> = {
  contrato:                  'Contrato de trabajo',
  cedula:                    'Cédula de identidad',
  licencia:                  'Licencia de conducir',
  primeros_auxilios:         'Cert. primeros auxilios',
  certificado_antecedentes:  'Cert. antecedentes',
  psicotecnico:              'Examen psicotécnico',
  examen_medico:             'Examen médico',
  otro:                      'Otro',
};

const LANGUAGES_OPTIONS = ['Español','Inglés','Portugués','Francés','Alemán'];
const LICENSE_OPTIONS   = ['A1','A2','B','C','D','E'];
const CIVIL_STATUS_OPTIONS = [
  { value: 'soltero',     label: 'Soltero/a' },
  { value: 'casado',      label: 'Casado/a' },
  { value: 'divorciado',  label: 'Divorciado/a' },
  { value: 'viudo',       label: 'Viudo/a' },
  { value: 'conviviente', label: 'Conviviente civil' },
];

const ROLE_COLOR: Record<string, string> = {
  admin:           'bg-purple-100 text-purple-700',
  admin_secondary: 'bg-blue-100 text-blue-700',
  guide:           'bg-teal/10 text-teal',
};

const ic = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string) {
  return Math.floor(
    (new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86_400_000
  );
}

type DocStatus = 'ok' | 'soon' | 'expired' | 'missing';

function docStatus(expires: string | null): DocStatus {
  if (!expires) return 'missing';
  const d = daysUntil(expires);
  if (d < 0)  return 'expired';
  if (d < 30) return 'soon';
  return 'ok';
}

function isPdf(url: string) { return url.toLowerCase().includes('.pdf'); }

function DocStatusIcon({ status }: { status: DocStatus }) {
  if (status === 'ok')      return <span className="text-green-500 font-bold text-sm">✓</span>;
  if (status === 'soon')    return <span className="text-amber-500 font-bold text-sm">!</span>;
  if (status === 'expired') return <span className="text-red-500 font-bold text-sm">✗</span>;
  return <span className="text-gray-300 text-sm">—</span>;
}

function FileDocLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-teal hover:underline font-medium">
      {isPdf(url) ? '📄' : '🖼️'} Ver
    </a>
  );
}

function roleBadgeLabel(m: TeamMemberRow) {
  if (m.role === 'admin') return 'Admin';
  const parts: string[] = [];
  if (m.is_admin_secondary) parts.push('Admin sec.');
  if (m.is_guide)           parts.push('Guía');
  return parts.join(' · ') || 'Sin rol';
}

function avatarColor(m: TeamMemberRow) {
  if (m.role === 'admin')      return 'bg-purple-100 text-purple-700';
  if (m.is_admin_secondary)   return 'bg-blue-100 text-blue-700';
  if (m.is_guide)             return 'bg-teal/10 text-teal';
  return 'bg-gray-100 text-gray-500';
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadMemberDoc(file: File, memberId: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('member_id', memberId);
  const res  = await fetch('/api/admin/team/upload-document', { method: 'POST', body: form });
  const data = await res.json() as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Error al subir archivo');
  return data.url!;
}

// ─── FileInput ────────────────────────────────────────────────────────────────

function FileInput({
  existingUrl,
  pendingFile,
  onChange,
  required,
}: {
  existingUrl: string | null;
  pendingFile: File | null;
  onChange:    (f: File | null) => void;
  required?:   boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-gray-500">
        Documento{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      {pendingFile ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-700 text-xs flex-1 truncate">📎 {pendingFile.name}</span>
          <button type="button"
            onClick={() => { onChange(null); if (ref.current) ref.current.value = ''; }}
            className="text-gray-400 hover:text-red-500 text-base leading-none">✕</button>
        </div>
      ) : existingUrl ? (
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
          <FileDocLink url={existingUrl} />
          <span className="text-gray-300 text-xs">·</span>
          <button type="button" onClick={() => ref.current?.click()}
            className="text-xs text-gray-400 hover:text-gray-700">Reemplazar</button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className="flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-orange-300 text-orange-500 rounded-lg text-sm hover:bg-orange-50 transition-colors">
          📎 {required ? 'Adjuntar documento (obligatorio)' : 'Adjuntar documento'}
        </button>
      )}

      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
}

// ─── RoleSelector ─────────────────────────────────────────────────────────────

function RoleSelector({
  isAdmin, isAdminSecondary, isGuide, onChange,
}: {
  isAdmin: boolean; isAdminSecondary: boolean; isGuide: boolean;
  onChange: (v: { isAdmin: boolean; isAdminSecondary: boolean; isGuide: boolean }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-500">Rol</label>
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" checked={isAdmin}
          onChange={() => onChange({ isAdmin: !isAdmin, isAdminSecondary, isGuide })}
          className="accent-teal" />
        Admin (acceso total)
      </label>
      {!isAdmin && (
        <div className="pl-1 flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={isAdminSecondary}
              onChange={() => onChange({ isAdmin, isAdminSecondary: !isAdminSecondary, isGuide })}
              className="accent-teal" />
            Admin secundario — permisos configurables
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={isGuide}
              onChange={() => onChange({ isAdmin, isAdminSecondary, isGuide: !isGuide })}
              className="accent-teal" />
            Guía / Conductor
          </label>
        </div>
      )}
    </div>
  );
}

// ─── DocumentsPanel ───────────────────────────────────────────────────────────

function DocumentsPanel({
  memberId,
  docs,
  onUpdate,
}: {
  memberId: string;
  docs:     MemberDocument[];
  onUpdate: (docs: MemberDocument[]) => void;
}) {
  const [editing,     setEditing]     = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [form, setForm] = useState({ expires_at: '', notes: '' });
  const [saving,    setSaving]    = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  function openEdit(type: string) {
    const ex = docs.find(d => d.type === type);
    setForm({ expires_at: ex?.expires_at ?? '', notes: ex?.notes ?? '' });
    setPendingFile(null); setUploadErr('');
    setEditing(type);
  }

  async function save(type: string) {
    const ex = docs.find(d => d.type === type);
    if (!pendingFile && !ex?.file_url) {
      setUploadErr('Debes adjuntar el documento');
      return;
    }
    setSaving(true); setUploadErr('');
    try {
      let fileUrl: string | undefined;
      if (pendingFile) fileUrl = await uploadMemberDoc(pendingFile, memberId);

      const res = await fetch(`/api/admin/team/${memberId}/documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          expires_at: form.expires_at || null,
          notes:      form.notes.trim() || null,
          ...(fileUrl ? { file_url: fileUrl } : {}),
        }),
      });
      const saved = await res.json() as MemberDocument;
      if (res.ok) {
        onUpdate([...docs.filter(d => d.type !== type), saved]);
        setEditing(null); setPendingFile(null);
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Error al subir');
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Documentos</h3>
      <div className="flex flex-col gap-2">
        {DOC_TYPES.map(type => {
          const doc    = docs.find(d => d.type === type);
          const status = docStatus(doc?.expires_at ?? null);
          const days   = doc?.expires_at ? daysUntil(doc.expires_at) : null;

          return (
            <div key={type}>
              <button type="button"
                onClick={() => editing === type ? setEditing(null) : openEdit(type)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal/30 hover:bg-gray-50/60 transition-colors text-left">
                <div className="flex items-center gap-2.5">
                  <DocStatusIcon status={status} />
                  <span className="text-sm text-gray-700">{DOC_LABELS[type]}</span>
                  {doc?.file_url && (
                    <span className="text-[10px] text-teal bg-teal/10 px-1.5 py-0.5 rounded">doc</span>
                  )}
                </div>
                <div className="text-right">
                  {doc?.expires_at ? (
                    <div>
                      <p className={`text-xs font-medium ${
                        status === 'ok' ? 'text-green-600' :
                        status === 'soon' ? 'text-amber-600' : 'text-red-600'
                      }`}>{fmtDate(doc.expires_at)}</p>
                      {days !== null && (
                        <p className="text-[10px] text-gray-400">
                          {days < 0 ? `Vencido hace ${Math.abs(days)}d` :
                           days === 0 ? 'Vence hoy' : `${days}d restantes`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">Sin registro</span>
                  )}
                </div>
              </button>

              {editing === type && (
                <div className="mt-2 p-4 bg-gray-50 border border-gray-100 rounded-xl flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Vencimiento</label>
                    <input type="date" value={form.expires_at}
                      onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                      className={ic} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Notas</label>
                    <input value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Opcional"
                      className={ic} />
                  </div>
                  <FileInput
                    existingUrl={docs.find(d => d.type === type)?.file_url ?? null}
                    pendingFile={pendingFile}
                    onChange={setPendingFile}
                    required
                  />
                  {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditing(null)}
                      className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancelar</button>
                    <button type="button" onClick={() => save(type)} disabled={saving}
                      className="bg-teal text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50">
                      {saving ? 'Subiendo…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ProfilePanel ─────────────────────────────────────────────────────────────

function PillSelect({
  options, selected, onToggle,
}: {
  options:  string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" onClick={() => onToggle(o)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            selected.includes(o)
              ? 'bg-teal text-white border-teal'
              : 'border-gray-200 text-gray-500 hover:border-teal/40 hover:text-teal'
          }`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function ProfilePanel({
  member,
  canViewFinancials,
  onUpdate,
}: {
  member:             TeamMemberRow;
  canViewFinancials:  boolean;
  onUpdate:           (patch: Partial<TeamMemberRow>) => void;
}) {
  const init = () => ({
    // Datos personales
    phone:           member.phone           ?? '',
    emergency_name:  member.emergency_name  ?? '',
    emergency_phone: member.emergency_phone ?? '',
    rut:             member.rut             ?? '',
    birthdate:       member.birthdate       ?? '',
    address:         member.address         ?? '',
    civil_status:    member.civil_status    ?? '',
    blood_type:      member.blood_type      ?? '',
    allergies:       member.allergies       ?? '',
    notes:           member.notes           ?? '',
    // Habilitaciones
    languages:       member.languages       ?? [],
    license_class:   member.license_class   ?? '',
    // Vínculo laboral
    employment_type:    member.employment_type    ?? 'contrato',
    contract_type:      member.contract_type      ?? '',
    contract_start:     member.contract_start     ?? '',
    contract_end:       member.contract_end       ?? '',
    afp:                member.afp                ?? '',
    health_insurance_type: member.health_insurance_type ?? '',
    health_insurance_name: member.health_insurance_name ?? '',
    honorarios_payment_type: member.honorarios_payment_type ?? '',
    // Financiero
    salary_base:              member.salary_base?.toString()              ?? '',
    has_bonus:                member.has_bonus                            ?? false,
    bonus_description:        member.bonus_description                    ?? '',
    honorarios_rate_per_tour: member.honorarios_rate_per_tour?.toString() ?? '',
    bank_name:                member.bank_name                            ?? '',
    bank_account_type:        member.bank_account_type                   ?? '',
    bank_account_number:      member.bank_account_number                 ?? '',
  });

  const [f, setF]         = useState(init);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setF(init()); }, [member.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof typeof f>(k: K, v: typeof f[K]) {
    setF(p => ({ ...p, [k]: v }));
  }

  function toggleLang(lang: string) {
    const next = f.languages.includes(lang)
      ? f.languages.filter(l => l !== lang)
      : [...f.languages, lang];
    set('languages', next);
  }

  function toggleLicense(cls: string) {
    set('license_class', f.license_class === cls ? '' : cls);
  }

  async function save() {
    setSaving(true);
    try {
      const patch: Partial<TeamMemberRow> = {
        phone:           f.phone.trim()           || null,
        emergency_name:  f.emergency_name.trim()  || null,
        emergency_phone: f.emergency_phone.trim() || null,
        rut:             f.rut.trim()             || null,
        birthdate:       f.birthdate              || null,
        address:         f.address.trim()         || null,
        civil_status:    f.civil_status           || null,
        blood_type:      f.blood_type.trim()      || null,
        allergies:       f.allergies.trim()       || null,
        notes:           f.notes.trim()           || null,
        languages:       f.languages.length ? f.languages : [],
        license_class:   f.license_class          || null,
        employment_type: f.employment_type        || 'contrato',
        contract_type:   f.contract_type          || null,
        contract_start:  f.contract_start         || null,
        contract_end:    f.contract_end           || null,
        afp:             f.afp.trim()             || null,
        health_insurance_type: f.health_insurance_type || null,
        health_insurance_name: f.health_insurance_name.trim() || null,
        honorarios_payment_type: f.honorarios_payment_type || null,
      };
      if (canViewFinancials) {
        patch.salary_base              = f.salary_base ? parseInt(f.salary_base) : null;
        patch.has_bonus                = f.has_bonus;
        patch.bonus_description        = f.bonus_description.trim() || null;
        patch.honorarios_rate_per_tour = f.honorarios_rate_per_tour
          ? parseInt(f.honorarios_rate_per_tour) : null;
        patch.bank_name                = f.bank_name.trim()          || null;
        patch.bank_account_type        = f.bank_account_type         || null;
        patch.bank_account_number      = f.bank_account_number.trim() || null;
      }
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) onUpdate(patch);
    } finally { setSaving(false); }
  }

  const isHonorarios = f.employment_type === 'honorarios';

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-5">

      {/* ── Datos personales ── */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Datos personales</h4>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Teléfono</label>
            <input value={f.phone} onChange={e => set('phone', e.target.value)}
              placeholder="+56 9 1234 5678" className={ic} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Contacto emergencia</label>
              <input value={f.emergency_name}
                onChange={e => set('emergency_name', e.target.value)}
                placeholder="Nombre" className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Teléfono emergencia</label>
              <input value={f.emergency_phone}
                onChange={e => set('emergency_phone', e.target.value)}
                placeholder="+56 9 …" className={ic} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">RUT</label>
              <input value={f.rut} onChange={e => set('rut', e.target.value)}
                placeholder="12.345.678-9" className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Fecha de nacimiento</label>
              <input type="date" value={f.birthdate}
                onChange={e => set('birthdate', e.target.value)}
                className={ic} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Dirección</label>
            <input value={f.address} onChange={e => set('address', e.target.value)}
              placeholder="Calle, número, ciudad" className={ic} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Estado civil</label>
              <select value={f.civil_status} onChange={e => set('civil_status', e.target.value)}
                className={ic}>
                <option value="">—</option>
                {CIVIL_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Grupo sanguíneo</label>
              <input value={f.blood_type} onChange={e => set('blood_type', e.target.value)}
                placeholder="A+, O−…" className={ic} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Alergias / restricciones</label>
            <input value={f.allergies} onChange={e => set('allergies', e.target.value)}
              placeholder="Gluten, nueces…" className={ic} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Notas internas</label>
            <textarea rows={2} value={f.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Observaciones, horarios especiales…"
              className={ic + ' resize-none'} />
          </div>
        </div>
      </section>

      {/* ── Habilitaciones ── */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Habilitaciones</h4>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-500">Idiomas</label>
            <PillSelect options={LANGUAGES_OPTIONS} selected={f.languages} onToggle={toggleLang} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-gray-500">Clase de licencia</label>
            <PillSelect options={LICENSE_OPTIONS} selected={f.license_class ? [f.license_class] : []} onToggle={toggleLicense} />
          </div>
        </div>
      </section>

      {/* ── Vínculo laboral ── */}
      <section>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Vínculo laboral</h4>
        <div className="flex flex-col gap-3">
          {/* Toggle contrato / honorarios */}
          <div className="flex gap-2">
            {(['contrato','honorarios'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => set('employment_type', t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  f.employment_type === t
                    ? 'bg-teal text-white border-teal'
                    : 'border-gray-200 text-gray-500 hover:border-teal/40'
                }`}>
                {t === 'contrato' ? 'Contrato' : 'Honorarios'}
              </button>
            ))}
          </div>

          {!isHonorarios && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Tipo de contrato</label>
                <select value={f.contract_type} onChange={e => set('contract_type', e.target.value)}
                  className={ic}>
                  <option value="">—</option>
                  <option value="indefinido">Indefinido</option>
                  <option value="plazo_fijo">Plazo fijo</option>
                  <option value="por_obra">Por obra o faena</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Inicio contrato</label>
                  <input type="date" value={f.contract_start}
                    onChange={e => set('contract_start', e.target.value)} className={ic} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Fin contrato</label>
                  <input type="date" value={f.contract_end}
                    onChange={e => set('contract_end', e.target.value)} className={ic} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">AFP</label>
                  <input value={f.afp} onChange={e => set('afp', e.target.value)}
                    placeholder="Habitat, Provida…" className={ic} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Previsión de salud</label>
                  <select value={f.health_insurance_type}
                    onChange={e => set('health_insurance_type', e.target.value)}
                    className={ic}>
                    <option value="">—</option>
                    <option value="fonasa">FONASA</option>
                    <option value="isapre">ISAPRE</option>
                  </select>
                </div>
              </div>
              {f.health_insurance_type === 'isapre' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Nombre ISAPRE</label>
                  <input value={f.health_insurance_name}
                    onChange={e => set('health_insurance_name', e.target.value)}
                    placeholder="Cruz Blanca, Consalud…" className={ic} />
                </div>
              )}
            </>
          )}

          {isHonorarios && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Modalidad de pago</label>
              <select value={f.honorarios_payment_type}
                onChange={e => set('honorarios_payment_type', e.target.value)}
                className={ic}>
                <option value="">—</option>
                <option value="per_tour">Por tour realizado</option>
                <option value="per_service">Por servicio prestado</option>
                <option value="both">Ambos</option>
              </select>
            </div>
          )}
        </div>
      </section>

      {/* ── Financiero (solo view_financials) ── */}
      {canViewFinancials && (
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Financiero <span className="text-gray-300 font-normal normal-case">· privado</span>
          </h4>
          <div className="flex flex-col gap-3">
            {!isHonorarios && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Sueldo base (CLP)</label>
                  <input type="number" value={f.salary_base}
                    onChange={e => set('salary_base', e.target.value)}
                    placeholder="600000" className={ic} />
                </div>
                <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
                  <input type="checkbox" checked={f.has_bonus}
                    onChange={e => set('has_bonus', e.target.checked)}
                    className="accent-teal" />
                  Incluye bono
                </label>
                {f.has_bonus && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Descripción del bono</label>
                    <input value={f.bonus_description}
                      onChange={e => set('bonus_description', e.target.value)}
                      placeholder="Bono de productividad mensual…" className={ic} />
                  </div>
                )}
              </>
            )}

            {isHonorarios && (f.honorarios_payment_type === 'per_tour' || f.honorarios_payment_type === 'both') && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Pago por tour (CLP)</label>
                <input type="number" value={f.honorarios_rate_per_tour}
                  onChange={e => set('honorarios_rate_per_tour', e.target.value)}
                  placeholder="35000" className={ic} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Banco</label>
                <input value={f.bank_name} onChange={e => set('bank_name', e.target.value)}
                  placeholder="Banco Estado, Santander…" className={ic} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Tipo de cuenta</label>
                <select value={f.bank_account_type}
                  onChange={e => set('bank_account_type', e.target.value)}
                  className={ic}>
                  <option value="">—</option>
                  <option value="corriente">Corriente</option>
                  <option value="vista">Vista</option>
                  <option value="ahorro">Ahorro</option>
                  <option value="rut">Cuenta RUT</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">N° de cuenta</label>
              <input value={f.bank_account_number}
                onChange={e => set('bank_account_number', e.target.value)}
                placeholder="000-0-000000-0" className={ic} />
            </div>
          </div>
        </section>
      )}

      <button type="button" onClick={save} disabled={saving}
        className="self-start bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors">
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  );
}

// ─── Tab: Permisos ────────────────────────────────────────────────────────────
// (canViewFinancials flows down: EquipoManager → MemberDetail → ProfilePanel)

function PermissionsTab({
  member,
  isCurrentUser,
  onUpdate,
  onDelete,
}: {
  member:       TeamMemberRow;
  isCurrentUser:boolean;
  onUpdate:     (patch: Partial<TeamMemberRow>) => void;
  onDelete:     () => void;
}) {
  const [isAdmin,          setIsAdmin]          = useState(member.role === 'admin');
  const [isAdminSecondary, setIsAdminSecondary] = useState(member.is_admin_secondary);
  const [isGuide,          setIsGuide]          = useState(member.is_guide);
  const [perms,            setPerms]            = useState<Record<string, boolean>>(member.permissions ?? {});
  const [active,           setActive]           = useState(member.active);
  const [saving,           setSaving]           = useState(false);
  const [deleting,         setDeleting]         = useState(false);

  useEffect(() => {
    setIsAdmin(member.role === 'admin');
    setIsAdminSecondary(member.is_admin_secondary);
    setIsGuide(member.is_guide);
    setPerms(member.permissions ?? {});
    setActive(member.active);
  }, [member.id]);

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
      const patch = {
        role:               role as TeamMemberRow['role'],
        is_admin_secondary: isAdminSecondary,
        is_guide:           isGuide,
        active,
        permissions:        perms,
      };
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) onUpdate(patch);
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`¿Eliminar a ${member.name} del equipo?`)) return;
    setDeleting(true);
    await fetch(`/api/admin/team/${member.id}`, { method: 'DELETE' });
    onDelete();
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toggle activo */}
      {!isCurrentUser && (
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button type="button" onClick={() => setActive(a => !a)}
            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${active ? 'bg-teal' : 'bg-gray-200'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-gray-700">{active ? 'Activo en el sistema' : 'Inactivo (sin acceso)'}</span>
        </label>
      )}

      <RoleSelector
        isAdmin={isAdmin}
        isAdminSecondary={isAdminSecondary}
        isGuide={isGuide}
        onChange={handleRoleChange}
      />

      {isAdminSecondary && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-500">Permisos</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PERMISSIONS.map(p => (
              <label key={p.key}
                className="flex items-start gap-2.5 bg-white border border-gray-100 rounded-lg px-3 py-2.5 cursor-pointer hover:border-gray-200 transition-colors">
                <input type="checkbox" checked={!!perms[p.key]}
                  onChange={() => setPerms(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                  className="mt-0.5 accent-teal" />
                <div>
                  <p className="text-xs font-medium text-gray-800">{p.label}</p>
                  <p className="text-[11px] text-gray-400">{p.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        {isDirty && !isCurrentUser && (
          <button type="button" onClick={save} disabled={saving}
            className="bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
        {!isCurrentUser && (
          <button type="button" onClick={remove} disabled={deleting}
            className="text-sm text-red-400 hover:text-red-600 disabled:opacity-40 ml-auto">
            {deleting ? 'Eliminando…' : 'Eliminar del equipo'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MemberDetail ─────────────────────────────────────────────────────────────

type TabKey = 'permisos' | 'tours';

function MemberDetail({
  member,
  isCurrentUser,
  canViewFinancials,
  onUpdate,
  onDelete,
}: {
  member:             TeamMemberRow;
  isCurrentUser:      boolean;
  canViewFinancials:  boolean;
  onUpdate:           (patch: Partial<TeamMemberRow>) => void;
  onDelete:           () => void;
}) {
  const [docs,    setDocs]    = useState<MemberDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<TabKey>('permisos');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/team/${member.id}/details`);
      const data = await res.json() as { documents: MemberDocument[] };
      setDocs(data.documents ?? []);
    } finally { setLoading(false); }
  }, [member.id]);

  useEffect(() => { load(); }, [load]);

  const roleLabel = roleBadgeLabel(member);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${avatarColor(member)}`}>
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">{member.name}</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[member.role] ?? 'bg-gray-100 text-gray-500'}`}>
              {roleLabel}
            </span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${member.active ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
              {member.active ? '● Activo' : '○ Inactivo'}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {member.email ?? '—'}
            {member.phone && <> · {member.phone}</>}
            {' · desde '}
            {fmtDateShort(member.created_at)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-gray-400">Cargando…</div>
      ) : (
        <>
          {/* Panels: Perfil + Documentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfilePanel member={member} canViewFinancials={canViewFinancials} onUpdate={onUpdate} />
            <DocumentsPanel memberId={member.id} docs={docs} onUpdate={setDocs} />
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-100">
              {([
                { key: 'permisos', label: 'Permisos y acceso' },
                { key: 'tours',    label: 'Tours'             },
              ] as { key: TabKey; label: string }[]).map(t => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    tab === t.key
                      ? 'border-teal text-teal bg-teal/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-5">
              {tab === 'permisos' && (
                <PermissionsTab
                  member={member}
                  isCurrentUser={isCurrentUser}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              )}
              {tab === 'tours' && (
                <div className="text-center py-8 text-sm text-gray-400">
                  <p className="mb-1">Disponible con la app interna</p>
                  <p className="text-xs">Los tours asignados a cada guía se mostrarán aquí.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── InviteMemberModal ────────────────────────────────────────────────────────

function InviteMemberModal({
  onClose,
  onInvited,
}: {
  onClose:   () => void;
  onInvited: (m: TeamMemberRow) => void;
}) {
  const [name,             setName]             = useState('');
  const [email,            setEmail]            = useState('');
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [isAdminSecondary, setIsAdminSecondary] = useState(false);
  const [isGuide,          setIsGuide]          = useState(true);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function handleRoleChange(next: { isAdmin: boolean; isAdminSecondary: boolean; isGuide: boolean }) {
    setIsAdmin(next.isAdmin);
    setIsAdminSecondary(next.isAdmin ? false : next.isAdminSecondary);
    setIsGuide(next.isAdmin ? false : next.isGuide);
  }

  async function submit() {
    if (!email || !name) return;
    setSaving(true); setError('');
    try {
      const role = isAdmin ? 'admin' : isAdminSecondary ? 'admin_secondary' : 'guide';
      const res = await fetch('/api/admin/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, role, is_admin_secondary: isAdminSecondary, is_guide: isGuide, permissions: {} }),
      });
      const data = await res.json() as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Error'); return; }
      onInvited({
        id: data.id!, name, email,
        role: role as TeamMemberRow['role'],
        is_admin_secondary: isAdminSecondary,
        is_guide: isGuide,
        permissions: {},
        active: true,
        created_at: new Date().toISOString(),
        phone: null, emergency_name: null, emergency_phone: null,
        rut: null, birthdate: null, address: null, civil_status: null,
        blood_type: null, allergies: null, notes: null,
        languages: [], license_class: null,
        employment_type: 'contrato', contract_type: null,
        contract_start: null, contract_end: null, afp: null,
        health_insurance_type: null, health_insurance_name: null,
        honorarios_payment_type: null,
        salary_base: null, has_bonus: null, bonus_description: null,
        honorarios_rate_per_tour: null,
        bank_name: null, bank_account_type: null, bank_account_number: null,
      });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md mx-4 my-10 bg-white rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Invitar nuevo miembro</h2>
          <button type="button" onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Nombre <span className="text-red-400">*</span></label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Sebastián Torres" className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Email <span className="text-red-400">*</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="nombre@email.com" className={ic} />
            </div>
          </div>

          <RoleSelector
            isAdmin={isAdmin} isAdminSecondary={isAdminSecondary} isGuide={isGuide}
            onChange={handleRoleChange}
          />

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={submit} disabled={saving || !name || !email}
            className="bg-teal text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50">
            {saving ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── EquipoManager (principal) ────────────────────────────────────────────────

export default function EquipoManager({
  initialMembers,
  currentUserEmail,
  canViewFinancials,
}: {
  initialMembers:    TeamMemberRow[];
  currentUserEmail:  string;
  canViewFinancials: boolean;
}) {
  const [members,    setMembers]    = useState<TeamMemberRow[]>(initialMembers);
  const [selectedId, setSelectedId] = useState<string | null>(initialMembers[0]?.id ?? null);
  const [showInvite, setShowInvite] = useState(false);

  function rank(m: TeamMemberRow) {
    if (m.role === 'admin') return 0;
    if (m.is_admin_secondary) return 1;
    if (m.is_guide) return 2;
    return 3;
  }
  const sorted = [...members].sort((a, b) => rank(a) - rank(b));

  const selectedMember = members.find(m => m.id === selectedId) ?? null;

  function handleUpdate(patch: Partial<TeamMemberRow>) {
    setMembers(prev => prev.map(m => m.id === selectedId ? { ...m, ...patch } : m));
  }

  function handleDelete() {
    setMembers(prev => {
      const next = prev.filter(m => m.id !== selectedId);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }

  function handleInvited(m: TeamMemberRow) {
    setMembers(prev => [...prev, m]);
    setSelectedId(m.id);
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Cards de miembros ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {sorted.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelectedId(m.id)}
            className={`flex flex-col items-start px-4 py-3 rounded-xl border transition-all text-left min-w-[140px] ${
              selectedId === m.id
                ? 'border-teal bg-teal text-white shadow-md'
                : 'border-gray-200 bg-white text-gray-700 hover:border-teal/40 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                selectedId === m.id ? 'bg-white/20 text-white' : avatarColor(m)
              }`}>
                {m.name.charAt(0).toUpperCase()}
              </div>
              <span className={`font-semibold text-sm ${selectedId === m.id ? 'text-white' : 'text-gray-900'}`}>
                {m.name.split(' ')[0]}
              </span>
            </div>
            <span className={`text-[11px] ${selectedId === m.id ? 'text-teal-100' : 'text-gray-400'}`}>
              {roleBadgeLabel(m)}
            </span>
            <span className={`text-[10px] font-medium mt-1 ${
              selectedId === m.id
                ? (m.active ? 'text-green-200' : 'text-gray-300')
                : (m.active ? 'text-green-500' : 'text-gray-300')
            }`}>
              {m.active ? '● Activo' : '○ Inactivo'}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex flex-col items-center justify-center px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-teal/40 hover:text-teal hover:bg-gray-50 transition-all min-w-[140px] min-h-[82px] gap-1"
        >
          <span className="text-xl font-light leading-none">+</span>
          <span className="text-xs font-medium">Invitar miembro</span>
        </button>
      </div>

      {/* ── Detalle miembro seleccionado ── */}
      {selectedMember ? (
        <MemberDetail
          key={selectedMember.id}
          member={selectedMember}
          isCurrentUser={selectedMember.email === currentUserEmail}
          canViewFinancials={canViewFinancials}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 flex flex-col items-center gap-3 text-gray-400">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">Invita al primer miembro del equipo</p>
        </div>
      )}

      {/* Modal invitar */}
      {showInvite && (
        <InviteMemberModal
          onClose={() => setShowInvite(false)}
          onInvited={handleInvited}
        />
      )}
    </div>
  );
}
