/**
 * =============================================================================
 * /attendance/check-in/[token] — Worker Check-In Page (Server Component)
 * =============================================================================
 *
 * Public page opened when a worker scans a QR code at the construction site.
 * No authentication required — the worker is identified by the QR token + AMKA.
 *
 * 🔴 **ΓΙΑΤΙ ΣΤΟ `(auth)` ΚΑΙ ΟΧΙ ΣΤΟ `/o/[workspace]` (ADR-876 Ε2).** Το `5ff0baa2` (ADR-787 §5.3)
 * την είχε βάλει κάτω από τον χώρο, και ο φρουρός ταυτότητας του layout έστελνε τον εργάτη —
 * που δεν έχει λογαριασμό — στο `/login`. Το QR (`/api/attendance/qr/generate`) έδειχνε σε
 * σελίδα που **κανένας** εργάτης δεν μπορούσε να ανοίξει. Βρέθηκε ψάχνοντας την ΚΛΑΣΗ του
 * ευρήματος της πύλης προμηθευτή, όχι το δείγμα.
 *
 * ⚠️ `force-dynamic` (CHECK 3.55) · metadata από το SSoT `credential-link-page` (noindex ·
 * no-referrer) — το απαιτεί η άγκυρα `credential-link-page.test.ts`.
 *
 * @module app/(auth)/attendance/check-in/[token]/page
 * @enterprise ADR-170 — QR Code + GPS Geofencing + Photo Verification · ADR-876
 */

import type { Metadata } from 'next';
import { CheckInClient } from '@/components/attendance/check-in/CheckInClient';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';

export const dynamic = 'force-dynamic';

// ⚠️ Χωρίς `title`: εδώ ζούσε ωμό ελληνικό κείμενο (N.11) — ο τίτλος της καρτέλας είναι το
//    όνομα του προϊόντος (`title.template` της ρίζας, ADR-857 Φ8α), όπως σε κάθε σελίδα-διαπιστευτήριο.
export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CheckInPage({ params }: PageProps) {
  const { token } = await params;
  return <CheckInClient token={decodeRouteParam(token)} />;
}
