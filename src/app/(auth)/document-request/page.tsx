/**
 * /document-request — η σελίδα του συνδέσμου ανάθεσης έκδοσης, **χωρίς λογαριασμό** (ADR-915 §28).
 *
 * 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΔΕΝ ΚΟΥΒΑΛΑ ΤΟ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ.** Ο σύνδεσμος του email είναι `/document-request#t=<σύνδεσμος>`
 * (W3C TAG *Capability URLs*, ADR-876 §5): ο browser δεν στέλνει ποτέ το `#…`, άρα ούτε access log, ούτε `Referer`, ούτε
 * Safe Links το βλέπουν. Γι' αυτό η σελίδα είναι **κέλυφος**· τα δεδομένα τα φορτώνει ο `DocumentRequestGate` με
 * `Authorization: Bearer`, από την ίδια πόρτα με την απάντηση.
 *
 * ⚠️ `force-dynamic` (CHECK 3.55) · metadata από το SSoT `credential-link-page` (noindex · no-referrer).
 * ⚠️ Στο `(auth)`, ΟΧΙ στο `/o/[workspace]`: ο ιδιοκτήτης και ο επαγγελματίας δεν έχουν λογαριασμό (ίδιο με το `vendor`).
 *
 * @module app/(auth)/document-request/page
 */

import type { Metadata } from 'next';

import { CREDENTIAL_LINK_PAGE_METADATA } from '@/lib/tokens/credential-link-page';

import { DocumentRequestGate } from './DocumentRequestGate';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = CREDENTIAL_LINK_PAGE_METADATA;

export default function DocumentRequestPage() {
  return <DocumentRequestGate />;
}
