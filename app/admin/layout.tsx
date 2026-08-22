import { GeistSans } from 'geist/font/sans';
import '../globals.css';

export const metadata = {
  title: 'Admin — CaraCara',
  robots: 'noindex',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={GeistSans.variable}>
      <body className="bg-gray-50 min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
