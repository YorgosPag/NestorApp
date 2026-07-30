/**
 * Εκκαθάριση ληγμένων εγγράφων OAuth (ADR-738 §10)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ Η ΛΗΞΗ ΔΕΝ ΕΙΝΑΙ ΑΡΚΕΤΟ ΚΡΙΤΗΡΙΟ ΔΙΑΓΡΑΦΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το προφανές θα ήταν «σβήσε ό,τι έχει `expiresAt` στο παρελθόν». **Θα έσπαγε
 * δύο μηχανισμούς ασφαλείας**, και μάλιστα σιωπηλά:
 *
 * 1. **Επανάληψη authorization code.** Το `redeemAuthorizationCode()` ξεχωρίζει
 *    το `already_redeemed` από το `not_found` — και **μόνο** στο πρώτο ρίχνει
 *    την οικογένεια tokens μέσω του `issuedFamilyId`. Αν ο εξαργυρωμένος code
 *    διαγραφεί 60 δευτερόλεπτα μετά την έκδοσή του, μια μεταγενέστερη επανάληψη
 *    διαβάζεται ως «άγνωστος code» αντί για «σήμα κλοπής», και η οικογένεια
 *    επιβιώνει στα χέρια του κλέφτη.
 *
 * 2. **Επαναχρησιμοποίηση refresh token.** Ο `rotateRefreshToken()` ελέγχει το
 *    `revokedAt` **πριν** το `expiresAt` — επίτηδες: ένα ανακλημένο refresh που
 *    ξαναεμφανίζεται είναι σήμα κλοπής ακόμη κι όταν το ίδιο είναι πλέον
 *    άχρηστο. Διαγραφή του καταργεί την ανίχνευση.
 *
 * Άρα ο κανόνας δεν είναι «έληξε ⇒ φύγε» αλλά «έληξε **και** πέρασε το παράθυρο
 * μέσα στο οποίο η απουσία του θα άλλαζε απόφαση ασφαλείας».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ΠΟΤΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * - **`oauth_consents`** — δεν έχουν `expiresAt`. Είναι οι αποφάσεις του
 *   ανθρώπου· ακόμη και ανακλημένες αποτελούν το ιστορικό «σε ποιον έδωσα και
 *   πότε πήρα πίσω». Η διαγραφή τους θα ήταν απώλεια ελεγκτικού ίχνους, όχι
 *   εκκαθάριση.
 * - **`oauth_clients`** — δηλωμένη στο `COLLECTIONS` αλλά **χωρίς καμία εγγραφή**:
 *   το CIMD cache του `client-id-metadata.ts` ζει στη μνήμη της διεργασίας και
 *   πεθαίνει μαζί της. Δεν υπάρχει τίποτα να καθαριστεί.
 *
 * @module lib/oauth/oauth-cleanup
 * @see ADR-738 §5, §10
 */

import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { OAUTH_TTL } from './oauth-config';

const logger = createModuleLogger('oauth-cleanup');

// ============================================================================
// ΠΑΡΑΘΥΡΑ ΔΙΑΤΗΡΗΣΗΣ
// ============================================================================

/**
 * Πόσο **μετά τη λήξη** κρατιέται ένα έγγραφο που φέρει σήμανση χρήσης.
 *
 * Ισούται με τη διάρκεια ζωής ενός refresh token — δηλαδή με το μέγιστο διάστημα
 * που μπορεί να ζήσει μια οικογένεια tokens **χωρίς** νέα ανανέωση. Πέρα από
 * αυτό, μια οικογένεια που δεν ανανεώθηκε στο μεταξύ έχει ήδη πεθάνει μόνη της,
 * οπότε δεν υπάρχει τίποτα να ανακληθεί και η ανίχνευση δεν έχει σε τι να
 * ενεργήσει.
 *
 * ⚠️ **Μην το μειώσεις για να «αδειάσει γρηγορότερα η βάση».** Το κόστος είναι
 * μερικά έγγραφα· το όφελος είναι ότι κάθε σήμα κλοπής βρίσκει ακόμη ζωντανό
 * στόχο να ρίξει.
 */
export const REUSE_DETECTION_RETENTION_MS = OAUTH_TTL.REFRESH_TOKEN_MS;

/**
 * Περιθώριο για απόκλιση ρολογιών, στα έγγραφα **χωρίς** σήμανση χρήσης.
 *
 * Τα εκκρεμή αιτήματα εξουσιοδότησης δεν συμμετέχουν σε καμία ανίχνευση: το
 * `consumed` απλώς απορρίπτεται, χωρίς cascade. Άρα καθαρίζονται με τη λήξη
 * τους — με μια ώρα περιθώριο ώστε ένα έγγραφο να μη σβήνεται ενώ κάποιος server
 * με ελαφρώς πίσω ρολόι το θεωρεί ακόμη έγκυρο.
 */
export const CLOCK_SKEW_GRACE_MS = 60 * 60 * 1_000;

/**
 * Πόσα έγγραφα ανά συλλογή ανά εκτέλεση.
 *
 * Το `maxDuration` του route είναι 60 δευτερόλεπτα. Καλύτερα μια εκτέλεση που
 * τελειώνει και αφήνει υπόλοιπο για την επόμενη, παρά μια που κόβεται στη μέση
 * αφήνοντας το batch μισοεκτελεσμένο.
 */
export const CLEANUP_BATCH_LIMIT = 300;

// ============================================================================
// ΑΠΟΤΕΛΕΣΜΑ
// ============================================================================

export interface CollectionCleanupResult {
  readonly collection: string;
  /** Πόσα βρέθηκαν να πληρούν το κριτήριο σε αυτή την εκτέλεση. */
  readonly scanned: number;
  readonly deleted: number;
  /** `true` αν το batch γέμισε — υπάρχει κι άλλο για την επόμενη εκτέλεση. */
  readonly hasMore: boolean;
}

export interface OAuthCleanupReport {
  readonly results: readonly CollectionCleanupResult[];
  readonly totalDeleted: number;
  readonly durationMs: number;
}

// ============================================================================
// ΔΙΑΓΡΑΦΗ
// ============================================================================

/**
 * Σβήνει έως `CLEANUP_BATCH_LIMIT` έγγραφα μιας συλλογής με `expiresAt <= cutoff`.
 *
 * Το ερώτημα είναι μονοπεδιακό, άρα καλύπτεται από το αυτόματο index της
 * Firestore — καμία σύνθετη δήλωση δεν χρειάζεται.
 */
async function deleteExpiredBefore(
  collection: string,
  cutoffMs: number,
): Promise<CollectionCleanupResult> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(collection)
    .where('expiresAt', '<=', Timestamp.fromMillis(cutoffMs))
    .limit(CLEANUP_BATCH_LIMIT)
    .get();

  if (snapshot.empty) {
    return { collection, scanned: 0, deleted: 0, hasMore: false };
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  return {
    collection,
    scanned: snapshot.size,
    deleted: snapshot.size,
    hasMore: snapshot.size === CLEANUP_BATCH_LIMIT,
  };
}

// ============================================================================
// ΟΡΧΗΣΤΡΩΣΗ
// ============================================================================

/**
 * Καθαρίζει τις τρεις συλλογές που έχουν `expiresAt`, καθεμιά με το **δικό της**
 * κριτήριο.
 *
 * ⚠️ Τα `now` περνιούνται ως όρισμα ώστε η συνάρτηση να είναι ελέγξιμη χωρίς
 * χειραγώγηση ρολογιού.
 */
export async function cleanupExpiredOAuthDocuments(
  now: number = Date.now(),
): Promise<OAuthCleanupReport> {
  const startedAt = now;

  const results = await Promise.all([
    // Εκκρεμή αιτήματα: καμία ανίχνευση επάνω τους ⇒ φεύγουν με τη λήξη.
    deleteExpiredBefore(COLLECTIONS.OAUTH_AUTH_REQUESTS, now - CLOCK_SKEW_GRACE_MS),
    // Codes: ο εξαργυρωμένος code ΕΙΝΑΙ ο ανιχνευτής επανάληψης — βλ. επικεφαλίδα.
    deleteExpiredBefore(COLLECTIONS.OAUTH_CODES, now - REUSE_DETECTION_RETENTION_MS),
    // Tokens: το ανακλημένο refresh ΕΙΝΑΙ ο ανιχνευτής κλοπής — βλ. επικεφαλίδα.
    deleteExpiredBefore(COLLECTIONS.OAUTH_TOKENS, now - REUSE_DETECTION_RETENTION_MS),
  ]);

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  const durationMs = Date.now() - startedAt;

  logger.info('[OAUTH] Cleanup complete', {
    totalDeleted,
    durationMs,
    perCollection: results.map((r) => `${r.collection}:${r.deleted}${r.hasMore ? '+' : ''}`),
  });

  return { results, totalDeleted, durationMs };
}
