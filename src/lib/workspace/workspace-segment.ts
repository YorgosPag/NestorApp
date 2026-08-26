/**
 * @fileoverview **«Ποιο είναι το τμήμα διεύθυνσης αυτής της ταυτότητας;»** — μία φορά.
 * @related ADR-819 · ADR-787 Κ-1 · CHECK 3.74 · lib/workspace/alias-registry.ts
 * @module lib/workspace/workspace-segment
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ (ADR-819)
 * ────────────────────────────────────────────────────────────────────────────
 * Το ερώτημα **δεν είχε ιδιοκτήτη**. Το απαντούσε μια τριαδική έκφραση μέσα στο
 * δίχτυ `(app)/[...unprefixed]`:
 *
 * ```ts
 * const alias = identity.scope === 'organization' ? identity.ctx.companyId : 'me';
 * ```
 *
 * Ονομαζόταν `alias` και **δεν ήταν** ψευδώνυμο. Και κυρίως: **κανείς δεν
 * εγγυόταν** ότι ο `companyId` ικανοποιεί **οποιαδήποτε** από τις δύο γραμματικές
 * που δέχεται η υποδοχή `/o/<…>` — οπότε το δίχτυ μπορούσε να παράγει, και
 * παρήγαγε, διεύθυνση που **δεν λύνεται πουθενά**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΠΡΟΣΘΕΤΕΙ ΜΗΧΑΝΗ — ΚΑΝΕΙ ΤΗΝ ΥΠΑΡΧΟΥΣΑ **ΟΛΙΚΗ**
 * ────────────────────────────────────────────────────────────────────────────
 * Ο **αναγνώστης** (`resolveAlias`) ήταν ήδη υβριδικός: δέχεται *ψευδώνυμο*
 * **και** *ταυτότητα χώρου*, πάνω σε **αποδεδειγμένα ξένες** γραμματικές (το `_`
 * υπάρχει πάντα στη μία, ποτέ στην άλλη). Ο **γραφέας** έλειπε: κανείς δεν
 * απαντούσε το **αντίστροφο** ερώτημα. Εδώ ζει.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ** (ADR-819 §3):
 * • **GitHub / Slack / Linear**: το **μεταβλητό όνομα ΕΙΝΑΙ το κλειδί**. Τα ίδια
 *   τα docs του GitHub γράφουν ότι μετά τη μετονομασία το παλιό όνομα
 *   *«becomes available for someone else to claim»* και ο νέος κάτοχος *«can
 *   create repositories that override the redirect entries»* — δηλαδή **κατάληψη
 *   κίνησης**. Εδώ το ανακτημένο όνομα δεν δίνει τίποτα: κρίνει ο
 *   `decideMembership`.
 * • **Figma / Notion**: το id είναι το κλειδί, το όνομα διακοσμητικό — δεν σπάει
 *   ποτέ, αλλά **δεν διαβάζεται** ποτέ από άνθρωπο.
 * • **Εδώ**: **και τα δύο**, χωρίς διφορούμενη διεύθυνση.
 *
 * ⚠️ **Layering**: αυτό το αρχείο **δεν ξέρει από αυθεντικοποίηση**. Δέχεται
 * `WorkspaceOwner` — δύο καταστάσεις, τίποτα άλλο — ώστε να μη γεννηθεί εξάρτηση
 * `lib/workspace → server/auth`. Ο καλών κάνει την αντιστοίχιση σε μία γραμμή.
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore, isFirebaseAdminAvailable } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { judgeAliasShape } from './alias-rules';
import { readsAsWorkspaceIdentity } from './alias-registry';
import { PERSONAL_WORKSPACE_ALIAS } from '@/types/workspace-alias';

const logger = createModuleLogger('workspace-segment');

// =============================================================================
// ΤΟ ΕΡΩΤΗΜΑ ΚΑΙ ΟΙ ΑΠΑΝΤΗΣΕΙΣ
// =============================================================================

/**
 * Ο κάτοχος του χώρου — **δύο καταστάσεις, καμία τρίτη**.
 *
 * ⚠️ Ο ιδιωτικός χώρος **δεν έχει καν πεδίο** `companyId`, και αυτό είναι το
 * νόημα του τύπου: η ερώτηση «ποιος είναι ο οργανισμός σου;» πάνω του δεν είναι
 * περιττή — είναι **λάθος ερώτηση**, και ο μεταγλωττιστής δεν την επιτρέπει.
 */
export type WorkspaceOwner =
  | { readonly kind: 'personal' }
  | { readonly kind: 'organization'; readonly companyId: string };

/**
 * ⚠️ **Το `unaddressable` ΔΕΝ είναι «δεν υπάρχει».** Ίδιο δόγμα με το
 * `unavailable ⇒ 503` του `lib/auth/workspace-from-path.ts`: *«το "δεν μπόρεσα
 * να ρωτήσω" δεν επιτρέπεται να φορέσει τη στολή του "δεν υπάρχει"»*. Εδώ:
 * **«ο χώρος σου δεν έχει διεύθυνση»** είναι **χαλασμένη παροχή** (χώρος που δεν
 * πέρασε ποτέ από το `workspace-provisioning.ts`), όχι λάθος διεύθυνση — και
 * οφείλει να **φανεί**, όχι να μεταμφιεστεί σε 404.
 */
export type WorkspaceSegmentResolution =
  | {
      readonly outcome: 'segment';
      readonly segment: string;
      /** Ποια από τις τρεις διαδρομές απάντησε — για τα ίχνη, ποτέ για λογική. */
      readonly form: 'personal' | 'alias' | 'identity';
    }
  | { readonly outcome: 'unaddressable'; readonly companyId: string };

// =============================================================================
// Η ΑΠΑΝΤΗΣΗ
// =============================================================================

/**
 * Διαβάζει το **κανονικό ψευδώνυμο** του χώρου από το έγγραφό του.
 *
 * ⚠️ **ΕΙΝΑΙ ΣΗΜΕΙΑΚΗ ΑΝΑΓΝΩΣΗ ΚΑΤΑ ΚΛΕΙΔΙ, ΠΟΤΕ ΣΑΡΩΣΗ** (Ε-5 §4 #1): μια
 * αναζήτηση στο ευρετήριο ψευδωνύμων *«ποιο έγγραφο έχει αυτό το companyId;»* θα
 * ήταν **απαρίθμηση γραφείων**. Δεν χρειάζεται: το `alias` έχει **έδρα στο ίδιο
 * το έγγραφο του χώρου** — το γράφει εκεί το `workspace-provisioning.ts` επειδή
 * το **ζητά ρητά** το `alias-registry.ts`.
 *
 * ⚠️ **Το αποθηκευμένο κείμενο ΚΡΙΝΕΤΑΙ, δεν εμπιστεύεται.** Ένα αλλοιωμένο ή
 * παλιό `alias` που δεν περνά τη μορφή θα γεννούσε διεύθυνση που **δεν λύνεται**
 * — δηλαδή θα μετέτρεπε τη διόρθωση σε νέα βλάβη.
 *
 * @returns το ψευδώνυμο, ή `null` όταν δεν υπάρχει / δεν κρίνεται έγκυρο / δεν
 *          μπορέσαμε να ρωτήσουμε. **Και οι τρεις σημαίνουν το ίδιο για τον
 *          καλούντα**: «δεν έχω κανονικό όνομα — δοκίμασε την ταυτότητα».
 */
async function readCanonicalAlias(companyId: string): Promise<string | null> {
  if (!isFirebaseAdminAvailable()) {
    logger.warn('[SEGMENT] Firebase Admin μη διαθέσιμο — πέφτουμε στην ταυτότητα', { companyId });
    return null;
  }

  try {
    const snapshot = await getAdminFirestore()
      .collection(COLLECTIONS.COMPANIES)
      .doc(companyId)
      .get();

    const stored = snapshot.data()?.alias;
    if (typeof stored !== 'string' || stored.length === 0) return null;

    const shape = judgeAliasShape(stored);
    if (!shape.ok) {
      logger.error('[SEGMENT] Το έγγραφο του χώρου κρατά ψευδώνυμο άκυρης μορφής', {
        companyId,
        reason: shape.reason,
      });
      return null;
    }

    return shape.alias;
  } catch (error) {
    // ⚠️ **ΟΧΙ αποτυχία** — belt-and-suspenders (N.7.2 Q4). Μια αναλαμπή της
    //    βάσης στη στιγμή της σύνδεσης δεν επιτρέπεται να προσγειώσει σε 404
    //    κάποιον του οποίου ο `companyId` είναι μια χαρά διευθυνσιοδοτήσιμος.
    logger.error('[SEGMENT] Η ανάγνωση του ψευδωνύμου απέτυχε — πέφτουμε στην ταυτότητα', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * **Η ΜΙΑ ΑΥΘΕΝΤΙΑ**: ποιο τμήμα μπαίνει στο `/o/<εδώ>/…` για αυτόν τον κάτοχο.
 *
 * Τέσσερις ρητές εκβάσεις, με **αυτή τη σειρά**:
 *
 * | # | κανόνας | αναγνώσεις |
 * |---|---|---|
 * | 1 | ιδιωτικός χώρος ⇒ `me` | **0** |
 * | 2 | κανονικό ψευδώνυμο από το έγγραφο του χώρου | **1, κατά κλειδί** |
 * | 3 | ο `companyId` διαβάζεται ως **ταυτότητα χώρου** | 0 |
 * | 4 | τίποτα από τα παραπάνω ⇒ **`unaddressable`** | — |
 *
 * 🔑 **Γιατί το ψευδώνυμο ΠΡΩΤΑ και όχι η ταυτότητα** *(που θα κόστιζε μηδέν)*:
 * η προσγείωση συμβαίνει **μία φορά ανά σύνδεση** — μία σημειακή ανάγνωση είναι
 * φθηνή — και η αναγνώσιμη διεύθυνση είναι αυτή που ο άνθρωπος **αντιγράφει και
 * στέλνει**. Η ταυτότητα είναι το **δίχτυ που δεν σπάει ποτέ**, όχι η κανονική
 * μορφή.
 *
 * ⛔ **ΜΗΝ προσθέσεις πέμπτη έκβαση «κατασκεύασε κάτι».** Ακριβώς αυτό έκανε η
 *    τριαδική έκφραση που αντικατέστησε αυτό το αρχείο, και το αποτέλεσμα ήταν
 *    διεύθυνση που δεν λύνεται — δηλαδή **404 χωρίς αιτία στα ίχνη**.
 */
export async function workspaceSegmentFor(
  owner: WorkspaceOwner,
): Promise<WorkspaceSegmentResolution> {
  // ⚡ 1 — Ο ιδιωτικός χώρος: υπάρχει επειδή υπάρχει ο άνθρωπος. Μηδέν αναγνώσεις.
  if (owner.kind === 'personal') {
    return { outcome: 'segment', segment: PERSONAL_WORKSPACE_ALIAS, form: 'personal' };
  }

  // 2 — Η κανονική μορφή: το όνομα που έδωσε ο άνθρωπος στο γραφείο του.
  const alias = await readCanonicalAlias(owner.companyId);
  if (alias !== null) {
    return { outcome: 'segment', segment: alias, form: 'alias' };
  }

  // 3 — Το δίχτυ που δεν σπάει: η ταυτότητα **δεν παλιώνει ποτέ**.
  if (readsAsWorkspaceIdentity(owner.companyId)) {
    return { outcome: 'segment', segment: owner.companyId, form: 'identity' };
  }

  // 4 — Ούτε όνομα ούτε διευθυνσιοδοτήσιμη ταυτότητα. **Το λέμε δυνατά.**
  logger.error('[SEGMENT] Χώρος χωρίς διεύθυνση — ούτε ψευδώνυμο ούτε έγκυρη ταυτότητα', {
    companyId: owner.companyId,
  });
  return { outcome: 'unaddressable', companyId: owner.companyId };
}
