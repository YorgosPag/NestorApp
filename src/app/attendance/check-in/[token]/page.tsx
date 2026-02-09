/**
 * =============================================================================
 * /attendance/check-in/[token] — Worker Check-In Page (Server Component)
 * =============================================================================
 *
 * Public page opened when a worker scans a QR code at the construction site.
 * No authentication required — the worker is identified by the QR token + AMKA.
 *
 * @module app/attendance/check-in/[token]/page
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification
 */

import type { Metadata } from 'next';
import { CheckInClient } from './CheckInClient';

export const metadata: Metadata = {
  title: 'Παρουσία Εργαζομένου | Nestor',
  description: 'Check-in/Check-out στο εργοτάξιο μέσω QR code',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CheckInPage({ params }: PageProps) {
  const { token } = await params;
  return <CheckInClient token={decodeURIComponent(token)} />;
}
