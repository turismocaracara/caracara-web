import { requireAdmin } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import AdminSidebar from '@/components/admin/AdminSidebar';
import ConfigManager, { type ConfigRow } from '@/components/admin/ConfigManager';

export default async function ConfigPage() {
  const user = await requireAdmin();

  const { data, error } = await supabase
    .from('config')
    .select('key, value, updated_at');

  const rows: ConfigRow[] = (data ?? []) as ConfigRow[];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={user.email ?? ''} />
      <main className="flex-1 ml-56 p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Parámetros operacionales del sistema
            {error && (
              <span className="ml-2 text-red-500">· {error.message}</span>
            )}
          </p>
        </div>

        {error?.message.includes('schema cache') ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
            <p className="font-semibold mb-2">La tabla <code>config</code> no existe aún.</p>
            <p className="mb-3">Ejecuta este SQL en Supabase:</p>
            <pre className="bg-white border border-amber-100 rounded-lg p-3 text-xs overflow-auto font-mono whitespace-pre-wrap">{`create table if not exists public.config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.config (key, value) values
  ('group_confirmation_deadline', '"20:00"'),
  ('payment_hold_minutes',        '20'),
  ('whatsapp_number',             '"+56991384957"'),
  ('refund_reminder_hours',       '48'),
  ('min_group_pax',               '4'),
  ('exchange_rates',              '{"USD": 0, "BRL": 0, "EUR": 0}')
on conflict (key) do nothing;`}</pre>
          </div>
        ) : (
          <ConfigManager rows={rows} />
        )}
      </main>
    </div>
  );
}
