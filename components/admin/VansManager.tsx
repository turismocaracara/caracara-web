'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

const VanEditModal = dynamic(() => import('./VanEditModal'), { ssr: false });

// ─── Tipos públicos ───────────────────────────────────────────────────────────

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

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface VanDocument {
  id:            string;
  type:          string;
  expires_at:    string | null;
  issuer:        string | null;
  policy_number: string | null;
  notes:         string | null;
  file_url:      string | null;
  updated_at:    string;
}

interface OdometerEntry {
  id:          string;
  km:          number;
  recorded_at: string;
  notes:       string | null;
  file_url:    string | null;
}

interface MaintenanceRecord {
  id:          string;
  date:        string;
  type:        string | null;
  description: string | null;
  cost:        number | null;
  workshop:    string | null;
  km_at:       number | null;
  next_km:     number | null;
  file_url:    string | null;
}

interface FuelRecord {
  id:       string;
  date:     string;
  liters:   number | null;
  cost:     number | null;
  km_at:    number | null;
  station:  string | null;
  file_url: string | null;
}

interface TagRecord {
  id:       string;
  month:    string;
  cost:     number;
  notes:    string | null;
  file_url: string | null;
}

interface TourRecord {
  id:        string;
  date:      string;
  status:    string;
  tour_slug: string;
  tours:     { name_es: string } | null;
}

interface VanDetails {
  documents:   VanDocument[];
  odometer:    OdometerEntry[];
  maintenance: MaintenanceRecord[];
  fuel:        FuelRecord[];
  tags:        TagRecord[];
  tours:       TourRecord[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function fmtMonth(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', {
    month: 'long', year: 'numeric',
  });
}

function fmtCLP(n: number | null | undefined) {
  if (n == null) return '—';
  return '$' + n.toLocaleString('es-CL');
}

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const diff = Math.floor(
    (new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86_400_000
  );
  return diff;
}

type DocStatus = 'ok' | 'soon' | 'expired' | 'missing';

function docStatus(expires: string | null): DocStatus {
  if (!expires) return 'missing';
  const days = daysUntil(expires)!;
  if (days < 0)  return 'expired';
  if (days < 30) return 'soon';
  return 'ok';
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadVanDoc(file: File, vanId: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('van_id', vanId);
  const res  = await fetch('/api/admin/vans/upload-document', { method: 'POST', body: form });
  const data = await res.json() as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Error al subir archivo');
  return data.url!;
}

function isPdf(url: string) { return url.toLowerCase().includes('.pdf'); }

function FileDocLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-teal hover:underline font-medium">
      <span>{isPdf(url) ? '📄' : '🖼️'}</span> Ver
    </a>
  );
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
        Documento adjunto{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>

      {pendingFile ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-700 text-xs flex-1 truncate">📎 {pendingFile.name}</span>
          <button type="button" onClick={() => { onChange(null); if (ref.current) ref.current.value = ''; }}
            className="text-gray-400 hover:text-red-500 leading-none text-base">✕</button>
        </div>
      ) : existingUrl ? (
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
          <FileDocLink url={existingUrl} />
          <span className="text-gray-300 text-xs">·</span>
          <button type="button" onClick={() => ref.current?.click()}
            className="text-xs text-gray-400 hover:text-gray-700">
            Reemplazar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className="flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-orange-300 text-orange-500 rounded-lg text-sm hover:bg-orange-50 transition-colors">
          <span>📎</span>
          {required ? 'Adjuntar documento (obligatorio)' : 'Adjuntar documento'}
        </button>
      )}

      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const DOC_LABELS: Record<string, string> = {
  revision_tecnica:    'Revisión Técnica',
  soap:                'SOAP',
  permiso_circulacion: 'Permiso de Circulación',
  seguro_voluntario:   'Seguro Voluntario',
  otro:                'Otro',
};

const DOC_TYPES = ['revision_tecnica', 'soap', 'permiso_circulacion', 'seguro_voluntario'] as const;

const STATUS_BADGE: Record<string, string> = {
  forming:   'bg-blue-50 text-blue-700',
  confirmed: 'bg-green-50 text-green-700',
  executed:  'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-400',
};
const STATUS_LABEL: Record<string, string> = {
  forming:   'Formando',
  confirmed: 'Confirmado',
  executed:  'Ejecutado',
  cancelled: 'Cancelado',
};

const ic = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal';

// ─── SubPanel: Documentos ─────────────────────────────────────────────────────

function DocStatusIcon({ status }: { status: DocStatus }) {
  if (status === 'ok')      return <span className="text-green-500 font-bold">✓</span>;
  if (status === 'soon')    return <span className="text-amber-500 font-bold">!</span>;
  if (status === 'expired') return <span className="text-red-500 font-bold">✗</span>;
  return <span className="text-gray-300">—</span>;
}

function DocumentsPanel({
  vanId,
  docs,
  onUpdate,
}: {
  vanId:    string;
  docs:     VanDocument[];
  onUpdate: (docs: VanDocument[]) => void;
}) {
  const [editing,     setEditing]     = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [form, setForm] = useState<{
    expires_at: string; issuer: string; policy_number: string; notes: string;
  }>({ expires_at: '', issuer: '', policy_number: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  function openEdit(type: string) {
    const existing = docs.find(d => d.type === type);
    setForm({
      expires_at:    existing?.expires_at    ?? '',
      issuer:        existing?.issuer        ?? '',
      policy_number: existing?.policy_number ?? '',
      notes:         existing?.notes         ?? '',
    });
    setPendingFile(null);
    setUploadErr('');
    setEditing(type);
  }

  async function saveDoc(type: string) {
    const existingDoc = docs.find(d => d.type === type);
    if (!pendingFile && !existingDoc?.file_url) {
      setUploadErr('Debes adjuntar el documento');
      return;
    }
    setSaving(true);
    setUploadErr('');
    try {
      let fileUrl: string | undefined;
      if (pendingFile) fileUrl = await uploadVanDoc(pendingFile, vanId);

      const res = await fetch(`/api/admin/vans/${vanId}/documents`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          expires_at:    form.expires_at    || null,
          issuer:        form.issuer.trim() || null,
          policy_number: form.policy_number.trim() || null,
          notes:         form.notes.trim()  || null,
          ...(fileUrl ? { file_url: fileUrl } : {}),
        }),
      });
      const saved = await res.json() as VanDocument;
      if (res.ok) {
        onUpdate([...docs.filter(d => d.type !== type), saved]);
        setEditing(null);
        setPendingFile(null);
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Error al subir archivo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Documentos
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {DOC_TYPES.map(type => {
          const doc    = docs.find(d => d.type === type);
          const status = docStatus(doc?.expires_at ?? null);
          const days   = doc?.expires_at ? daysUntil(doc.expires_at) : null;

          return (
            <div key={type}>
              <button
                type="button"
                onClick={() => editing === type ? setEditing(null) : openEdit(type)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 hover:border-teal/30 hover:bg-gray-50/60 transition-colors text-left"
              >
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
                        status === 'ok'      ? 'text-green-600' :
                        status === 'soon'    ? 'text-amber-600' :
                                              'text-red-600'
                      }`}>
                        {fmtDate(doc.expires_at)}
                      </p>
                      {days !== null && (
                        <p className="text-[10px] text-gray-400">
                          {days < 0 ? `Vencido hace ${Math.abs(days)}d` :
                           days === 0 ? 'Vence hoy' :
                           `${days}d restantes`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">Sin registro</span>
                  )}
                </div>
              </button>

              {editing === type && (
                <div className="mt-2 p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">Vencimiento</label>
                      <input type="date" value={form.expires_at}
                        onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                        className={ic} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500">N° póliza / documento</label>
                      <input value={form.policy_number}
                        onChange={e => setForm(f => ({ ...f, policy_number: e.target.value }))}
                        placeholder="Opcional"
                        className={ic} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Emisor / Compañía</label>
                    <input value={form.issuer}
                      onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))}
                      placeholder="Ej: Chilena Consolidada"
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
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setEditing(null)}
                      className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5">
                      Cancelar
                    </button>
                    <button type="button" onClick={() => saveDoc(type)} disabled={saving}
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

// ─── SubPanel: Kilometraje ────────────────────────────────────────────────────

function OdometerPanel({
  vanId,
  entries,
  onUpdate,
}: {
  vanId:    string;
  entries:  OdometerEntry[];
  onUpdate: (entries: OdometerEntry[]) => void;
}) {
  const [showForm,    setShowForm]    = useState(false);
  const [km,          setKm]          = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [notes,       setNotes]       = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [uploadErr,   setUploadErr]   = useState('');
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const latest = entries[0];

  async function add() {
    if (!km) return;
    if (!pendingFile) { setUploadErr('Debes adjuntar la foto del odómetro'); return; }
    setSaving(true); setUploadErr('');
    try {
      const fileUrl = await uploadVanDoc(pendingFile, vanId);
      const res = await fetch(`/api/admin/vans/${vanId}/odometer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ km: Number(km), recorded_at: date, notes: notes || null, file_url: fileUrl }),
      });
      const saved = await res.json() as OdometerEntry;
      if (res.ok) {
        onUpdate([saved, ...entries]);
        setKm(''); setNotes(''); setPendingFile(null); setShowForm(false);
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Error al subir archivo');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/vans/${vanId}/odometer`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      onUpdate(entries.filter(e => e.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Kilometraje
      </h3>

      <div className="flex flex-col items-center py-3 mb-4 bg-gray-50 rounded-xl">
        <p className="text-3xl font-bold text-gray-900 tracking-tight">
          {latest ? latest.km.toLocaleString('es-CL') : '—'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {latest ? `km · registrado ${fmtDate(latest.recorded_at)}` : 'Sin registros'}
        </p>
      </div>

      {showForm ? (
        <div className="flex flex-col gap-3 mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Kilómetros</label>
              <input type="number" min={0} value={km}
                onChange={e => setKm(e.target.value)}
                placeholder="134200"
                className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Fecha</label>
              <input type="date" value={date}
                onChange={e => setDate(e.target.value)}
                className={ic} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Notas (opcional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Después de mantención, etc."
              className={ic} />
          </div>
          <FileInput existingUrl={null} pendingFile={pendingFile} onChange={setPendingFile} required />
          {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setPendingFile(null); setUploadErr(''); }}
              className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5">
              Cancelar
            </button>
            <button type="button" onClick={add} disabled={saving || !km}
              className="bg-teal text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? 'Subiendo…' : 'Registrar'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="w-full text-center text-sm text-teal font-medium border border-dashed border-teal/40 rounded-lg py-2 hover:bg-teal/5 transition-colors mb-4">
          + Registrar lectura
        </button>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {entries.map(e => (
            <div key={e.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 group">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {e.km.toLocaleString('es-CL')} km
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(e.recorded_at)}</span>
                  {e.file_url && <FileDocLink url={e.file_url} />}
                </div>
                {e.notes && <p className="text-xs text-gray-400">{e.notes}</p>}
              </div>
              <button type="button" onClick={() => remove(e.id)} disabled={deletingId === e.id}
                className="text-xs text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40">
                {deletingId === e.id ? '…' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Mantenciones ────────────────────────────────────────────────────────

const MAINT_TYPES = [
  'Cambio de aceite','Revisión frenos','Cambio de neumáticos','Filtros','Batería',
  'Sistema eléctrico','Refrigeración','Transmisión','Suspensión','Otro',
];

function MaintenanceTab({
  vanId, records, onUpdate,
}: { vanId: string; records: MaintenanceRecord[]; onUpdate: (r: MaintenanceRecord[]) => void }) {
  const [showForm,    setShowForm]    = useState(false);
  const [f, setF] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: '', description: '', cost: '', workshop: '', km_at: '', next_km: '',
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [uploadErr,   setUploadErr]   = useState('');
  const [delId,       setDelId]       = useState<string | null>(null);

  async function add() {
    if (!pendingFile) { setUploadErr('Debes adjuntar el comprobante de la mantención'); return; }
    setSaving(true); setUploadErr('');
    try {
      const fileUrl = await uploadVanDoc(pendingFile, vanId);
      const res = await fetch(`/api/admin/vans/${vanId}/maintenance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: f.date,
          type:        f.type || undefined,
          description: f.description || undefined,
          cost:        f.cost    ? Number(f.cost)    : undefined,
          workshop:    f.workshop || undefined,
          km_at:       f.km_at   ? Number(f.km_at)   : undefined,
          next_km:     f.next_km ? Number(f.next_km) : undefined,
          file_url:    fileUrl,
        }),
      });
      const saved = await res.json() as MaintenanceRecord;
      if (res.ok) {
        onUpdate([saved, ...records]);
        setF({ date: new Date().toISOString().slice(0, 10), type:'', description:'', cost:'', workshop:'', km_at:'', next_km:'' });
        setPendingFile(null); setShowForm(false);
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Error al subir archivo');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    setDelId(id);
    try {
      await fetch(`/api/admin/vans/${vanId}/maintenance`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      onUpdate(records.filter(r => r.id !== id));
    } finally { setDelId(null); }
  }

  return (
    <div className="flex flex-col gap-4">
      {showForm ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Fecha</label>
              <input type="date" value={f.date}
                onChange={e => setF(p => ({...p, date: e.target.value}))} className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Tipo</label>
              <select value={f.type} onChange={e => setF(p => ({...p, type: e.target.value}))}
                className={ic + ' bg-white'}>
                <option value="">Seleccionar…</option>
                {MAINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Descripción</label>
            <input value={f.description}
              onChange={e => setF(p => ({...p, description: e.target.value}))}
              placeholder="Detalles de la mantención"
              className={ic} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Taller</label>
              <input value={f.workshop}
                onChange={e => setF(p => ({...p, workshop: e.target.value}))}
                placeholder="Nombre del taller"
                className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Costo ($)</label>
              <input type="number" min={0} value={f.cost}
                onChange={e => setF(p => ({...p, cost: e.target.value}))}
                placeholder="0"
                className={ic} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Km al momento</label>
              <input type="number" min={0} value={f.km_at}
                onChange={e => setF(p => ({...p, km_at: e.target.value}))}
                placeholder="134200"
                className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Próxima mantención (km)</label>
              <input type="number" min={0} value={f.next_km}
                onChange={e => setF(p => ({...p, next_km: e.target.value}))}
                placeholder="144200"
                className={ic} />
            </div>
          </div>
          <FileInput existingUrl={null} pendingFile={pendingFile} onChange={setPendingFile} required />
          {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setShowForm(false); setPendingFile(null); setUploadErr(''); }}
              className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancelar</button>
            <button type="button" onClick={add} disabled={saving}
              className="bg-teal text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? 'Subiendo…' : 'Registrar'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="self-start flex items-center gap-1.5 bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 transition-colors">
          <span className="text-lg leading-none">+</span> Nueva mantención
        </button>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Sin mantenciones registradas</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map(r => (
            <div key={r.id}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start justify-between group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">
                    {r.type ?? 'Mantención'}
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(r.date)}</span>
                  {r.cost != null && (
                    <span className="text-xs text-gray-500">{fmtCLP(r.cost)}</span>
                  )}
                  {r.file_url && <FileDocLink url={r.file_url} />}
                </div>
                {r.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                )}
                <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                  {r.workshop && <span>Taller: {r.workshop}</span>}
                  {r.km_at    && <span>Km: {r.km_at.toLocaleString('es-CL')}</span>}
                  {r.next_km  && <span>Próx: {r.next_km.toLocaleString('es-CL')} km</span>}
                </div>
              </div>
              <button type="button" onClick={() => remove(r.id)} disabled={delId === r.id}
                className="ml-3 text-xs text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40 flex-shrink-0">
                {delId === r.id ? '…' : 'Eliminar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Combustible ─────────────────────────────────────────────────────────

function FuelTab({
  vanId, records, onUpdate,
}: { vanId: string; records: FuelRecord[]; onUpdate: (r: FuelRecord[]) => void }) {
  const [showForm,    setShowForm]    = useState(false);
  const [f, setF] = useState({
    date: new Date().toISOString().slice(0, 10),
    liters: '', cost: '', km_at: '', station: '',
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [uploadErr,   setUploadErr]   = useState('');
  const [delId,       setDelId]       = useState<string | null>(null);

  const totalLiters = records.reduce((s, r) => s + (r.liters ?? 0), 0);
  const totalCost   = records.reduce((s, r) => s + (r.cost   ?? 0), 0);

  async function add() {
    if (!pendingFile) { setUploadErr('Debes adjuntar el comprobante de la carga'); return; }
    setSaving(true); setUploadErr('');
    try {
      const fileUrl = await uploadVanDoc(pendingFile, vanId);
      const res = await fetch(`/api/admin/vans/${vanId}/fuel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: f.date,
          liters:   f.liters  ? Number(f.liters)  : undefined,
          cost:     f.cost    ? Number(f.cost)    : undefined,
          km_at:    f.km_at   ? Number(f.km_at)   : undefined,
          station:  f.station || undefined,
          file_url: fileUrl,
        }),
      });
      const saved = await res.json() as FuelRecord;
      if (res.ok) {
        onUpdate([saved, ...records]);
        setF({ date: new Date().toISOString().slice(0, 10), liters:'', cost:'', km_at:'', station:'' });
        setPendingFile(null); setShowForm(false);
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Error al subir archivo');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    setDelId(id);
    try {
      await fetch(`/api/admin/vans/${vanId}/fuel`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      onUpdate(records.filter(r => r.id !== id));
    } finally { setDelId(null); }
  }

  return (
    <div className="flex flex-col gap-4">
      {records.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{totalLiters.toFixed(1)} L</p>
            <p className="text-xs text-blue-500 mt-0.5">Total cargado (últimos 30)</p>
          </div>
          <div className="bg-orange-50 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-orange-700">{fmtCLP(totalCost)}</p>
            <p className="text-xs text-orange-500 mt-0.5">Costo total (últimos 30)</p>
          </div>
        </div>
      )}

      {showForm ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Fecha</label>
              <input type="date" value={f.date}
                onChange={e => setF(p => ({...p, date: e.target.value}))} className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Estación</label>
              <input value={f.station}
                onChange={e => setF(p => ({...p, station: e.target.value}))}
                placeholder="Copec, Petrobras…"
                className={ic} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Litros</label>
              <input type="number" min={0} step={0.01} value={f.liters}
                onChange={e => setF(p => ({...p, liters: e.target.value}))}
                placeholder="40.5"
                className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Costo ($)</label>
              <input type="number" min={0} value={f.cost}
                onChange={e => setF(p => ({...p, cost: e.target.value}))}
                placeholder="50000"
                className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Km al momento</label>
              <input type="number" min={0} value={f.km_at}
                onChange={e => setF(p => ({...p, km_at: e.target.value}))}
                placeholder="134200"
                className={ic} />
            </div>
          </div>
          <FileInput existingUrl={null} pendingFile={pendingFile} onChange={setPendingFile} required />
          {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setShowForm(false); setPendingFile(null); setUploadErr(''); }}
              className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancelar</button>
            <button type="button" onClick={add} disabled={saving}
              className="bg-teal text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? 'Subiendo…' : 'Registrar'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="self-start flex items-center gap-1.5 bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 transition-colors">
          <span className="text-lg leading-none">+</span> Registrar carga
        </button>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Sin cargas registradas</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map(r => (
            <div key={r.id}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start justify-between group">
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">{fmtDate(r.date)}</span>
                  {r.liters != null && (
                    <span className="text-xs text-blue-600">{r.liters} L</span>
                  )}
                  {r.cost != null && (
                    <span className="text-xs text-gray-600">{fmtCLP(r.cost)}</span>
                  )}
                  {r.file_url && <FileDocLink url={r.file_url} />}
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                  {r.station && <span>{r.station}</span>}
                  {r.km_at   && <span>Km: {r.km_at.toLocaleString('es-CL')}</span>}
                </div>
              </div>
              <button type="button" onClick={() => remove(r.id)} disabled={delId === r.id}
                className="ml-3 text-xs text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40">
                {delId === r.id ? '…' : 'Eliminar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Tags ────────────────────────────────────────────────────────────────

function TagsTab({
  vanId, records, onUpdate,
}: { vanId: string; records: TagRecord[]; onUpdate: (r: TagRecord[]) => void }) {
  const [showForm,    setShowForm]    = useState(false);
  const [month,       setMonth]       = useState(new Date().toISOString().slice(0, 7));
  const [cost,        setCost]        = useState('');
  const [notes,       setNotes]       = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [uploadErr,   setUploadErr]   = useState('');
  const [delId,       setDelId]       = useState<string | null>(null);

  const totalYear = records
    .filter(r => r.month.startsWith(new Date().getFullYear().toString()))
    .reduce((s, r) => s + r.cost, 0);

  async function add() {
    if (!cost) return;
    if (!pendingFile) { setUploadErr('Debes adjuntar el comprobante del tag'); return; }
    setSaving(true); setUploadErr('');
    try {
      const fileUrl = await uploadVanDoc(pendingFile, vanId);
      const res = await fetch(`/api/admin/vans/${vanId}/tags`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month:    month + '-01',
          cost:     Number(cost),
          notes:    notes || undefined,
          file_url: fileUrl,
        }),
      });
      const saved = await res.json() as TagRecord;
      if (res.ok) {
        const existing = records.find(r => r.month.slice(0, 7) === month);
        if (existing) {
          onUpdate(records.map(r => r.id === existing.id ? saved : r));
        } else {
          onUpdate([saved, ...records]);
        }
        setCost(''); setNotes(''); setPendingFile(null); setShowForm(false);
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Error al subir archivo');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    setDelId(id);
    try {
      await fetch(`/api/admin/vans/${vanId}/tags`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      onUpdate(records.filter(r => r.id !== id));
    } finally { setDelId(null); }
  }

  return (
    <div className="flex flex-col gap-4">
      {totalYear > 0 && (
        <div className="bg-purple-50 rounded-xl px-4 py-3 text-center">
          <p className="text-2xl font-bold text-purple-700">{fmtCLP(totalYear)}</p>
          <p className="text-xs text-purple-500 mt-0.5">Total tag {new Date().getFullYear()}</p>
        </div>
      )}

      {showForm ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Mes</label>
              <input type="month" value={month}
                onChange={e => setMonth(e.target.value)} className={ic} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Costo ($)</label>
              <input type="number" min={0} value={cost}
                onChange={e => setCost(e.target.value)}
                placeholder="15000"
                className={ic} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Notas (opcional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ruta 68, autopista…"
              className={ic} />
          </div>
          <FileInput existingUrl={null} pendingFile={pendingFile} onChange={setPendingFile} required />
          {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setShowForm(false); setPendingFile(null); setUploadErr(''); }}
              className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancelar</button>
            <button type="button" onClick={add} disabled={saving || !cost}
              className="bg-teal text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? 'Subiendo…' : 'Registrar'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="self-start flex items-center gap-1.5 bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 transition-colors">
          <span className="text-lg leading-none">+</span> Registrar mes
        </button>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Sin costos registrados</p>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map(r => (
            <div key={r.id}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between group">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {fmtMonth(r.month)}
                  </span>
                  <span className="text-sm text-gray-600">{fmtCLP(r.cost)}</span>
                  {r.file_url && <FileDocLink url={r.file_url} />}
                </div>
                {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
              </div>
              <button type="button" onClick={() => remove(r.id)} disabled={delId === r.id}
                className="text-xs text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40">
                {delId === r.id ? '…' : 'Eliminar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Tours ───────────────────────────────────────────────────────────────

function ToursTab({ records }: { records: TourRecord[] }) {
  if (records.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Sin tours registrados para esta van</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {records.map(r => (
        <div key={r.id}
          className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">
              {r.tours?.name_es ?? r.tour_slug}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(r.date)}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Bloqueos ────────────────────────────────────────────────────────────

function BlocksTab({
  van,
  blocks,
  onUpdate,
}: {
  van:     VanRow;
  blocks:  VanBlockRow[];
  onUpdate:(blocks: VanBlockRow[]) => void;
}) {
  const today  = new Date().toISOString().slice(0, 10);
  const [date,   setDate]   = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [delId,  setDelId]  = useState<string | null>(null);
  const [err,    setErr]    = useState('');

  const vanBlocks = blocks.filter(b => b.van_id === van.id && b.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  async function add() {
    if (!date) return;
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/admin/van-blocks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ van_id: van.id, date, reason: reason || undefined }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) { setErr(data.error ?? 'Error'); return; }
      onUpdate([...blocks, { id: data.id!, van_id: van.id, date, reason: reason || null }]);
      setDate(''); setReason('');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    setDelId(id);
    try {
      await fetch('/api/admin/van-blocks', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      onUpdate(blocks.filter(b => b.id !== id));
    } finally { setDelId(null); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
        <p className="text-xs font-medium text-gray-500">Bloquear fecha para {van.name}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Fecha</label>
            <input type="date" min={today} value={date}
              onChange={e => setDate(e.target.value)} className={ic} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Motivo (opcional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Mantención, uso personal…"
              className={ic} />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button type="button" onClick={add} disabled={saving || !date}
          className="self-start bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors">
          {saving ? 'Guardando…' : 'Bloquear fecha'}
        </button>
      </div>

      {vanBlocks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Sin bloqueos próximos</p>
      ) : (
        <div className="flex flex-col gap-2">
          {vanBlocks.map(b => (
            <div key={b.id}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between group">
              <div>
                <p className="text-sm font-medium text-gray-700">{fmtDate(b.date)}</p>
                {b.reason && <p className="text-xs text-gray-400">{b.reason}</p>}
              </div>
              <button type="button" onClick={() => remove(b.id)} disabled={delId === b.id}
                className="text-xs text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40">
                {delId === b.id ? '…' : 'Eliminar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── VanDetail ────────────────────────────────────────────────────────────────

type TabKey = 'maintenance' | 'fuel' | 'tags' | 'tours' | 'blocks';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'maintenance', label: 'Mantenciones' },
  { key: 'fuel',        label: 'Combustible'  },
  { key: 'tags',        label: 'Tags'         },
  { key: 'tours',       label: 'Tours'        },
  { key: 'blocks',      label: 'Bloqueos'     },
];

function VanDetail({
  van,
  blocks,
  onBlocksUpdate,
  onEdit,
}: {
  van:            VanRow;
  blocks:         VanBlockRow[];
  onBlocksUpdate: (b: VanBlockRow[]) => void;
  onEdit:         () => void;
}) {
  const [details, setDetails] = useState<VanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<TabKey>('maintenance');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vans/${van.id}/details`);
      const data = await res.json() as VanDetails;
      setDetails(data);
    } finally {
      setLoading(false);
    }
  }, [van.id]);

  useEffect(() => { load(); }, [load]);

  const subtitle = [van.brand, van.model, van.year].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-5">
      {/* Header del vehículo */}
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">{van.name}</h2>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              van.active ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
            }`}>
              {van.active ? '● Activa' : '○ Inactiva'}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {subtitle && <>{subtitle} · </>}
            {van.capacity} pax
            {van.plate && <> · {van.plate}</>}
            {van.color  && <> · {van.color}</>}
          </p>
        </div>
        <button type="button" onClick={onEdit}
          className="text-sm text-teal font-medium border border-teal/30 px-4 py-2 rounded-lg hover:bg-teal/5 transition-colors">
          Editar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          Cargando…
        </div>
      ) : details ? (
        <>
          {/* Top panels: documentos + kilometraje */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DocumentsPanel
              vanId={van.id}
              docs={details.documents}
              onUpdate={docs => setDetails(d => d ? { ...d, documents: docs } : d)}
            />
            <OdometerPanel
              vanId={van.id}
              entries={details.odometer}
              onUpdate={entries => setDetails(d => d ? { ...d, odometer: entries } : d)}
            />
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex border-b border-gray-100 overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    tab === t.key
                      ? 'border-teal text-teal bg-teal/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                  {t.key === 'blocks' && blocks.filter(b =>
                    b.van_id === van.id &&
                    b.date >= new Date().toISOString().slice(0, 10)
                  ).length > 0 && (
                    <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded-full">
                      {blocks.filter(b =>
                        b.van_id === van.id &&
                        b.date >= new Date().toISOString().slice(0, 10)
                      ).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="p-5">
              {tab === 'maintenance' && (
                <MaintenanceTab
                  vanId={van.id}
                  records={details.maintenance}
                  onUpdate={r => setDetails(d => d ? { ...d, maintenance: r } : d)}
                />
              )}
              {tab === 'fuel' && (
                <FuelTab
                  vanId={van.id}
                  records={details.fuel}
                  onUpdate={r => setDetails(d => d ? { ...d, fuel: r } : d)}
                />
              )}
              {tab === 'tags' && (
                <TagsTab
                  vanId={van.id}
                  records={details.tags}
                  onUpdate={r => setDetails(d => d ? { ...d, tags: r } : d)}
                />
              )}
              {tab === 'tours' && <ToursTab records={details.tours} />}
              {tab === 'blocks' && (
                <BlocksTab
                  van={van}
                  blocks={blocks}
                  onUpdate={onBlocksUpdate}
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-sm text-red-400">
          Error al cargar datos.{' '}
          <button type="button" onClick={load} className="underline">Reintentar</button>
        </div>
      )}
    </div>
  );
}

// ─── VansManager (principal) ──────────────────────────────────────────────────

export default function VansManager({
  vans: initialVans,
  initialBlocks,
}: {
  vans:          VanRow[];
  initialBlocks: VanBlockRow[];
}) {
  const [vansList,    setVansList]    = useState<VanRow[]>(initialVans);
  const [blocks,      setBlocks]      = useState<VanBlockRow[]>(initialBlocks);
  const [selectedId,  setSelectedId]  = useState<string | null>(initialVans[0]?.id ?? null);
  const [editTarget,  setEditTarget]  = useState<VanRow | null | 'new'>(null);

  const selectedVan = vansList.find(v => v.id === selectedId) ?? null;

  function handleSaved(saved: VanRow) {
    setVansList(prev => {
      const idx = prev.findIndex(v => v.id === saved.id);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = saved; return next;
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    setSelectedId(saved.id);
    setEditTarget(null);
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Tarjetas de vans ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {vansList.map(van => (
          <button
            key={van.id}
            type="button"
            onClick={() => setSelectedId(van.id)}
            className={`flex flex-col items-start px-4 py-3 rounded-xl border transition-all text-left min-w-[130px] ${
              selectedId === van.id
                ? 'border-teal bg-teal text-white shadow-md'
                : 'border-gray-200 bg-white text-gray-700 hover:border-teal/40 hover:bg-gray-50'
            }`}
          >
            <span className={`font-semibold text-sm ${selectedId === van.id ? 'text-white' : 'text-gray-900'}`}>
              {van.name}
            </span>
            <span className={`text-[11px] mt-0.5 ${selectedId === van.id ? 'text-teal-100' : 'text-gray-400'}`}>
              {[van.brand, van.model].filter(Boolean).join(' ') || `${van.capacity} pax`}
            </span>
            <span className={`text-[10px] mt-1 font-medium ${
              selectedId === van.id
                ? (van.active ? 'text-green-200' : 'text-gray-300')
                : (van.active ? 'text-green-500' : 'text-gray-300')
            }`}>
              {van.active ? '● Activa' : '○ Inactiva'}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setEditTarget('new')}
          className="flex flex-col items-center justify-center px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-teal/40 hover:text-teal hover:bg-gray-50 transition-all min-w-[130px] min-h-[76px] gap-1"
        >
          <span className="text-xl font-light leading-none">+</span>
          <span className="text-xs font-medium">Nueva van</span>
        </button>
      </div>

      {/* ── Detalle van seleccionada ── */}
      {selectedVan ? (
        <VanDetail
          key={selectedVan.id}
          van={selectedVan}
          blocks={blocks}
          onBlocksUpdate={setBlocks}
          onEdit={() => setEditTarget(selectedVan)}
        />
      ) : (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 flex flex-col items-center gap-3 text-gray-400">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
          <p className="text-sm">Agrega una van para comenzar</p>
        </div>
      )}

      {/* Modal edición */}
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
