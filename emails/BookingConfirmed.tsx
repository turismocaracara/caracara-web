import {
  Html, Head, Body, Container, Section,
  Heading, Text, Hr, Link, Preview,
} from '@react-email/components';

interface Props {
  bookingCode:       string;
  tourName:          string;
  tourDate:          string;
  pax:               number;
  bookingType:       'private' | 'group';
  leadName:          string;
  locale:            'es' | 'en' | 'pt';
  cancellationToken: string;
}

const i18n = {
  es: {
    preview:    (code: string) => `Tu reserva ${code} está registrada`,
    title:      '¡Reserva recibida!',
    greeting:   (name: string) => `Hola ${name},`,
    intro:      'Hemos recibido tu reserva. A continuación el resumen:',
    code:       'Código de reserva',
    tour:       'Tour',
    date:       'Fecha',
    pax:        'Pasajeros',
    type:       'Modalidad',
    private:    'Tour privado',
    group:      'Tour grupal',
    groupNote:  'Tu reserva estará confirmada una vez que el tour alcance el mínimo de pasajeros. Te avisaremos a las 20:00 hrs del día anterior.',
    privateNote:'Recibirás información de pago por WhatsApp o email para confirmar tu reserva.',
    cancel:     'Para cancelar tu reserva usa el siguiente enlace:',
    cancelLink: 'Cancelar mi reserva',
    policy:     'Política de cancelación',
    policyRows: [
      '≥ 9 días antes → devolución 100%',
      '7–8 días antes → devolución 75%',
      '5–6 días antes → devolución 50%',
      '3–4 días antes → devolución 25%',
      '1–2 días antes → sin devolución',
    ],
    footer:     'Turismo CaraCara · La Reina, Santiago, Chile · turismocaracara@gmail.com',
    whatsapp:   'WhatsApp: +56 9 9138 4957',
  },
  en: {
    preview:    (code: string) => `Your booking ${code} is registered`,
    title:      'Booking received!',
    greeting:   (name: string) => `Hi ${name},`,
    intro:      'We have received your booking. Here is the summary:',
    code:       'Booking code',
    tour:       'Tour',
    date:       'Date',
    pax:        'Passengers',
    type:       'Type',
    private:    'Private tour',
    group:      'Group tour',
    groupNote:  'Your booking will be confirmed once the tour reaches the minimum number of passengers. We will notify you by 20:00 hrs the day before.',
    privateNote:'You will receive payment instructions via WhatsApp or email to confirm your booking.',
    cancel:     'To cancel your booking use the following link:',
    cancelLink: 'Cancel my booking',
    policy:     'Cancellation policy',
    policyRows: [
      '≥ 9 days before → 100% refund',
      '7–8 days before → 75% refund',
      '5–6 days before → 50% refund',
      '3–4 days before → 25% refund',
      '1–2 days before → no refund',
    ],
    footer:     'Turismo CaraCara · La Reina, Santiago, Chile · turismocaracara@gmail.com',
    whatsapp:   'WhatsApp: +56 9 9138 4957',
  },
  pt: {
    preview:    (code: string) => `Sua reserva ${code} está registrada`,
    title:      'Reserva recebida!',
    greeting:   (name: string) => `Olá ${name},`,
    intro:      'Recebemos sua reserva. Veja o resumo abaixo:',
    code:       'Código de reserva',
    tour:       'Tour',
    date:       'Data',
    pax:        'Passageiros',
    type:       'Modalidade',
    private:    'Tour privado',
    group:      'Tour em grupo',
    groupNote:  'Sua reserva será confirmada quando o tour atingir o número mínimo de passageiros. Avisaremos às 20:00 hs do dia anterior.',
    privateNote:'Você receberá instruções de pagamento via WhatsApp ou email para confirmar sua reserva.',
    cancel:     'Para cancelar sua reserva use o link abaixo:',
    cancelLink: 'Cancelar minha reserva',
    policy:     'Política de cancelamento',
    policyRows: [
      '≥ 9 dias antes → reembolso 100%',
      '7–8 dias antes → reembolso 75%',
      '5–6 dias antes → reembolso 50%',
      '3–4 dias antes → reembolso 25%',
      '1–2 dias antes → sem reembolso',
    ],
    footer:     'Turismo CaraCara · La Reina, Santiago, Chile · turismocaracara@gmail.com',
    whatsapp:   'WhatsApp: +56 9 9138 4957',
  },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

const SITE_URL = 'https://turismocaracara.cl';

export function BookingConfirmedEmail({ bookingCode, tourName, tourDate, pax, bookingType, leadName, locale, cancellationToken }: Props) {
  const t = i18n[locale];
  const cancelUrl = `${SITE_URL}/reservas/${bookingCode}?token=${cancellationToken}`;

  return (
    <Html>
      <Head />
      <Preview>{t.preview(bookingCode)}</Preview>
      <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f4f4', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' }}>

          {/* Header */}
          <Section style={{ backgroundColor: '#1a5c5c', padding: '32px 40px', textAlign: 'center' }}>
            <Heading style={{ color: '#ffffff', fontSize: '28px', margin: 0 }}>
              Turismo CaraCara
            </Heading>
            <Text style={{ color: '#e8f4f4', margin: '8px 0 0 0', fontSize: '14px' }}>
              {t.title}
            </Text>
          </Section>

          {/* Cuerpo */}
          <Section style={{ padding: '32px 40px' }}>
            <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 16px' }}>
              {t.greeting(leadName)}
            </Text>
            <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 24px' }}>
              {t.intro}
            </Text>

            {/* Resumen */}
            <Section style={{ backgroundColor: '#f8fafa', borderRadius: '8px', padding: '20px 24px', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    [t.code, <strong key="code" style={{ color: '#1a5c5c', fontSize: '18px' }}>{bookingCode}</strong>],
                    [t.tour, tourName],
                    [t.date, formatDate(tourDate)],
                    [t.pax, String(pax)],
                    [t.type, bookingType === 'private' ? t.private : t.group],
                  ].map(([label, value]) => (
                    <tr key={String(label)}>
                      <td style={{ padding: '6px 0', color: '#666', fontSize: '14px', width: '40%' }}>{label}:</td>
                      <td style={{ padding: '6px 0', color: '#333', fontSize: '14px' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* Nota según tipo */}
            <Section style={{ backgroundColor: bookingType === 'group' ? '#fff8e1' : '#e8f4f4', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' }}>
              <Text style={{ margin: 0, fontSize: '14px', color: '#555' }}>
                {bookingType === 'group' ? t.groupNote : t.privateNote}
              </Text>
            </Section>

            {/* Cancelación */}
            <Hr style={{ borderColor: '#eee', margin: '24px 0' }} />
            <Text style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              {t.cancel}
            </Text>
            <Link href={cancelUrl} style={{ color: '#c0501e', fontSize: '14px', textDecoration: 'underline' }}>
              {t.cancelLink}
            </Link>

            {/* Política */}
            <Hr style={{ borderColor: '#eee', margin: '24px 0' }} />
            <Text style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
              {t.policy}
            </Text>
            {t.policyRows.map((row, i) => (
              <Text key={i} style={{ fontSize: '13px', color: '#666', margin: '2px 0' }}>
                • {row}
              </Text>
            ))}
          </Section>

          {/* Footer */}
          <Section style={{ backgroundColor: '#1a5c5c', padding: '20px 40px', textAlign: 'center' }}>
            <Text style={{ color: '#e8f4f4', fontSize: '12px', margin: '0 0 4px' }}>{t.footer}</Text>
            <Text style={{ color: '#e8f4f4', fontSize: '12px', margin: 0 }}>{t.whatsapp}</Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
