/**
 * Admin SDK `Timestamp` → ο client τύπος `Timestamp` που δηλώνουν τα συμβόλαια οντοτήτων
 * (`Quote`, `VendorInvite`, …) της πύλης προμηθευτή.
 *
 * Οι δύο υλοποιήσεις είναι δομικά συμβατές σε χρόνο εκτέλεσης — διαφέρει μόνο ο accessor
 * `toJSON` στο σχήμα TS — οπότε η δομική μετατροπή είναι ασφαλής και γίνεται **εδώ, μία φορά**,
 * αντί για `as unknown as Timestamp` σε κάθε ανάθεση.
 *
 * ⚠️ Ζούσε μέσα στο `vendor-portal-token-service.ts`, που καταργήθηκε με το ADR-876 §5
 * (ένας σύνδεσμος = ένα διαπιστευτήριο). Δεν είχε σχέση με tokens.
 *
 * @module services/vendor-portal/admin-client-timestamp
 */

import 'server-only';

import admin from 'firebase-admin';
import type { Timestamp as ClientTimestamp } from 'firebase/firestore';

export function adminTimestampAsClient(
  ts: admin.firestore.Timestamp = admin.firestore.Timestamp.now(),
): ClientTimestamp {
  return ts as unknown as ClientTimestamp;
}

export function adminTimestampFromDateAsClient(date: Date): ClientTimestamp {
  return admin.firestore.Timestamp.fromDate(date) as unknown as ClientTimestamp;
}
