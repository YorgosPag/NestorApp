/**
 * /showcase/[token] — δημόσια προβολή ακινήτου με δικό της εισιτήριο.
 *
 * ⚠️ `force-dynamic` (CHECK 3.55) · metadata από το SSoT `credential-link-page` (noindex ·
 * no-referrer, ADR-876). Εδώ ζούσε ωμό `title: 'Property Showcase'` (N.11) και **έλειπε** το
 * `no-referrer` — ο τίτλος της καρτέλας είναι πλέον το όνομα του προϊόντος (ADR-857 Φ8α).
 *
 * @module app/(app)/showcase/[token]/page
 */

import type { Metadata } from 'next';
import { ShowcaseClient } from '@/components/property-showcase/ShowcaseClient';
import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

export default async function ShowcasePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ShowcaseClient token={token} />;
}
