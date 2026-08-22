/**
 * «Ποιος χώρος λέγεται έτσι;» — το ευρετήριο ψευδωνύμων, μία φορά
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ (ADR-787 §5.3 δ · Ε-5 §8)
 * ─────────────────────────────────────────────────────────────────────────────
 * Δύο ερωτήσεις, και **μόνο** αυτές:
 *
 * 1. **ΑΝΑΓΝΩΣΗ** — *«σε ποιον χώρο δείχνει το `/o/<ψευδώνυμο>`;»*
 * 2. **ΔΕΣΜΕΥΣΗ** — *«μπορεί αυτός ο χώρος να πάρει αυτό το όνομα;»* (**Ψ1**)
 *
 * ⛔ **ΔΕΝ απαντά «επιτρέπεται να μπει;»** — αυτό το κάνει ο απαντητής
 * (`decideMembership`, ADR-787 §5.1 ε). Το ευρετήριο μεταφράζει **όνομα σε
 * ταυτότητα**· η **άδεια** είναι άλλο ερώτημα, και η ένωσή τους θα έκανε τη
 * διεύθυνση **απόδειξη** αντί για **ερώτηση** (Ε-5 §2).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΤΟΜΙΚΟΤΗΤΑ ΕΙΝΑΙ ΤΟΥ FIRESTORE, ΟΧΙ ΔΙΚΗ ΜΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο σκελετός **είναι το κλειδί εγγράφου**, και η δέσμευση γίνεται με `create()`,
 * που **αποτυγχάνει αν το έγγραφο υπάρχει**. Άρα δύο ταυτόχρονα αιτήματα για
 * οπτικά ταυτόσημα ονόματα **δεν μπορούν** να πετύχουν και τα δύο — χωρίς
 * κλείδωμα, χωρίς transaction, χωρίς «έλεγξε μετά γράψε» που έχει κενό ανάμεσα.
 *
 * ⛔ **ΜΗΝ το ξαναγράψεις ως `get()` και μετά `set()`**: ανάμεσά τους χωράει ένα
 *    δεύτερο αίτημα, και τότε δύο γραφεία μοιράζονται όνομα που **φαίνεται ίδιο**.
 *
 * @module lib/workspace/alias-registry
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import type { AliasVerdict, WorkspaceAliasRecord } from '@/types/workspace-alias';
import { judgeAliasShape } from './alias-rules';
import { skeleton } from '@/lib/unicode/skeleton';

const logger = createModuleLogger('workspace-alias-registry');

// =============================================================================
// ΟΙ ΕΤΥΜΗΓΟΡΙΕΣ ΤΗΣ ΑΝΑΓΝΩΣΗΣ — ΤΡΕΙΣ, ΡΗΤΕΣ
// =============================================================================

/**
 * ⚠️ **Οι τρεις καταστάσεις ΔΕΝ ενώνονται.**
 *
 * | | τι σημαίνει | τι κάνει ο καλών |
 * |---|---|---|
 * | `found` | το ψευδώνυμο δείχνει σε χώρο | ρωτά τον **απαντητή** αν επιτρέπεται |
 * | `not-found` | **κοιτάξαμε, δεν υπάρχει** | 404 |
 * | `unknown` | **ΔΕΝ κοιτάξαμε** — η αναζήτηση απέτυχε | ⛔ **ποτέ 404** |
 *
 * 🔴 Το `unknown` είναι ο λόγος που ο τύπος είναι ένωση και όχι
 * `string | null`: ένα `null` θα έλεγε *«δεν υπάρχει τέτοιο γραφείο»* τη στιγμή
 * που η αλήθεια είναι *«η βάση δεν απάντησε»* — **άγνωστο ≠ κενό** (N.12 ·
 * Ε-5 §4 #3). Και η συνέπεια δεν είναι θεωρητική: ο άνθρωπος θα έβλεπε
 * *«αυτή η σελίδα δεν υπάρχει»* για το **δικό του** γραφείο.
 */
export type AliasResolution =
  | {
      readonly outcome: 'found';
      readonly companyId: string;
      /** `false` όταν το ψευδώνυμο είναι **παλιό** αλλά εξακολουθεί να λύνεται. */
      readonly current: boolean;
      /** Το **τρέχον** ψευδώνυμο του χώρου, αν το ζητούμενο είναι παλιό. */
      readonly canonicalAlias: string | null;
    }
  | { readonly outcome: 'not-found' }
  | { readonly outcome: 'unknown' };

// =============================================================================
// 1. ΑΝΑΓΝΩΣΗ — «ποιος χώρος λέγεται έτσι;»
// =============================================================================

/**
 * Μεταφράζει ψευδώνυμο σε ταυτότητα χώρου.
 *
 * ⚠️ **Η αναζήτηση γίνεται με τον ΣΚΕΛΕΤΟ**, όχι με το κείμενο — αλλιώς ένας
 * σύνδεσμος με ελληνικό `ο` θα απαντούσε *«δεν υπάρχει»* για γραφείο που
 * **υπάρχει**, και ο άνθρωπος δεν θα είχε τρόπο να δει τη διαφορά.
 *
 * ⚠️ Είναι **σημειακή ανάγνωση κατά κλειδί, ποτέ σάρωση** (`tenant-config.ts`,
 * `global-index`): ένας κατάλογος ψευδωνύμων **είναι απαρίθμηση γραφείων**, που
 * απαγορεύει το Ε-5 §4 #1.
 */
export async function resolveAlias(rawAlias: string): Promise<AliasResolution> {
  const shape = judgeAliasShape(rawAlias);
  // ⚠️ Άκυρη μορφή ⇒ `not-found`, ΟΧΙ σφάλμα: ένα `/o/!!!` είναι διεύθυνση που
  //    δεν υπάρχει, όχι βλάβη. Και δεν αγγίζουμε τη βάση για κείμενο που δεν
  //    μπορεί να είναι ψευδώνυμο.
  if (!shape.ok) return { outcome: 'not-found' };

  if (!isFirebaseAdminAvailable()) {
    logger.error('[ALIAS] Firebase Admin μη διαθέσιμο — άγνωστο, όχι κενό', { alias: shape.alias });
    return { outcome: 'unknown' };
  }

  try {
    const snapshot = await getAdminFirestore()
      .collection(COLLECTIONS.WORKSPACE_ALIASES)
      .doc(shape.skeleton)
      .get();

    if (!snapshot.exists) return { outcome: 'not-found' };

    const record = snapshot.data() as Partial<WorkspaceAliasRecord> | undefined;
    const companyId = typeof record?.companyId === 'string' ? record.companyId : null;

    // ⚠️ Έγγραφο χωρίς `companyId` είναι **χαλασμένο**, όχι «δεν υπάρχει». Το να
    //    το λέγαμε `not-found` θα έκρυβε αλλοίωση δεδομένων πίσω από 404.
    if (!companyId) {
      logger.error('[ALIAS] Εγγραφή ευρετηρίου χωρίς companyId — άγνωστο, όχι κενό', {
        skeleton: shape.skeleton,
      });
      return { outcome: 'unknown' };
    }

    return {
      outcome: 'found',
      companyId,
      current: record?.current === true,
      canonicalAlias: null,
    };
  } catch (error) {
    logger.error('[ALIAS] Η αναζήτηση ψευδωνύμου απέτυχε — άγνωστο, όχι κενό', {
      alias: shape.alias,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unknown' };
  }
}

// =============================================================================
// 2. ΔΕΣΜΕΥΣΗ — Ψ1
// =============================================================================

/**
 * Δεσμεύει ψευδώνυμο για χώρο. **Ο Ψ1 επιβάλλεται από το ίδιο το Firestore.**
 *
 * ⚠️ Το `create()` **αποτυγχάνει αν το έγγραφο υπάρχει** — εκεί ζει η
 * μοναδικότητα. Ο κώδικας δεν ρωτά «υπάρχει;» και μετά γράφει: ανάμεσα στις δύο
 * πράξεις χωράει δεύτερο αίτημα.
 *
 * ⚠️ Η διάκριση `already-taken` / `look-alike-taken` γίνεται **μετά** την
 * αποτυχία, με **μία** επιπλέον ανάγνωση — και μόνο τότε. Ο άνθρωπος που βλέπει
 * ελεύθερο όνομα και απόρριψη **οφείλει** να μάθει ότι υπάρχει άλλο που
 * *φαίνεται* ίδιο, αλλιώς ξαναδοκιμάζει το ίδιο πράγμα.
 *
 * ⛔ **ΔΕΝ αποκαλύπτει ποιο γραφείο** κρατά το όνομα — αυτό θα ήταν απαρίθμηση.
 */
export async function claimAlias(companyId: string, rawAlias: string): Promise<AliasVerdict> {
  const shape = judgeAliasShape(rawAlias);
  if (!shape.ok) return shape;

  if (!isFirebaseAdminAvailable()) {
    logger.error('[ALIAS] Firebase Admin μη διαθέσιμο — η δέσμευση δεν επιχειρήθηκε', { companyId });
    throw new Error('ALIAS_REGISTRY_UNAVAILABLE');
  }

  const record: Omit<WorkspaceAliasRecord, 'createdAt'> & { createdAt: Date } = {
    companyId,
    alias: shape.alias,
    current: true,
    createdAt: new Date(),
    retiredAt: null,
  };

  try {
    await getAdminFirestore()
      .collection(COLLECTIONS.WORKSPACE_ALIASES)
      .doc(shape.skeleton)
      .create(record);
    return shape;
  } catch {
    return describeCollision(shape.skeleton, shape.alias, companyId);
  }
}

/**
 * Γιατί απέτυχε η δέσμευση — **αφού** έχει ήδη αποτύχει.
 *
 * ⚠️ Fail-closed: αν η διάγνωση **κι αυτή** αποτύχει, η απάντηση είναι
 * `already-taken` — δηλαδή **απόρριψη**. Το να επιστρέφαμε επιτυχία επειδή δεν
 * μπορέσαμε να διαγνώσουμε θα ήταν το χειρότερο δυνατό: παραχώρηση ονόματος
 * επειδή **δεν κοιτάξαμε**.
 */
async function describeCollision(
  skeletonKey: string,
  alias: string,
  companyId: string,
): Promise<AliasVerdict> {
  try {
    const existing = await getAdminFirestore()
      .collection(COLLECTIONS.WORKSPACE_ALIASES)
      .doc(skeletonKey)
      .get();
    const data = existing.data() as Partial<WorkspaceAliasRecord> | undefined;

    // Ο ΙΔΙΟΣ χώρος ξαναζητά το ΙΔΙΟ όνομα ⇒ δεν είναι σύγκρουση, είναι idempotency.
    if (data?.companyId === companyId && data?.alias === alias) {
      return { ok: true, alias, skeleton: skeletonKey };
    }

    const takenAlias = typeof data?.alias === 'string' ? data.alias : null;
    if (takenAlias === alias) {
      return { ok: false, reason: 'already-taken', detail: 'το όνομα χρησιμοποιείται ήδη' };
    }
    return {
      ok: false,
      reason: 'look-alike-taken',
      // ⛔ ΠΟΤΕ το ίδιο το υπάρχον όνομα ούτε ο κάτοχός του — απαρίθμηση (Ε-5 §4 #1).
      detail: 'υπάρχει ήδη ψευδώνυμο που φαίνεται ταυτόσημο — διάλεξε άλλο όνομα',
    };
  } catch (error) {
    logger.error('[ALIAS] Η διάγνωση σύγκρουσης απέτυχε — απόρριψη (fail-closed)', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: 'already-taken', detail: 'το όνομα δεν είναι διαθέσιμο' };
  }
}

/** Ο σκελετός ενός ψευδωνύμου — για διαγνωστικά και άγκυρες. */
export function aliasKey(rawAlias: string): string {
  return skeleton(rawAlias.normalize('NFC').trim().toLowerCase());
}
