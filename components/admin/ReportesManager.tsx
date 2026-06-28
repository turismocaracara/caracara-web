'use client';

import { useState } from 'react';

export interface MonthlyRevenue {
  month:   string; // YYYY-MM
  revenue: number;
  pax:     number;
  count:   number;
}

export interface TourMonthRevenue {
  tour_slug: string;
  tour_name: string;
  revenue:   number;
  pax:       number;
  count:     number;
  instances: number;
}

export interface CostItemRow {
  id:         string;
  tour_slug:  string;
  concept:    string;
  amount_clp: number;
  unit:       'per_person' | 'per_van' | 'fixed';
}

export interface TourOption {
  slug: string;
  name_es: string;
}

export interface MonthlyAbandoned {
  month:  string; // YYYY-MM
  count:  number;
  amount: number;
}

export interface TourAbandoned {
  tour_slug: string;
  tour_name: string;
  count:     number;
  amount:    number;
}

export interface AbandonedStage {
  stage:  'before_mp' | 'at_mp';
  label:  string;
  count:  number;
  amount: number;
}

function fmtCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
}

const UNIT_LABEL: Record<string, string> = {
  per_person: 'por persona',
  per_van:    'por van/tour',
  fixed:      'fijo (si corrió ese mes)',
};

function estimateCost(items: CostItemRow[], slug: string, pax: number, instances: number): number {
  return items
    .filter(i => i.tour_slug === slug)
    .reduce((sum, i) => {
      if (i.unit === 'per_person') return sum + i.amount_clp * pax;
      if (i.unit === 'per_van')    return sum + i.amount_clp * instances;
      return sum + (instances > 0 ? i.amount_clp : 0); // fixed: solo si corrió
    }, 0);
}

// ── Sección: ingresos mensuales ──────────────────────────────────────────────
function MonthlyRevenueSection({ months }: { months: MonthlyRevenue[] }) {
  const maxRevenue = Math.max(...months.map(m => m.revenue), 1);
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Ingresos — últimos 6 meses
      </h2>
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-end gap-3 h-32 mb-3">
          {months.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-teal/15 hover:bg-teal/25 rounded-t-md transition-colors relative"
                style={{ height: `${Math.max((m.revenue / maxRevenue) * 100, 2)}%` }}
                title={fmtCLP(m.revenue)}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {months.map(m => (
            <div key={m.month} className="flex-1 text-center">
              <p className="text-xs font-semibold text-gray-700">{fmtCLP(m.revenue)}</p>
              <p className="text-[11px] text-gray-400 capitalize">{fmtMonth(m.month)}</p>
              <p className="text-[10px] text-gray-300">{m.pax} pax · {m.count} res.</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Sección: este mes por tour ───────────────────────────────────────────────
function TourMonthSection({ tours, costItems }: { tours: TourMonthRevenue[]; costItems: CostItemRow[] }) {
  const sorted = [...tours].sort((a, b) => b.revenue - a.revenue);
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Este mes por tour
      </h2>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/60">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Reservas</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Pax</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Ingresos</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Costo est.</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Rentabilidad est.</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const cost = estimateCost(costItems, t.tour_slug, t.pax, t.instances);
              const profit = t.revenue - cost;
              return (
                <tr key={t.tour_slug} className={i > 0 ? 'border-t border-gray-50' : ''}>
                  <td className="px-4 py-3 text-gray-800 font-medium">{t.tour_name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{t.count}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{t.pax}</td>
                  <td className="px-4 py-3 text-right text-gray-800 font-semibold">{fmtCLP(t.revenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{cost > 0 ? fmtCLP(cost) : '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmtCLP(profit)}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Sin reservas este mes</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">
        Rentabilidad estimada en base a los costos fijos ingresados abajo. No incluye gastos operacionales reales (combustible, peajes) hasta que el equipo los registre desde la app de guías.
      </p>
    </section>
  );
}

// ── Sección: ventas no concretadas ───────────────────────────────────────────
function AbandonedSalesSection({
  monthly,
  byTour,
  stages,
}: {
  monthly: MonthlyAbandoned[];
  byTour:  TourAbandoned[];
  stages:  AbandonedStage[];
}) {
  const maxCount = Math.max(...monthly.map(m => m.count), 1);
  const totalCount  = stages.reduce((s, st) => s + st.count, 0);
  const totalAmount = stages.reduce((s, st) => s + st.amount, 0);

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
        Ventas no concretadas
      </h2>
      <p className="text-xs text-gray-400 mb-3">
        Reservas creadas pero nunca pagadas — el cliente abandonó antes de que venciera el hold de pago.
      </p>

      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
        <div className="flex items-end gap-3 h-24 mb-3">
          {monthly.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-orange-100 hover:bg-orange-200 rounded-t-md transition-colors"
                style={{ height: `${Math.max((m.count / maxCount) * 100, m.count > 0 ? 4 : 0)}%` }}
                title={`${m.count} reservas · ${fmtCLP(m.amount)}`}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          {monthly.map(m => (
            <div key={m.month} className="flex-1 text-center">
              <p className="text-xs font-semibold text-gray-700">{m.count}</p>
              <p className="text-[11px] text-gray-400 capitalize">{fmtMonth(m.month)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Este mes: por etapa de abandono */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {stages.map(s => (
          <div key={s.stage} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label} · este mes</p>
            <p className="text-xl font-bold text-gray-900">{s.count}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {s.amount > 0 ? `${fmtCLP(s.amount)} potencial` : 'monto no registrado'}
            </p>
          </div>
        ))}
      </div>
      {totalCount > 0 && (
        <p className="text-[11px] text-gray-400 mb-4">
          Total este mes: {totalCount} reservas · {fmtCLP(totalAmount)} potencial (solo cuenta el monto de las reservas que llegaron a calcular un precio).
        </p>
      )}

      {/* Este mes: por tour */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/60">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Tour</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500">Reservas no concretadas</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Monto potencial</th>
            </tr>
          </thead>
          <tbody>
            {byTour.map((t, i) => (
              <tr key={t.tour_slug} className={i > 0 ? 'border-t border-gray-50' : ''}>
                <td className="px-4 py-3 text-gray-800 font-medium">{t.tour_name}</td>
                <td className="px-4 py-3 text-center text-gray-600">{t.count}</td>
                <td className="px-4 py-3 text-right text-gray-800">{t.amount > 0 ? fmtCLP(t.amount) : '—'}</td>
              </tr>
            ))}
            {byTour.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">Sin ventas abandonadas este mes</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Sección: costos fijos por tour ───────────────────────────────────────────
function CostItemsSection({
  initialItems,
  tours,
}: {
  initialItems: CostItemRow[];
  tours: TourOption[];
}) {
  const [items, setItems]       = useState(initialItems);
  const [tourSlug, setTourSlug] = useState(tours[0]?.slug ?? '');
  const [concept, setConcept]   = useState('');
  const [amount, setAmount]     = useState('');
  const [unit, setUnit]         = useState<CostItemRow['unit']>('per_person');
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function addItem() {
    if (!tourSlug || !concept || !amount) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cost-items', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tour_slug: tourSlug, concept, amount_clp: Number(amount), unit }),
      });
      const data = await res.json() as { ok?: boolean; id?: string };
      if (res.ok && data.id) {
        setItems(prev => [...prev, { id: data.id!, tour_slug: tourSlug, concept, amount_clp: Number(amount), unit }]);
        setConcept(''); setAmount('');
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    setDeleting(id);
    try {
      await fetch('/api/admin/cost-items', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id }),
      });
      setItems(prev => prev.filter(i => i.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  const byTour = items.reduce<Record<string, CostItemRow[]>>((acc, item) => {
    (acc[item.tour_slug] ??= []).push(item);
    return acc;
  }, {});

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Costos fijos por tour
      </h2>

      <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select value={tourSlug} onChange={e => setTourSlug(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
            {tours.map(t => <option key={t.slug} value={t.slug}>{t.name_es}</option>)}
          </select>
          <input
            type="text"
            placeholder="Concepto (ej: Entrada CONAF)"
            value={concept}
            onChange={e => setConcept(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
          <input
            type="number"
            min={0}
            placeholder="Monto CLP"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal"
          />
          <select value={unit} onChange={e => setUnit(e.target.value as CostItemRow['unit'])} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal bg-white">
            <option value="per_person">Por persona</option>
            <option value="per_van">Por van/tour</option>
            <option value="fixed">Fijo mensual</option>
          </select>
        </div>
        <button
          type="button"
          onClick={addItem}
          disabled={saving || !tourSlug || !concept || !amount}
          className="self-start bg-teal text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando…' : 'Agregar costo'}
        </button>
      </div>

      {Object.keys(byTour).length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Sin costos registrados aún</p>
      ) : (
        <div className="flex flex-col gap-3">
          {Object.entries(byTour).map(([slug, list]) => {
            const tourName = tours.find(t => t.slug === slug)?.name_es ?? slug;
            return (
              <div key={slug} className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">{tourName}</p>
                <div className="flex flex-col gap-1.5">
                  {list.map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        {item.concept} <span className="text-gray-300">· {UNIT_LABEL[item.unit]}</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-800">{fmtCLP(item.amount_clp)}</span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={deleting === item.id}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          {deleting === item.id ? '…' : '✕'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function ReportesManager({
  monthlyRevenue,
  tourMonthRevenue,
  costItems,
  tours,
  monthlyAbandoned,
  tourAbandoned,
  abandonedStages,
}: {
  monthlyRevenue:    MonthlyRevenue[];
  tourMonthRevenue:  TourMonthRevenue[];
  costItems:         CostItemRow[];
  tours:             TourOption[];
  monthlyAbandoned:  MonthlyAbandoned[];
  tourAbandoned:     TourAbandoned[];
  abandonedStages:   AbandonedStage[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <MonthlyRevenueSection months={monthlyRevenue} />
      <TourMonthSection tours={tourMonthRevenue} costItems={costItems} />
      <AbandonedSalesSection monthly={monthlyAbandoned} byTour={tourAbandoned} stages={abandonedStages} />
      <CostItemsSection initialItems={costItems} tours={tours} />
    </div>
  );
}
