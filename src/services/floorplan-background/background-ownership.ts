/**
 * =============================================================================
 * 🏢 «Δικαιούμαι να γράψω σε ΑΥΤΟ το υπόβαθρο;» — μία φορά, για όλες τις υπηρεσίες
 * =============================================================================
 *
 * Οι δύο υπηρεσίες υποβάθρου (`floorplan-background.service`,
 * `floorplan-scale.service`) έκαναν **την ίδια ακριβώς ακολουθία** μέσα σε
 * συναλλαγή — διάβασε, «υπάρχει;», «ανήκει;» — γραμμένη δύο φορές, με
 * **διαφορετικό τύπο σφάλματος** στο τέλος: η μία `CrossTenantAccessError`, η
 * άλλη σκέτο `Error('Cross-tenant scale write denied')`. Το route της δεύτερης
 * αναγκαζόταν να διαβάσει **κείμενο μηνύματος** για να πάρει απόφαση ασφαλείας.
 *
 * Εδώ ζει η ακολουθία μία φορά, με **τυποποιημένα** σφάλματα ώστε τα routes να
 * ρωτούν `instanceof` αντί για `msg.includes(...)`.
 *
 * ⚠️ Γιατί ο έλεγχος είναι **μέσα** στη συναλλαγή: εκτός αυτής, ένα ταυτόχρονο
 * delete ανάμεσα στην ανάγνωση και την εγγραφή θα περνούσε.
 *
 * @module services/floorplan-background/background-ownership
 * @see ADR-742 (SSoT ιδιοκτησίας εγγράφου) · ADR-340 Phase 7/9
 */

import { CrossTenantAccessError, assertOwnedByCompany } from '@/lib/auth/tenant-ownership';

/** Ανθρώπινο όνομα του πόρου — μπαίνει στα δομημένα πεδία του σφάλματος. */
const RESOURCE = 'Floorplan background';

/**
 * «Δεν υπάρχει τέτοιο υπόβαθρο».
 *
 * 🔴 Είναι **τυποποιημένο** επίτηδες: το μήνυμά του παράγεται σε ένα σημείο,
 * ώστε το **μεταμφιεσμένο** 404 του ADR-742 (ξένο υπόβαθρο σε κανονικό χρήστη)
 * να είναι **πανομοιότυπο** με το γνήσιο. Αν οι δύο διαδρομές έγραφαν το
 * κείμενο χωριστά, η παραμικρή απόκλιση θα ξανάκανε το μήνυμα μαντείο ύπαρξης.
 */
export class BackgroundNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly backgroundId: string;

  constructor(backgroundId: string) {
    super(`Background not found: ${backgroundId}`);
    this.name = 'BackgroundNotFoundError';
    this.backgroundId = backgroundId;
  }
}

/**
 * «Υπάρχει, το δικαιούσαι, αλλά είναι κλειδωμένο».
 *
 * ⚠️ Ξεχωριστός τύπος από το cross-tenant **επίτηδες**: μέχρι το ADR-742 τα δύο
 * έμπαιναν στον ίδιο κλάδο (`msg.includes('Cross-tenant') || msg.includes('locked')`)
 * και έβγαιναν και τα δύο ως `409 FORBIDDEN`. Είναι όμως **αντίθετα** μεταξύ
 * τους: το «κλειδωμένο» μαρτυρά ότι ο πόρος υπάρχει **και σου ανήκει** — είναι
 * χρήσιμη πληροφορία που ο χρήστης δικαιούται· το cross-tenant είναι ακριβώς
 * αυτό που **δεν** επιτρέπεται να μαρτυρηθεί.
 */
export class BackgroundLockedError extends Error {
  readonly code = 'LOCKED' as const;
  readonly backgroundId: string;

  constructor(backgroundId: string) {
    super('Background is locked');
    this.name = 'BackgroundLockedError';
    this.backgroundId = backgroundId;
  }
}

/**
 * Ρητή άρνηση για **εγγραφή** σε υπόβαθρο — ένα σημείο, τέσσερις καλούντες.
 *
 * Η υπηρεσία λέει **πάντα την αλήθεια**: ρίχνει τυποποιημένο
 * `CrossTenantAccessError` με πλήρη δομημένα πεδία, ώστε τα logs και οι
 * εσωτερικοί καλούντες να κρατούν την πλήρη εικόνα. Τι από αυτή την αλήθεια
 * **φεύγει στο σύρμα** το αποφασίζει το route με `concealCrossTenant` — είναι
 * το μόνο στρώμα που ξέρει *ποιος* ρωτάει (ADR-742 §3.4).
 *
 * ⚠️ Το `getById()` επιλέγει σκόπιμα την **αντίθετη** πολιτική (σιωπή): εκεί ο
 * καλών δίνει id από αναξιόπιστη πηγή και η σιωπή τον εμποδίζει να απαριθμήσει
 * ξένα ids. Εδώ η αλήθεια δεν διαρρέει, γιατί τη φιλτράρει το σύνορο.
 */
export function assertBackgroundOwned(
  row: FirebaseFirestore.DocumentData,
  expectedCompanyId: string,
  id: string,
  message: string,
): void {
  assertOwnedByCompany(
    { companyId: row.companyId as string },
    expectedCompanyId,
    (actual) =>
      new CrossTenantAccessError({
        message,
        name: 'FloorplanBackgroundCrossTenantError',
        resource: RESOURCE,
        resourceId: id,
        expectedCompanyId,
        actualCompanyId: actual,
      }),
  );
}

/**
 * «Διάβασε τη γραμμή που δικαιούμαι να γράψω» — μία έννοια, τέσσερις καλούντες
 * (patchTransform, patchCalibration, deleteById, setBackgroundScale).
 */
export async function txReadOwnedRow(
  tx: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  id: string,
  expectedCompanyId: string,
  denialMessage: string,
): Promise<FirebaseFirestore.DocumentData> {
  const snap = await tx.get(ref);
  if (!snap.exists) throw new BackgroundNotFoundError(id);
  const row = snap.data() as FirebaseFirestore.DocumentData;
  assertBackgroundOwned(row, expectedCompanyId, id, denialMessage);
  return row;
}
