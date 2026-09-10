import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCurrentTeamMember, isOpsViewer } from '@/lib/admin-auth';

interface ClientMatch {
  id:         string;
  name:       string;
  email:      string | null;
  phone:      string | null;
  country:    string | null;
  id_type:    'rut' | 'passport' | null;
  id_number:  string | null;
  birth_date: string | null;
}

function normalizeDoc(id_type: string | null, id_number: string | null): string {
  if (!id_number || !id_type) return '';
  return id_type === 'rut'
    ? `rut:${id_number.replace(/\./g, '').toUpperCase()}`
    : `${id_type}:${id_number.toUpperCase().trim()}`;
}

export async function GET(req: NextRequest) {
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 3) return NextResponse.json([]);

  const isEmail      = q.includes('@');
  const looksLikeDoc = /^[\d\-\.kK]+$/.test(q);

  // ── Buscar en clients (titulares) ────────────────────────────────────────
  let clientsQuery = supabase
    .from('clients')
    .select('id, name, email, phone, country, id_type, id_number, birth_date')
    .limit(8)
    .order('name');

  if (isEmail)       clientsQuery = clientsQuery.ilike('email',     `%${q}%`);
  else if (looksLikeDoc) clientsQuery = clientsQuery.ilike('id_number', `%${q}%`);
  else               clientsQuery = clientsQuery.ilike('name',      `%${q}%`);

  // ── Buscar en passengers (todos los pasajeros) ───────────────────────────
  let passengersQuery = supabase
    .from('passengers')
    .select('id, name, email, phone, country, id_type, id_number, birth_date')
    .limit(20)
    .order('name');

  if (isEmail)           passengersQuery = passengersQuery.ilike('email',     `%${q}%`);
  else if (looksLikeDoc) passengersQuery = passengersQuery.ilike('id_number', `%${q}%`);
  else                   passengersQuery = passengersQuery.ilike('name',      `%${q}%`);

  const [{ data: clientsData }, { data: passengersData }] = await Promise.all([
    clientsQuery,
    passengersQuery,
  ]);

  // ── Merge y deduplicar por documento normalizado ─────────────────────────
  // Primero los clients (datos más completos), luego los passengers.
  const seen  = new Map<string, ClientMatch>();
  const noDoc: ClientMatch[] = [];

  for (const row of [...(clientsData ?? []), ...(passengersData ?? [])] as ClientMatch[]) {
    const docKey = normalizeDoc(row.id_type, row.id_number);
    if (!docKey) {
      // Sin documento → incluir solo si no hay otro con el mismo nombre
      const nameKey = row.name.toLowerCase().trim();
      if (!seen.has(`name:${nameKey}`)) {
        seen.set(`name:${nameKey}`, row);
        noDoc.push(row);
      }
    } else if (!seen.has(docKey)) {
      seen.set(docKey, row);
    }
  }

  const results = Array.from(seen.values()).slice(0, 8);
  return NextResponse.json(results);
}
