import { supabase } from './supabase';

export function getSeason(dateStr: string): 'summer' | 'winter' {
  const month = Number(dateStr.slice(5, 7));
  return [10, 11, 12, 1, 2, 3].includes(month) ? 'summer' : 'winter';
}

/** Hora a la que el grupo debe estar EN el primer punto del tour (no la hora de salida). */
export async function getArrivalTime(tourSlug: string, dateStr: string): Promise<string | null> {
  const { data } = await supabase
    .from('tour_schedules')
    .select('pickup_time')
    .eq('tour_slug', tourSlug)
    .eq('season', getSeason(dateStr))
    .maybeSingle();
  return typeof data?.pickup_time === 'string' ? data.pickup_time.slice(0, 5) : null;
}

/** Dirección geolocalizable de la primera parada del itinerario (el trailhead del tour). */
export async function getFirstStopAddress(tourSlug: string): Promise<string | null> {
  const { data } = await supabase
    .from('tours')
    .select('itinerary')
    .eq('slug', tourSlug)
    .maybeSingle();
  const itinerary = data?.itinerary as { address?: string }[] | null;
  return itinerary?.[0]?.address ?? null;
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
 * `arrivalTime` es la hora a la que el grupo debe estar EN el primer punto del tour
 * (el trailhead, ej. entrada Embalse El Yeso) — no la hora de salida. No existe un
 * depósito/oficina único desde donde la van siempre parte (cada van puede salir de un
 * punto distinto y variable), así que el cálculo modela una ronda que sale y vuelve al
 * propio trailhead: Google optimiza el orden de los pasajeros como waypoints de ese
 * ciclo. El primer tramo (trailhead → primera parada real) es ficticio y se descarta;
 * solo se usa el tiempo acumulado desde la primera parada real hasta el trailhead para
 * calcular, hacia atrás desde `arrivalTime`, la hora de cada pasajero.
 *
 * Retorna null (no personalizado) si falta la API key, la dirección del trailhead
 * (primera parada del itinerario sin `address`), o si la llamada a Google falla — en
 * ese caso el llamador debe usar el horario de llegada base para todos, sin romper el envío.
 */
export async function computePickupTimes(
  arrivalTime: string,
  trailheadAddress: string,
  passengers: PassengerStop[]
): Promise<Map<string, string> | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || passengers.length === 0 || !trailheadAddress) return null;

  const waypoints = passengers.map(p => encodeURIComponent(p.address)).join('|');
  const url = `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${encodeURIComponent(trailheadAddress)}` +
    `&destination=${encodeURIComponent(trailheadAddress)}` +
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
  // legs[0] es el tramo ficticio trailhead→primera parada — se descarta.
  const realLegs = route.legs.slice(1);
  const totalToTrailheadSeconds = realLegs.reduce((sum, leg) => sum + leg.duration.value, 0);
  const departureTime = addSeconds(arrivalTime, -totalToTrailheadSeconds);

  const times = new Map<string, string>();
  let cumulativeSeconds = 0;
  for (let i = 0; i < order.length; i++) {
    const passenger = passengers[order[i]];
    times.set(passenger.id, addSeconds(departureTime, cumulativeSeconds));
    cumulativeSeconds += realLegs[i].duration.value;
  }

  return times;
}
