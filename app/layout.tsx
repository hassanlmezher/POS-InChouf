import type { Metadata, Viewport } from 'next';
import './globals.css';
import { WorkingIndicator } from '@/components/shared';

export const metadata: Metadata = {
  title: 'Varelys Perfumes',
  description: 'Varelys Perfumes customer site and admin workspace.',
  icons: {
    icon: '/brand/varelys-perfumes-logo.png',
    shortcut: '/brand/varelys-perfumes-logo.png',
    apple: '/brand/varelys-perfumes-logo.png',
  },
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
