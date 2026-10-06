import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Digital Business Infrastructure',
    template: '%s · Digital Business Infrastructure',
  },
  description:
    'The digital operating infrastructure for modern businesses — websites, CRM, AI, automation, payments and analytics on one platform.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b1220',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NG" suppressHydrationWarning>
      <body className="min-h-dvh bg-background antialiased">{children}</body>
    </html>
  );
}