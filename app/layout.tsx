import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WorkingIndicator } from '@/components/shared';

export const metadata: Metadata = {
  title: 'InChouf OrderPilot — From order to doorstep',
  description:
    'Independent commerce, order preparation and merchant-managed delivery for your business.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WorkingIndicator />
        {children}
      </body>
    </html>
  );
}
