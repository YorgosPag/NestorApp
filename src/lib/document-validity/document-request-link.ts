/**
 * @fileoverview ADR-915 §28 — **η διεύθυνση του συνδέσμου ανάθεσης**: `/document-request#t=<διαπιστευτήριο>`.
 * @related lib/tokens/credential-fragment.ts (η κοινή γραμματική) · app/(auth)/document-request/page.tsx
 * @module lib/document-validity/document-request-link
 *
 * Το διαπιστευτήριο ζει **μόνο** στο fragment (ADR-876 §5): ούτε access log, ούτε `Referer`, ούτε Safe Links. Η σελίδα
 * είναι κέλυφος· τα δεδομένα έρχονται με `Authorization: Bearer` από την πόρτα του συνδέσμου.
 *
 * **Layering**: leaf.
 */

import { credentialFragmentLocation } from '@/lib/tokens/credential-fragment';

/** Η διαδρομή της σελίδας — **χωρίς** διαπιστευτήριο. */
export const DOCUMENT_REQUEST_PATH = '/document-request';

/** Το κλειδί της καρτέλας για τον σύνδεσμο (ένα ανά πύλη — `useFragmentCredential`). */
export const DOCUMENT_REQUEST_STORAGE_KEY = 'nestor.document-request.link';

/** Σχετική τοποθεσία του συνδέσμου — το origin το βάζει ο αποστολέας (`publicUrl`, `null` ⇒ κανένα email). */
export function documentRequestLocation(token: string): string {
  return credentialFragmentLocation(DOCUMENT_REQUEST_PATH, token);
}

/** Η σελίδα δεν έχει επιπλέον πεδία στο fragment — η απάντηση επιλέγεται **πάνω** στη σελίδα, ποτέ από τον σύνδεσμο. */
export function noDocumentRequestExtras(): null {
  return null;
}
