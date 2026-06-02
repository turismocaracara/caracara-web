import {
  Html, Head, Body, Container, Section,
  Heading, Text, Hr, Preview,
} from '@react-email/components';

interface Props {
  bookingCode: string;
  tourName:    string;
  tourDate:    string;
  pax:         number;
  bookingType: 'private' | 'group';
  leadName:    string;
  leadEmail:   string;
  leadPhone:   string;
  passengers:  number;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function NewBookingAdminEmail({ bookingCode, tourName, tourDate, pax, bookingType, leadName, leadEmail, leadPhone, passengers }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Nueva reserva {bookingCode} — {leadName} · {tourName}</Preview>
      <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f4f4', margin: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#fff' }}>

          <Section style={{ backgroundColor: '#1a5c5c', padding: '24px 40px' }}>
            <Heading style={{ color: '#fff', fontSize: '20px', margin: 0 }}>
              Nueva reserva recibida
            </Heading>
            <Text style={{ color: '#e8f4f4', margin: '4px 0 0', fontSize: '14px' }}>
              {bookingCode}
            </Text>
          </Section>

          <Section style={{ padding: '32px 40px' }}>
            <Section style={{ backgroundColor: '#f8fafa', borderRadius: '8px', padding: '20px 24px', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Código',     bookingCode],
                    ['Tour',       tourName],
                    ['Fecha',      formatDate(tourDate)],
                    ['Modalidad',  bookingType === 'private' ? 'Tour privado' : 'Tour grupal'],
                    ['Pasajeros',  String(pax)],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td style={{ padding: '6px 0', color: '#666', fontSize: '14px', width: '40%' }}>{label}:</td>
                      <td style={{ padding: '6px 0', color: '#333', fontSize: '14px', fontWeight: 'bold' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Hr style={{ borderColor: '#eee', margin: '0 0 24px' }} />

            <Text style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
              Datos del contacto
            </Text>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['Nombre',     leadName],
                  ['Email',      leadEmail],
                  ['Teléfono',   leadPhone],
                  ['N° pasajeros en formulario', String(passengers)],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ padding: '4px 0', color: '#666', fontSize: '14px', width: '40%' }}>{label}:</td>
                    <td style={{ padding: '4px 0', color: '#333', fontSize: '14px' }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {bookingType === 'private' && (
              <Section style={{ backgroundColor: '#fff8e1', borderRadius: '8px', padding: '16px 20px', marginTop: '24px' }}>
                <Text style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                  Tour privado — coordinar pago por WhatsApp o transferencia antes de confirmar.
                </Text>
              </Section>
            )}
            {bookingType === 'group' && (
              <Section style={{ backgroundColor: '#e8f4f4', borderRadius: '8px', padding: '16px 20px', marginTop: '24px' }}>
                <Text style={{ margin: 0, fontSize: '14px', color: '#555' }}>
                  Tour grupal — se confirma automáticamente si alcanza el mínimo a las 20:00 del día anterior.
                </Text>
              </Section>
            )}
          </Section>

          <Section style={{ backgroundColor: '#1a5c5c', padding: '16px 40px', textAlign: 'center' }}>
            <Text style={{ color: '#e8f4f4', fontSize: '12px', margin: 0 }}>
              Turismo CaraCara · Sistema de reservas
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
