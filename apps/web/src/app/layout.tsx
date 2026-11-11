import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SiteFactory — template-based websites, CRM & ERP',
  description: 'Pick a professionally built template, enter your requirements, and get your own independent website, CRM or ERP.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
