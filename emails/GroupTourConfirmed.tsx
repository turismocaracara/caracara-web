import {
  Html, Head, Body, Container, Section,
  Heading, Text, Hr, Preview,
} from '@react-email/components';

interface Props {
  bookingCode: string;
  tourName:    string;
  tourDate:    string;
  passengerName: string;
  pickupTime:  string | null; // null si todavía no hay horario configurado
  locale:      'es' | 'en' | 'pt';
}

const i18n = {
  es: {
    preview:  (code: string) => `¡Tu tour ${code} está confirmado!`,
    title:    '¡Tu tour está confirmado!',
    greeting: (name: string) => `Hola ${name},`,
    intro:    'Buenas noticias: tu tour alcanzó el mínimo de pasajeros y queda confirmado para realizarse.',
    tour:     'Tour',
    date:     'Fecha',
    code:     'Código de reserva',
    pickup:   'Hora de recogida estimada',
    noPickup: 'Te contactaremos por WhatsApp para coordinar la hora exacta de recogida.',
    footer:   'Turismo CaraCara · La Reina, Santiago, Chile · turismocaracara@gmail.com',
    whatsapp: 'WhatsApp: +56 9 9138 4957',
  },
  en: {
    preview:  (code: string) => `Your tour ${code} is confirmed!`,
    title:    'Your tour is confirmed!',
    greeting: (name: string) => `Hi ${name},`,
    intro:    'Good news: your tour reached the minimum number of passengers and is confirmed to run.',
    tour:     'Tour',
    date:     'Date',
    code:     'Booking code',
    pickup:   'Estimated pickup time',
    noPickup: 'We will contact you via WhatsApp to coordinate your exact pickup time.',
    footer:   'Turismo CaraCara · La Reina, Santiago, Chile · turismocaracara@gmail.com',
    whatsapp: 'WhatsApp: +56 9 9138 4957',
  },
  pt: {
    preview:  (code: string) => `Seu tour ${code} está confirmado!`,
    title:    'Seu tour está confirmado!',
    greeting: (name: string) => `Olá ${name},`,
    intro:    'Boas notícias: seu tour atingiu o número mínimo de passageiros e está confirmado.',
    tour:     'Tour',
    date:     'Data',
    code:     'Código de reserva',
    pickup:   'Horário estimado de busca',
    noPickup: 'Entraremos em contato pelo WhatsApp para coordenar o horário exato.',
    footer:   'Turismo CaraCara · La Reina, Santiago, Chile · turismocaracara@gmail.com',
    whatsapp: 'WhatsApp: +56 9 9138 4957',
  },
};

function formatDate(dateStr: string, locale: 'es' | 'en' | 'pt'): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(
    locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-CL',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );
}

export function GroupTourConfirmedEmail({ bookingCode, tourName, tourDate, passengerName, pickupTime, locale }: Props) {
  const t = i18n[locale];

  return (
    <Html>
      <Head />
      <Preview>{t.preview(bookingCode)}</Preview>
      <Body style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f4f4', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' }}>

          <Section style={{ backgroundColor: '#1a5c5c', padding: '32px 40px', textAlign: 'center' }}>
            <Heading style={{ color: '#ffffff', fontSize: '28px', margin: 0 }}>
              Turismo CaraCara
            </Heading>
            <Text style={{ color: '#e8f4f4', margin: '8px 0 0 0', fontSize: '14px' }}>
              {t.title}
            </Text>
          </Section>

          <Section style={{ padding: '32px 40px' }}>
            <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 16px' }}>
              {t.greeting(passengerName)}
            </Text>
            <Text style={{ fontSize: '16px', color: '#333', margin: '0 0 24px' }}>
              {t.intro}
            </Text>

            <Section style={{ backgroundColor: '#f8fafa', borderRadius: '8px', padding: '20px 24px', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    [t.code, <strong key="code" style={{ color: '#1a5c5c', fontSize: '18px' }}>{bookingCode}</strong>],
                    [t.tour, tourName],
                    [t.date, formatDate(tourDate, locale)],
                  ].map(([label, value]) => (
                    <tr key={String(label)}>
                      <td style={{ padding: '6px 0', color: '#666', fontSize: '14px', width: '40%' }}>{label}:</td>
                      <td style={{ padding: '6px 0', color: '#333', fontSize: '14px' }}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section style={{ backgroundColor: '#e8f4f4', borderRadius: '8px', padding: '16px 20px', marginBottom: '24px' }}>
              <Text style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1a5c5c' }}>
                {t.pickup}
              </Text>
              <Text style={{ margin: '4px 0 0 0', fontSize: pickupTime ? '20px' : '14px', color: '#333' }}>
                {pickupTime ?? t.noPickup}
              </Text>
            </Section>

            <Hr style={{ borderColor: '#eee', margin: '24px 0' }} />
          </Section>

          <Section style={{ backgroundColor: '#1a5c5c', padding: '20px 40px', textAlign: 'center' }}>
            <Text style={{ color: '#e8f4f4', fontSize: '12px', margin: '0 0 4px' }}>{t.footer}</Text>
            <Text style={{ color: '#e8f4f4', fontSize: '12px', margin: 0 }}>{t.whatsapp}</Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
