import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'InChouf OrderPilot — From order to doorstep',
  description:
    'Independent commerce, order preparation and merchant-managed delivery for your business.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
