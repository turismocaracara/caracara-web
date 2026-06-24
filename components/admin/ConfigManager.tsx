'use client';

import { useState } from 'react';

export interface ConfigRow {
  key: string;
  value: unknown;
  updated_at: string;
}

function parseConfig(rows: ConfigRow[], key: string, fallback: unknown) {
  const row = rows.find(r => r.key === key);
  return row?.value ?? fallback;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Sección genérica con botón de guardar ────────────────────────────────────
function Section({
  title,
  description,
  children,
  onSave,
  saving,
  saved,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
      <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-teal text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && <span className="text-xs text-teal">✓ Guardado</span>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

const inputClass = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full max-w-xs';

// ── Componente principal ─────────────────────────────────────────────────────
export default function ConfigManager({ rows }: { rows: ConfigRow[] }) {
  // — Operación de grupos —
  const [deadline, setDeadline]   = useState(String(parseConfig(rows, 'group_confirmation_deadline', '20:00')));
  const [holdMin,  setHoldMin]    = useState(Number(parseConfig(rows, 'payment_hold_minutes', 20)));
  const [minPax,   setMinPax]     = useState(Number(parseConfig(rows, 'min_group_pax', 4)));
  const [savingOp, setSavingOp]   = useState(false);
  const [savedOp,  setSavedOp]    = useState(false);

  // — Cancelaciones —
  const [remindHrs,  setRemindHrs]  = useState(Number(parseConfig(rows, 'refund_reminder_hours', 48)));
  const [savingCan,  setSavingCan]  = useState(false);
  const [savedCan,   setSavedCan]   = useState(false);

  // — Contacto —
  const [waNumber, setWaNumber] = useState(String(parseConfig(rows, 'whatsapp_number', '+56991384957')));
  const [savingCon, setSavingCon] = useState(false);
  const [savedCon,  setSavedCon]  = useState(false);

  // — Pickup —
  const [depotAddress, setDepotAddress] = useState(String(parseConfig(rows, 'depot_address', '')));
  const [savingPickup, setSavingPickup] = useState(false);
  const [savedPickup,  setSavedPickup]  = useState(false);

  // Tipos de cambio (readonly)
  const ratesRow    = rows.find(r => r.key === 'exchange_rates');
  const rates       = (ratesRow?.value ?? {}) as Record<string, number>;
  const ratesUpdate = ratesRow?.updated_at;

  async function patch(key: string, value: unknown) {
    const res = await fetch('/api/admin/config', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key, value }),
    });
    return res.ok;
  }

  async function saveOperacion() {
    setSavingOp(true);
    await Promise.all([
      patch('group_confirmation_deadline', deadline),
      patch('payment_hold_minutes',        holdMin),
      patch('min_group_pax',               minPax),
    ]);
    setSavingOp(false);
    setSavedOp(true);
    setTimeout(() => setSavedOp(false), 3000);
  }

  async function saveCancelacion() {
    setSavingCan(true);
    await patch('refund_reminder_hours', remindHrs);
    setSavingCan(false);
    setSavedCan(true);
    setTimeout(() => setSavedCan(false), 3000);
  }

  async function saveContacto() {
    setSavingCon(true);
    await patch('whatsapp_number', waNumber);
    setSavingCon(false);
    setSavedCon(true);
    setTimeout(() => setSavedCon(false), 3000);
  }

  async function savePickup() {
    setSavingPickup(true);
    await patch('depot_address', depotAddress);
    setSavingPickup(false);
    setSavedPickup(true);
    setTimeout(() => setSavedPickup(false), 3000);
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Operación de grupos */}
      <Section
        title="Operación de tours grupales"
        description="Parámetros que controlan cuándo se confirma o cancela un tour grupal"
        onSave={saveOperacion}
        saving={savingOp}
        saved={savedOp}
      >
        <Field
          label="Hora límite de confirmación grupal"
          hint="A esta hora del día anterior se ejecuta el cron: si hay ≥ mínimo de pax, el tour se confirma; si no, Cristóbal recibe alerta."
        >
          <input
            type="time"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="Mínimo de pasajeros para ejecutar un tour grupal"
          hint="Si al momento de confirmación hay menos pax que este número, el tour entra en protocolo de no-cancelación."
        >
          <input
            type="number"
            min={1}
            max={9}
            value={minPax}
            onChange={e => setMinPax(Number(e.target.value))}
            className={inputClass}
          />
        </Field>

        <Field
          label="Tiempo de hold de pago (minutos)"
          hint="Minutos que se mantiene reservado el cupo mientras el cliente va a MercadoPago. Si no paga, el cupo se libera."
        >
          <input
            type="number"
            min={5}
            max={60}
            value={holdMin}
            onChange={e => setHoldMin(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </Section>

      {/* Cancelaciones */}
      <Section
        title="Cancelaciones y devoluciones"
        description="Tiempos de notificación para devoluciones pendientes"
        onSave={saveCancelacion}
        saving={savingCan}
        saved={savedCan}
      >
        <Field
          label="Recordatorio de devolución pendiente (horas)"
          hint="Si una devolución no ha sido aprobada en este tiempo, Cristóbal recibe un recordatorio automático por email."
        >
          <input
            type="number"
            min={1}
            max={168}
            value={remindHrs}
            onChange={e => setRemindHrs(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </Section>

      {/* Contacto */}
      <Section
        title="Contacto"
        description="Datos de contacto usados en emails y links de WhatsApp"
        onSave={saveContacto}
        saving={savingCon}
        saved={savedCon}
      >
        <Field
          label="Número de WhatsApp"
          hint="Con código de país. Se usa en los links wa.me y en el panel de mensajes de no-cancelación."
        >
          <input
            type="tel"
            placeholder="+56991384957"
            value={waNumber}
            onChange={e => setWaNumber(e.target.value)}
            className={inputClass}
          />
        </Field>
      </Section>

      {/* Pickup */}
      <Section
        title="Pickup automático"
        description="Dirección de salida usada para calcular el orden y horario de recogida por pasajero"
        onSave={savePickup}
        saving={savingPickup}
        saved={savedPickup}
      >
        <Field
          label="Dirección de salida (depósito/oficina)"
          hint="Se usa junto con Google Maps para calcular el orden de recogida y el horario estimado por pasajero. Sin esto (o sin la API key configurada), se envía solo el horario base del tour."
        >
          <input
            type="text"
            placeholder="Av. Ejemplo 123, La Reina, Santiago"
            value={depotAddress}
            onChange={e => setDepotAddress(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal w-full max-w-md"
          />
        </Field>
      </Section>

      {/* Tipos de cambio — readonly */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Tipos de cambio</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Actualizados automáticamente cada día por el cron job
            {ratesUpdate && <> · última actualización: {fmtDate(ratesUpdate)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(rates).length === 0 ? (
            <p className="text-xs text-gray-400">Sin datos aún — el cron actualiza diariamente a las 08:00 Santiago.</p>
          ) : (
            Object.entries(rates).map(([currency, rate]) => (
              <div key={currency} className="bg-gray-50 rounded-lg px-4 py-2.5 text-center">
                <p className="text-xs font-semibold text-gray-500">{currency}</p>
                <p className="text-sm font-bold text-gray-900">
                  {Number(rate).toLocaleString('es-CL')} <span className="text-xs font-normal text-gray-400">CLP</span>
                </p>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
