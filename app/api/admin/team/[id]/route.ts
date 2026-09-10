import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamMember, hasPermission } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_team')) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar el equipo' }, { status: 403 });
  }

  const body = await req.json() as {
    name?:               string;
    role?:               string;
    is_admin_secondary?: boolean;
    is_guide?:           boolean;
    permissions?:        Record<string, boolean>;
    active?:             boolean;
    // Perfil personal
    phone?:              string | null;
    emergency_name?:     string | null;
    emergency_phone?:    string | null;
    rut?:                string | null;
    birthdate?:          string | null;
    address?:            string | null;
    civil_status?:       string | null;
    blood_type?:         string | null;
    allergies?:          string | null;
    notes?:              string | null;
    // Habilitaciones
    languages?:          string[];
    license_class?:      string | null;
    courses?:            string[];
    // Vínculo laboral
    employment_type?:    string;
    contract_type?:      string | null;
    contract_start?:     string | null;
    contract_end?:       string | null;
    afp?:                string | null;
    health_insurance_type?: string | null;
    health_insurance_name?: string | null;
    honorarios_payment_type?:  string | null;
    // Financiero (requiere view_financials)
    salary_base?:              number | null;
    has_bonus?:                boolean;
    bonus_description?:        string | null;
    honorarios_rate_per_tour?: number | null;
    bank_name?:                string | null;
    bank_account_type?:        string | null;
    bank_account_number?:      string | null;
  };

  // Solo un admin puede otorgar el rol admin (o el permiso de admin secundario,
  // que abre la puerta a finanzas/clientes) a otra persona — evita que un
  // admin_secondary con permiso manage_team se auto-promueva.
  if (member?.role !== 'admin') {
    if (body.role === 'admin') {
      return NextResponse.json({ error: 'Solo un admin puede asignar el rol admin' }, { status: 403 });
    }
    if (body.is_admin_secondary === true) {
      return NextResponse.json({ error: 'Solo un admin puede asignar admin secundario' }, { status: 403 });
    }
  }

  const update: Record<string, unknown> = {};
  if (body.name               !== undefined) update.name               = body.name;
  if (body.role               !== undefined) update.role               = body.role;
  if (body.is_admin_secondary !== undefined) update.is_admin_secondary = body.is_admin_secondary;
  if (body.is_guide           !== undefined) update.is_guide           = body.is_guide;
  if (body.permissions        !== undefined) update.permissions        = body.permissions;
  if (body.active             !== undefined) update.active             = body.active;
  // Perfil personal
  if (body.phone              !== undefined) update.phone              = body.phone;
  if (body.emergency_name     !== undefined) update.emergency_name     = body.emergency_name;
  if (body.emergency_phone    !== undefined) update.emergency_phone    = body.emergency_phone;
  if (body.rut                !== undefined) update.rut                = body.rut;
  if (body.birthdate          !== undefined) update.birthdate          = body.birthdate;
  if (body.address            !== undefined) update.address            = body.address;
  if (body.civil_status       !== undefined) update.civil_status       = body.civil_status;
  if (body.blood_type         !== undefined) update.blood_type         = body.blood_type;
  if (body.allergies          !== undefined) update.allergies          = body.allergies;
  if (body.notes              !== undefined) update.notes              = body.notes;
  // Habilitaciones
  if (body.languages          !== undefined) update.languages          = body.languages;
  if (body.license_class      !== undefined) update.license_class      = body.license_class;
  if (body.courses            !== undefined) update.courses            = body.courses;
  // Vínculo laboral
  if (body.employment_type    !== undefined) update.employment_type    = body.employment_type;
  if (body.contract_type      !== undefined) update.contract_type      = body.contract_type;
  if (body.contract_start     !== undefined) update.contract_start     = body.contract_start;
  if (body.contract_end       !== undefined) update.contract_end       = body.contract_end;
  if (body.afp                !== undefined) update.afp                = body.afp;
  if (body.health_insurance_type !== undefined) update.health_insurance_type = body.health_insurance_type;
  if (body.health_insurance_name !== undefined) update.health_insurance_name = body.health_insurance_name;
  if (body.honorarios_payment_type !== undefined) update.honorarios_payment_type = body.honorarios_payment_type;
  // Financiero — solo view_financials o admin
  const canFinancials = member?.role === 'admin' || hasPermission(member, 'view_financials');
  if (canFinancials) {
    if (body.salary_base              !== undefined) update.salary_base              = body.salary_base;
    if (body.has_bonus                !== undefined) update.has_bonus                = body.has_bonus;
    if (body.bonus_description        !== undefined) update.bonus_description        = body.bonus_description;
    if (body.honorarios_rate_per_tour !== undefined) update.honorarios_rate_per_tour = body.honorarios_rate_per_tour;
    if (body.bank_name                !== undefined) update.bank_name                = body.bank_name;
    if (body.bank_account_type        !== undefined) update.bank_account_type        = body.bank_account_type;
    if (body.bank_account_number      !== undefined) update.bank_account_number      = body.bank_account_number;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const { error } = await supabase
    .from('team_members')
    .update(update)
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const member = await getCurrentTeamMember();
  if (!hasPermission(member, 'manage_team')) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar el equipo' }, { status: 403 });
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
