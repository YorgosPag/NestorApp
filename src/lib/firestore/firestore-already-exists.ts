/**
 * @fileoverview **«ΥΠΑΡΧΕΙ ΗΔΗ»** — η μία ερμηνεία του σφάλματος ενός `create()` σε υπάρχον έγγραφο.
 * @related ADR-866 §2.8 (N.0.2) · config/notification-events.ts (`FIREBASE_ERROR_CODES`)
 * @module lib/firestore/firestore-already-exists
 *
 * 🔑 Το `create()` είναι ο φθηνότερος φρουρός ιδεμποτίας του Firestore: **πετά** αν η ταυτότητα υπάρχει.
 * Η ερμηνεία του σφάλματος ήταν γραμμένη με το χέρι σε **δύο** σημεία (ειδοποιήσεις · μητρώο αποδεικτικών)
 * — και διαφορετικά: το ένα δεχόταν αριθμητικό **και** κειμενικό κωδικό, το άλλο μόνο αριθμητικό. Ο φάκελος
 * του ακινήτου (ADR-866 Φ1.1) θα ήταν το τρίτο.
 *
 * ⚠️ **Και οι δύο μορφές, επίτηδες**: ο Admin SDK δίνει τον gRPC κωδικό `6`, ενώ άλλες διαδρομές του
 * Firebase δίνουν `'already-exists'`. Κριτής που ξέρει μόνο τη μία απαντά «άγνωστο σφάλμα» στην άλλη —
 * δηλαδή μια ιδεμποτική επανάληψη γίνεται `500`.
 *
 * **Layering**: leaf — καμία εξάρτηση από SDK.
 */

import { FIREBASE_ERROR_CODES } from '@/config/notification-events';

/** `true` όταν το σφάλμα λέει «το έγγραφο υπάρχει ήδη». */
export function isAlreadyExistsError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code } = error as { readonly code?: unknown };
  return code === FIREBASE_ERROR_CODES.ALREADY_EXISTS || code === FIREBASE_ERROR_CODES.ALREADY_EXISTS_STRING;
}
