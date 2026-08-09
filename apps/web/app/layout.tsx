import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'LedgerLab', description: 'Synthetic multi-tenant expense demo' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
