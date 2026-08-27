/**
 * =============================================================================
 * ΚΑΤΑΣΚΕΥΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΧΩΡΩΝ — «ποιοι χώροι είναι δικοί μου»
 * =============================================================================
 *
 * 🔑 **ΓΙΑΤΙ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗ ΔΙΑΔΡΟΜΗ** (ADR-787 §5.1, εξήχθη 2026-08-27):
 * το `api/workspaces/route.ts` είναι **σύνορο HTTP** — διαβάζει αίτημα, κρίνει
 * κατάσταση, γράφει απόκριση. Το *«πώς μοιάζει ένας χώρος στον κατάλογο»* είναι
 * **γνώση του τομέα**, και τη χρειάζεται όποιος απαντήσει ποτέ την ίδια ερώτηση
 * από άλλη πόρτα. Η εξαγωγή έγινε όταν η διαδρομή πέρασε το όριο των **300**
 * γραμμών του CHECK 4 — και το όριο έδειξε το σωστό σημείο κοπής, όχι ένα βολικό.
 *
 * ⚠️ **ΕΙΝΑΙ SERVER-ONLY ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ**: το `buildOrgWorkspaces` ανοίγει
 * το Admin SDK. Το ADR-787 §2.7 β απαγορεύει ρητά να ρωτά ο φυλλομετρητής τη
 * συλλογή των χώρων — η απαρίθμηση γραφείων είναι ακριβώς η βλάβη που κλείνει.
 *
 * @module lib/workspace/workspace-catalog
 * @see docs/centralized-systems/reference/adrs/ADR-787-multi-organization-platform.md §5.1
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  orgWorkspace,
  personalWorkspace,
  workspaceRefKey,
} from '@/types/workspace-membership';
import type { Workspace } from '@/types/workspace';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('lib:workspace-catalog');

/**
 * Το όνομα του ιδιωτικού χώρου **δεν μπαίνει εδώ ως κείμενο**.
 *
 * ⚠️ Ο κανόνας **N.11** απαγορεύει ωμές συμβολοσειρές οθόνης στον κώδικα, και
 * ο κανόνας ισχύει και στον διακομιστή: το κείμενο *«Τα προσωπικά μου»* που
 * σκιαγραφεί το **ADR-787 Ε-3 §1** είναι **ετικέτα οθόνης**, άρα ζει στα
 * locale αρχεία και το επιλέγει η οθόνη από το `type: 'personal'`.
 * Ο διακομιστής στέλνει **κενό** — και αυτό είναι πληροφορία, όχι παράλειψη.
 */
const PERSONAL_DISPLAY_NAME = '';

/**
 * Ο ιδιωτικός χώρος — **παραγόμενος, ποτέ αποθηκευμένος**.
 *
 * ⛔ **ΔΕΝ έχει `companyId`, και δεν επιτρέπεται να αποκτήσει** (ADR-787 Ε-3
 *    §3): θα έδινε σιωπηλά στον διαχειριστή ενός γραφείου πρόσβαση στο ψάξιμο
 *    σπιτιού ενός ανθρώπου — **πράσινο σε κάθε πύλη**. Ο τύπος
 *    `PersonalWorkspaceRef` το κάνει ήδη αδύνατο· εδώ κρατιέται και στην
 *    προβολή.
 */
export function buildPersonalWorkspace(uid: string): Workspace {
  return {
    id: workspaceRefKey(personalWorkspace(uid)),
    type: 'personal',
    displayName: PERSONAL_DISPLAY_NAME,
    status: 'active',
    createdAt: nowISO(),
    createdBy: uid,
  };
}

/**
 * Οι χώροι γραφείου, με το όνομά τους από το `companies/{id}`.
 *
 * ⚠️ Ένας χώρος του οποίου το έγγραφο **λείπει** δεν πετιέται σιωπηλά: η
 * συμμετοχή υπάρχει, άρα ο χώρος υπάρχει· λείπει μόνο το **όνομα**. Σιωπηλή
 * απόρριψη εδώ θα ξανάφτιαχνε το *«δεν έχεις χώρους»* από την πίσω πόρτα.
 */
export async function buildOrgWorkspaces(
  orgIds: ReadonlySet<string>,
  uid: string,
): Promise<Workspace[]> {
  if (orgIds.size === 0) return [];

  const db = getAdminFirestore();
  const ids = [...orgIds];
  const snapshots = await Promise.all(
    ids.map((id) => db.collection(COLLECTIONS.COMPANIES).doc(id).get()),
  );

  return ids.map((companyId, index) => {
    const data = snapshots[index].data();
    const name = typeof data?.name === 'string' ? data.name : '';
    if (!snapshots[index].exists) {
      logger.warn('[WORKSPACES] Συμμετοχή σε χώρο χωρίς έγγραφο — κρατιέται χωρίς όνομα', {
        uid,
        companyId,
      });
    }
    return {
      id: workspaceRefKey(orgWorkspace(companyId)),
      type: 'company',
      displayName: name,
      companyId,
      status: 'active',
      createdAt: nowISO(),
      createdBy: uid,
    };
  });
}
