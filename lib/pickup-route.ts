import { supabase } from './supabase';

export function getSeason(dateStr: string): 'summer' | 'winter' {
  const month = Number(dateStr.slice(5, 7));
  return [10, 11, 12, 1, 2, 3].includes(month) ? 'summer' : 'winter';
}

export async function getBasePickupTime(tourSlug: string, dateStr: string): Promise<string | null> {
  const { data } = await supabase
    .from('tour_schedules')
    .select('pickup_time')
    .eq('tour_slug', tourSlug)
    .eq('season', getSeason(dateStr))
    .maybeSingle();
  return typeof data?.pickup_time === 'string' ? data.pickup_time.slice(0, 5) : null;
}

function addSeconds(timeHHMM: string, seconds: number): string {
  const [h, m] = timeHHMM.split(':').map(Number);
  const base = new Date(2000, 0, 1, h, m, 0);
  base.setSeconds(base.getSeconds() + seconds);
  return base.toTimeString().slice(0, 5);
}

interface DirectionsLeg { duration: { value: number }; }
interface DirectionsRoute { legs: DirectionsLeg[]; waypoint_order: number[]; }
interface DirectionsResponse { status: string; routes: DirectionsRoute[]; error_message?: string; }

export interface PassengerStop { id: string; address: string; }

/**
 * Calcula un horario de pickup personalizado por pasajero a partir de su dirección,
 * usando Google Directions API con optimización de orden de paradas (waypoints).
 *
 * El origen y destino del cálculo se fijan en la misma dirección de depósito —no
 * tenemos la dirección exacta del punto de inicio del tour (trailhead) guardada en
 * ningún lado, así que se modela como una ronda de recogida que vuelve al depósito.
 * Esto no afecta la precisión de los horarios de cada pasajero: lo único que importa
 * para su ETA es el tiempo acumulado HASTA su parada, no el tramo final de regreso.
 *
 * Retorna null (no personalizado) si falta la API key, la dirección de depósito en
 * `config.depot_address`, o si la llamada a Google falla — en ese caso el llamador
 * debe usar el horario base del tour para todos los pasajeros, sin romper el envío.
 */
export async function computePickupTimes(
  basePickupTime: string,
  passengers: PassengerStop[]
): Promise<Map<string, string> | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || passengers.length === 0) return null;

  const { data: depotConfig } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'depot_address')
    .maybeSingle();
  const depot = typeof depotConfig?.value === 'string' ? depotConfig.value : null;
  if (!depot) return null;

  const waypoints = passengers.map(p => encodeURIComponent(p.address)).join('|');
  const url = `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${encodeURIComponent(depot)}` +
    `&destination=${encodeURIComponent(depot)}` +
    `&waypoints=optimize:true|${waypoints}` +
    `&key=${apiKey}`;

  let json: DirectionsResponse;
  try {
    const res = await fetch(url);
    json = await res.json();
  } catch (err) {
    console.error('[pickup-route] Google Directions request error:', err);
    return null;
  }

  if (json.status !== 'OK' || !json.routes?.[0]) {
    console.error('[pickup-route] Google Directions status:', json.status, json.error_message);
    return null;
  }

  const route = json.routes[0];
  const order = route.waypoint_order;
  const times = new Map<string, string>();
  let cumulativeSeconds = 0;

  for (let i = 0; i < order.length; i++) {
    cumulativeSeconds += route.legs[i].duration.value;
    const passenger = passengers[order[i]];
    times.set(passenger.id, addSeconds(basePickupTime, cumulativeSeconds));
  }

  return times;
}
