import { NextRequest } from 'next/server';
import { supabase } from './supabase';

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// Atómico vía función Postgres (rate_limit_hit) — evita la carrera de leer-luego-escribir
// que tendría un incremento hecho desde el cliente JS. Si la infraestructura de rate
// limiting falla, deja pasar la request (fail-open) en vez de bloquear tráfico real.
export async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('rate_limit_hit', { p_key: key, p_window_seconds: windowSeconds });
  if (error) {
    console.error('[rate-limit] error, allowing request:', error.message);
    return true;
  }
  return (data as number) <= maxRequests;
}
