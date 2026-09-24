/**
 * /vendor/quote/[token] — **ΜΟΝΟ ανακατεύθυνση** στη μορφή fragment (ADR-876 §5 Φ3).
 *
 * Σύνδεσμοι που στάλθηκαν **πριν** από το ADR-876 §5 κουβαλούν το διαπιστευτήριο στη διαδρομή.
 * Εδώ μεταφέρεται στο fragment (`/vendor/quote#t=…`) και η πύλη συνεχίζει από τον client.
 * Αυτό το αίτημα γράφτηκε ήδη στα logs — γι' αυτό ακριβώς οι νέοι σύνδεσμοι δεν περνούν ποτέ από εδώ.
 *
 * ⚠️ **ΚΑΜΙΑ ανάγνωση βάσης, καμία πράξη** (άγκυρα Α4: τα Safe Links ανοίγουν κάθε GET).
 * ⚠️ Διαγράφεται στη Φ7 του ADR-876 §5, μετά τη μέγιστη λήξη συνδέσμου παλιάς μορφής που μέτρησε η
 * migration (`migrate:vendor-invite-credentials`).
 *
 * @module app/(auth)/vendor/quote/[token]/page
 * @enterprise ADR-876 §5
 */

import 'server-only';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';
import { decodeRouteParam } from '@/lib/routes/route-param';
import {
  asVendorPortalIntent,
  vendorPortalLocation,
} from '@/subapps/procurement/services/vendor-portal-links';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ intent?: string | string[] }>;
}

export default async function LegacyVendorQuotePage({ params, searchParams }: PageProps) {
  const { token: rawToken } = await params;
  const { intent } = await searchParams;
  redirect(vendorPortalLocation(decodeRouteParam(rawToken), asVendorPortalIntent(intent)));
}
