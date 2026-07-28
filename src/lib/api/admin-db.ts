/**
 * 🏢 SSoT — απόκτηση του Admin Firestore **μέσα από route handler**.
 *
 * ⚠️ Γιατί υπάρχει αυτό το αρχείο (μετρημένο 2026-07-28):
 *
 * Εννέα σημεία σε οκτώ διαδρομές έγραφαν το ίδιο μοτίβο, με **τρία** διαφορετικά
 * μηνύματα για το ίδιο συμβάν:
 *
 * ```ts
 * const db = getAdminFirestore();
 * if (!db) {
 *   throw new ApiError(503, 'Firestore not available', 'DB_UNAVAILABLE');
 * }
 * ```
 *
 * Αυτός ο έλεγχος **δεν εκτελείται ποτέ**. Το {@link getAdminFirestore} έχει τύπο
 * επιστροφής `Firestore`, όχι `Firestore | null`: όταν αποτύχει η αρχικοποίηση
 * **πετάει** `FirebaseAdminInitError`. Άρα το `if (!db)` ήταν νεκρό μονοπάτι που
 * *έμοιαζε* με δικλείδα — και η πραγματική αποτυχία διέφευγε από πάνω του,
 * φτάνοντας στον χρήστη ως **500 Internal Server Error** αντί για το 503 που
 * περιέγραφε η ίδια η γραμμή δίπλα του.
 *
 * Η διαφορά δεν είναι καλλωπιστική: 503 σημαίνει «ξαναδοκίμασε, η υπηρεσία είναι
 * προσωρινά κάτω» και είναι το status που σέβονται οι client retry policies και τα
 * load balancers· 500 σημαίνει «σφάλμα κώδικα, μην ξαναδοκιμάσεις».
 *
 * Εδώ ο έλεγχος γίνεται **πραγματικός**: πιάνει την αποτυχία αρχικοποίησης και τη
 * μεταφράζει σε ApiError 503 με το ΕΝΑ κανονικό μήνυμα.
 *
 * @module lib/api/admin-db
 * @enterprise ADR-245 — API Routes Centralization
 */

import type { Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { ApiError } from './api-error-types';
import { getErrorMessage } from '@/lib/error-utils';

/**
 * Επιστρέφει το Admin Firestore, ή πετάει `ApiError(503, 'DB_UNAVAILABLE')`.
 *
 * Χρήση σε **κάθε** route handler αντί για `getAdminFirestore()` + χειρόγραφο
 * `if (!db)`: ο handler δεν χρειάζεται να ξέρει πώς αποτυγχάνει η αρχικοποίηση,
 * μόνο ότι η απάντηση είναι 503.
 *
 * @throws {ApiError} 503 `DB_UNAVAILABLE` — αν η αρχικοποίηση του Admin SDK απέτυχε.
 */
export function requireAdminFirestore(): Firestore {
  try {
    return getAdminFirestore();
  } catch (error) {
    // Η αιτία μπαίνει στα `details` (όχι στο μήνυμα): το μήνυμα το βλέπει ο
    // πελάτης, ενώ η αιτία αρχικοποίησης μπορεί να αναφέρει credential source /
    // project id. Ο ApiErrorHandler αποφασίζει τι εκτίθεται ανά περιβάλλον.
    throw new ApiError(503, 'Database connection not available', 'DB_UNAVAILABLE', {
      cause: getErrorMessage(error, 'Firebase Admin initialization failed'),
    });
  }
}
