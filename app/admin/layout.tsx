import { Inter } from 'next/font/google';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'Admin — CaraCara',
  robots: 'noindex',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-gray-50 min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
