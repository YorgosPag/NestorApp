/**
 * /showcase/[token] — δημόσια προβολή ακινήτου με δικό της εισιτήριο.
 *
 * ⚠️ `force-dynamic` (CHECK 3.55). Τα `noindex`/`no-referrer` (ADR-876) τα κληρονομεί από το
 * `(link)/layout.tsx`, που τα δηλώνει μία φορά για όλη την ομάδα (ADR-939 §6). Εδώ ζούσε ωμό
 * `title: 'Property Showcase'` (N.11) — ο τίτλος της καρτέλας είναι πλέον το όνομα του
 * προϊόντος (ADR-857 Φ8α).
 *
 * @module app/(link)/showcase/[token]/page
 */

import { ShowcaseClient } from '@/components/property-showcase/ShowcaseClient';

export const dynamic = 'force-dynamic';

export default async function ShowcasePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ShowcaseClient token={token} />;
}
