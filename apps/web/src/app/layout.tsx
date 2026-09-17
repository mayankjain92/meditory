import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meditory — Clinic-to-Clinic Healthcare Inventory',
  description: 'Last-mile medicine availability & emergency referral network for Bharat',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
