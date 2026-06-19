import { supabase } from './supabase';

/**
 * Calcula el % de devolución según la política de cancelación vigente.
 * Prioriza una política específica del tour sobre la global (tour_slug = null).
 */
export async function getRefundPercent(tourSlug: string, daysBefore: number): Promise<number> {
  const { data } = await supabase
    .from('cancellation_policies')
    .select('tour_slug, days_before_min, days_before_max, refund_percent')
    .eq('active', true)
    .or(`tour_slug.is.null,tour_slug.eq.${tourSlug}`);

  const rows = data ?? [];
  const matches = rows.filter(r =>
    daysBefore >= r.days_before_min && (r.days_before_max === null || daysBefore <= r.days_before_max)
  );

  const specific = matches.find(r => r.tour_slug === tourSlug);
  const global   = matches.find(r => r.tour_slug === null);
  return (specific ?? global)?.refund_percent ?? 0;
}

export function daysBeforeTour(tourDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(tourDate + 'T00:00:00');
  return Math.floor((date.getTime() - today.getTime()) / 86_400_000);
}
