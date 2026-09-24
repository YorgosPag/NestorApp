/**
 * /vendor/quote — Public vendor portal page (ADR-876 §5).
 *
 * 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΚΟΥΒΑΛΑ ΠΙΑ ΤΟ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ.** Ο σύνδεσμος του email είναι
 * `/vendor/quote#t=<διαπιστευτήριο>` (W3C TAG *Capability URLs*): ο browser δεν στέλνει ποτέ το `#…`,
 * άρα ούτε access log, ούτε `Referer`, ούτε Safe Links το βλέπουν. Ζούσε στη διαδρομή
 * (`/vendor/quote/<token>`) και κάθε επίσκεψη το έγραφε στα logs του Netcup.
 *
 * Γι' αυτό η σελίδα είναι **κέλυφος**: ο server δεν ξέρει ποια πρόσκληση ανοίγει. Τα δεδομένα τα
 * φορτώνει ο `VendorPortalGate` με `Authorization: Bearer`, μέσα από την ίδια πόρτα και τον ίδιο
 * αναλυτή με κάθε πράξη.
 *
 * ⚠️ `force-dynamic` (CHECK 3.55) · metadata από το SSoT `credential-link-page` (noindex · no-referrer) —
 * η άγκυρα `credential-link-page.test.ts` το απαιτεί και εδώ, αφού η σελίδα ανοίγει με κλειδί.
 * ⚠️ Στο `(auth)`, ΟΧΙ στο `/o/[workspace]` (ADR-876 Ε1): ο προμηθευτής δεν έχει λογαριασμό.
 *
 * @module app/(auth)/vendor/quote/page
 * @enterprise ADR-327 §7 · ADR-876 §5
 */

import type { Metadata } from 'next';

import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';

import { VendorPortalGate } from './VendorPortalGate';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

export default function VendorQuotePage() {
  return <VendorPortalGate />;
}
