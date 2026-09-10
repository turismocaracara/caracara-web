import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { getCurrentTeamMember, isOpsViewer, hasPermission } from '@/lib/admin-auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const member = await getCurrentTeamMember();
  if (!isOpsViewer(member)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  // Pasajero + datos de su reserva
  const { data: p, error: pErr } = await supabase
    .from('passengers')
    .select(`
      id, name, id_type, id_number, email, phone, country, birth_date,
      is_lead, pickup_address, hotel_name,
      bookings!booking_id (
        id, booking_code, booking_type, status, client_id,
        tour_instances!tour_instance_id (
          date,
          tours ( name_es )
        )
      )
    `)
    .eq('id', params.id)
    .single();

  if (pErr || !p) {
    return NextResponse.json({ error: 'Pasajero no encontrado' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const booking   = (Array.isArray((p as any).bookings) ? (p as any).bookings[0] : (p as any).bookings) as Record<string, any> | null;
  const clientId  = booking?.client_id as string | undefined;

  // Historial de tours del mismo cliente
  let history: {
    booking_code: string;
    booking_type: string;
    status: string;
    tour_name: string;
    tour_date: string;
    total_amount: number | null;
  }[] = [];

  if (clientId) {
    const { data: hData } = await supabase
      .from('bookings')
      .select(`
        booking_code, booking_type, status, total_amount,
        tour_instances!tour_instance_id ( date, tours ( name_es ) )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history = ((hData ?? []) as unknown as Record<string, any>[]).map(b => {
      const inst = Array.isArray(b.tour_instances) ? b.tour_instances[0] : b.tour_instances;
      const tour = inst ? (Array.isArray(inst.tours) ? inst.tours[0] : inst.tours) : null;
      return {
        booking_code: b.booking_code  as string,
        booking_type: b.booking_type  as string,
        status:       b.status        as string,
        total_amount: b.total_amount  as number | null,
        tour_name:    (tour?.name_es  ?? '—') as string,
        tour_date:    (inst?.date     ?? '')   as string,
      };
    });
  }

  return NextResponse.json({
    id:             p.id,
    name:           p.name,
    id_type:        p.id_type,
    id_number:      p.id_number,
    email:          p.email,
    phone:          p.phone,
    country:        p.country,
    birth_date:     p.birth_date,
    is_lead:        p.is_lead,
    pickup_address: p.pickup_address,
    hotel_name:     p.hotel_name,
    current_booking: booking ? {
      booking_code: booking.booking_code as string,
      booking_type: booking.booking_type as string,
      status:       booking.status       as string,
    } : null,
    history,
  });
}

const PatchSchema = z.object({
  name:       z.string().min(1).max(200).optional(),
  id_type:    z.string().max(50).optional(),
  id_number:  z.string().max(50).optional(),
  email:      z.string().email().nullable().optional(),
  phone:      z.string().max(50).nullable().optional(),
  country:    z.string().max(100).nullable().optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manual_booking')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 422 });
  }

  // Obtener el documento actual antes de actualizar (para cascada)
  const { data: current } = await supabase
    .from('passengers')
    .select('id_type, id_number')
    .eq('id', params.id)
    .single();

  const { error: updateError } = await supabase
    .from('passengers')
    .update(parsed.data)
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Si cambió el número o tipo de documento, actualizar el resto de filas
  // del mismo pasajero (un mismo pasajero tiene una fila por reserva)
  const newIdNumber = parsed.data.id_number;
  const oldIdNumber = current?.id_number;
  const oldIdType   = current?.id_type ?? parsed.data.id_type;
  if (newIdNumber && oldIdNumber && newIdNumber !== oldIdNumber && oldIdType) {
    await supabase
      .from('passengers')
      .update({ id_number: newIdNumber, ...(parsed.data.id_type ? { id_type: parsed.data.id_type } : {}) })
      .eq('id_type', oldIdType)
      .eq('id_number', oldIdNumber)
      .neq('id', params.id);
  }

  // Devolver el pasajero actualizado (misma estructura que GET)
  const { data: p, error: fetchError } = await supabase
    .from('passengers')
    .select(`
      id, name, id_type, id_number, email, phone, country, birth_date,
      is_lead, pickup_address, hotel_name,
      bookings!booking_id (
        id, booking_code, booking_type, status, client_id,
        tour_instances!tour_instance_id (
          date,
          tours ( name_es )
        )
      )
    `)
    .eq('id', params.id)
    .single();

  if (fetchError || !p) {
    return NextResponse.json({ error: 'Pasajero no encontrado tras actualizar' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const booking  = (Array.isArray((p as any).bookings) ? (p as any).bookings[0] : (p as any).bookings) as Record<string, any> | null;
  const clientId = booking?.client_id as string | undefined;

  let history: {
    booking_code: string; booking_type: string; status: string;
    tour_name: string; tour_date: string; total_amount: number | null;
  }[] = [];

  if (clientId) {
    const { data: hData } = await supabase
      .from('bookings')
      .select(`
        booking_code, booking_type, status, total_amount,
        tour_instances!tour_instance_id ( date, tours ( name_es ) )
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history = ((hData ?? []) as unknown as Record<string, any>[]).map(b => {
      const inst = Array.isArray(b.tour_instances) ? b.tour_instances[0] : b.tour_instances;
      const tour = inst ? (Array.isArray(inst.tours) ? inst.tours[0] : inst.tours) : null;
      return {
        booking_code: b.booking_code  as string,
        booking_type: b.booking_type  as string,
        status:       b.status        as string,
        total_amount: b.total_amount  as number | null,
        tour_name:    (tour?.name_es  ?? '—') as string,
        tour_date:    (inst?.date     ?? '')   as string,
      };
    });
  }

  return NextResponse.json({
    id:             p.id,
    name:           p.name,
    id_type:        p.id_type,
    id_number:      p.id_number,
    email:          p.email,
    phone:          p.phone,
    country:        p.country,
    birth_date:     p.birth_date,
    is_lead:        p.is_lead,
    pickup_address: p.pickup_address,
    hotel_name:     p.hotel_name,
    current_booking: booking ? {
      booking_code: booking.booking_code as string,
      booking_type: booking.booking_type as string,
      status:       booking.status       as string,
    } : null,
    history,
  });
}
