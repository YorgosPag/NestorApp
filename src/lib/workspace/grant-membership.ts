import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΙΔΙΟΤΗΤΑΣ ΜΕΛΟΥΣ** — ADR-853 Φ3 · Μ2.
 * @related ADR-787 §5.1 (ο κριτής «είναι μέλος;») · ADR-853 Α2/Μ1/Μ2 · ADR-195 (ίχνος) · ADR-749
 * @module lib/workspace/grant-membership
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ — ΤΡΙΑ ΣΗΜΕΙΑ ΕΓΡΑΦΑΝ «ΠΑΡΟΜΟΙΑ ΑΛΛΑ ΟΧΙ ΙΔΙΑ» ΔΟΥΛΕΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετρημένο πριν γραφτεί γραμμή (ADR-853 §2): **δεν υπήρχε** επαναχρησιμοποιήσιμος
 * `grantMembership`. Η `syncFirestoreRecords` ήταν **μη εξαγόμενη**, τοπική στο
 * `api/admin/set-user-claims/claims-handler.ts`, και δίπλα της ζούσαν δύο ακόμη γραφείς
 * (`lib/workspace/workspace-provisioning.ts` · `server/auth/citizen-identity.ts`).
 *
 * Η **αποδοχή πρόσκλησης** θα ήταν ο **τέταρτος** — δηλαδή το σχήμα του ADR-749 πάνω στο
 * ερώτημα *«τι σημαίνει ότι κάποιος είναι μέλος αυτού του χώρου;»*. Η άγκυρα **Μ2**
 * απαιτεί ρητά ότι **η έγκριση αιτήματος ΚΑΙ η αποδοχή πρόσκλησης καλούν την ΙΔΙΑ**
 * συνάρτηση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ **ΔΕΝ** ΚΑΝΕΙ: ΔΕΝ ΑΓΓΙΖΕΙ CLAIMS. ΠΟΤΕ.
 * ─────────────────────────────────────────────────────────────────────────────
 * Η `syncFirestoreRecords` έκανε **δύο** πράγματα: έγραφε τον καθρέφτη `users/{uid}`
 * *(ταυτότητα + `globalRole` + `companyId`)* **και** το έγγραφο μέλους. Εξήχθη **μόνο το
 * δεύτερο**, και δεν είναι καλλωπισμός:
 *
 * Η **Μ1** απαιτεί ότι άνθρωπος που **έχει ήδη** χώρο και δέχεται πρόσκληση αλλού
 * **γράφεται μέλος χωρίς να αλλάξει το claim του** (ADR-853 Α2 — αλλιώς ένα γραφείο θα
 * «έκλεβε» μέλος άλλου με μία πρόσκληση). Αν αυτή η συνάρτηση έγραφε claims, η αποδοχή θα
 * **μετακινούσε** τον άνθρωπο — ακριβώς η συμπεριφορά που το ADR **απέρριψε ονομαστικά**.
 *
 * ⇒ Το *«παίρνει claim ή όχι;»* το αποφασίζει **ο καλών**, που είναι ο μόνος που ξέρει το
 * πλαίσιο: ο `claims-handler` δίνει ρητά ρόλο *(διοικητική πράξη)*· η διαδρομή αποδοχής
 * δίνει claim **μόνο** σε άνθρωπο **χωρίς** χώρο (Α2, «πλήρης λειτουργία σήμερα»).
 *
 * **Layering**: server — Admin SDK. Καμία κρίση «επιτρέπεται;» εδώ: αυτή ζει στον
 * `decideCapability` (ADR-801) και τρέχει **πριν**, στο σύνορο HTTP.
 */

import { FieldValue as AdminFieldValue, type Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { GlobalRole } from '@/lib/auth/types';

const logger = createModuleLogger('grant-membership');

/**
 * Ό,τι χρειάζεται η ένταξη — και **τίποτα παραπάνω**.
 *
 * ⚠️ Δέχεται `grantedByUid` **ρητά** αντί για ολόκληρο `AuthContext`: ο γραφέας δεν
 * πρέπει να μπορεί να κρίνει *«επιτρέπεται;»* από τα δικά του ορίσματα — η κρίση έγινε
 * **πριν**, στο σύνορο. Ίδιο ιδίωμα με το `MembershipQuery` του ADR-787 §5.1, που δέχεται
 * τα διαπιστευτήρια χωριστά ώστε να μη μπορεί να απαντήσει με τη δική του παλιά απάντηση.
 */
export interface GrantMembershipInput {
  readonly uid: string;
  readonly companyId: string;
  readonly globalRole: GlobalRole;
  /** Ποιος έδωσε την ιδιότητα — διαχειριστής (έγκριση) ή ο **ίδιος** (αποδοχή πρόσκλησης). */
  readonly grantedByUid: string;
}

/**
 * **Η γραφή, ΜΕΣΑ σε συναλλαγή** — για καλούντες που χρειάζονται **ατομικότητα**.
 *
 * 🔴 **ΥΠΑΡΧΕΙ ΓΙΑ ΤΗΝ ΑΓΚΥΡΑ Τ3**, και δεν είναι πολυτέλεια: η αποδοχή πρόσκλησης πρέπει
 * να γυρίσει `pending → accepted` **και** να γράψει το μέλος **αδιαίρετα**. Με δύο
 * χωριστές πράξεις, μια αποτυχία ανάμεσά τους αφήνει πρόσκληση **`accepted` χωρίς μέλος**
 * — δηλαδή άνθρωπο που «δέχτηκε» και δεν μπήκε ποτέ, με το token του **καμένο**.
 *
 * ⚠️ **ΚΑΜΙΑ ΑΝΑΓΝΩΣΗ ΕΔΩ, ΕΠΙΤΗΔΕΣ.** Το Firestore απαιτεί **όλες** τις αναγνώσεις μιας
 * συναλλαγής **πριν** από κάθε γραφή· μια `tx.get()` κρυμμένη σε αυτή τη συνάρτηση θα
 * έσπαγε **τον καλούντα**, σε σημείο που εκείνος δεν βλέπει.
 *
 * ⚠️ **Και κανένα ίχνος εδώ**: το {@link EntityAuditService} κάνει **δικές του** γραφές,
 * που δεν ανήκουν στη συναλλαγή του καλούντα. Δες {@link recordMembershipGrantAudit}.
 *
 * ⛔ **ΜΕΙΝΕ ΚΑΘΑΡΗ — ΚΑΜΙΑ ΠΑΡΕΝΕΡΓΕΙΑ, ΠΟΤΕ. ΜΕΤΡΗΜΕΝΟ 2026-09-12.**
 *
 * Το σώμα μιας συναλλαγής **ξανατρέχει σε σύγκρουση** — στο αληθινό Firestore και στον
 * πλαστό. Η άγκυρα Τ3 το **έδειξε ζωντανά**: σε δύο ταυτόχρονες αποδοχές, η καταδικασμένη
 * πρώτη προσπάθεια **κάλεσε αυτή τη συνάρτηση** πριν ακυρωθεί.
 *
 * Σήμερα αυτό είναι **ακίνδυνο** ακριβώς επειδή εδώ μέσα υπάρχει **μόνο** `tx.set`, που
 * είναι αναβαλλόμενο: η ουρά της χαμένης προσπάθειας πεθαίνει μαζί της. Πρόσθεσε **μία**
 * πράξη με άμεσο αποτέλεσμα — ίχνος, email, ειδοποίηση, μετρητή, `await` σε δίκτυο — και
 * εκείνη θα φύγει **μία φορά ανά προσπάθεια**, χωρίς καμία πύλη να το δει. Είναι το
 * ελάττωμα που η κεφαλίδα του `mandate-acceptance.service.ts` απαγορεύει ονομαστικά.
 *
 * 🔑 **`merge: true`** — η ένταξη είναι **ιδεμποτική** (N.7.2 #3): δεύτερη κλήση για τον
 * ίδιο άνθρωπο δίνει **το ίδιο** αποτέλεσμα, χωρίς να σβήσει πεδία που έβαλε άλλος δρόμος
 * *(π.χ. `permissionSetIds` από την κονσόλα ρόλων)*.
 */
export function grantWorkspaceMembershipInTx(tx: Transaction, input: GrantMembershipInput): void {
  tx.set(memberRef(input.companyId, input.uid), membershipDocument(input), { merge: true });
}

/**
 * **Η γραφή, αυτοτελώς** — για καλούντες χωρίς συναλλαγή (η έγκριση αιτήματος).
 *
 * ⚠️ Ο `claims-handler` έχει **ήδη** δώσει τα claims όταν φτάνει εδώ, οπότε μια αποτυχία
 * **δεν** αναιρεί πρόσβαση που δόθηκε — γι' αυτό επιστρέφει `boolean` αντί να πετάξει,
 * διατηρώντας τη σημερινή μη-μπλοκάρουσα συμπεριφορά του.
 */
export async function grantWorkspaceMembership(input: GrantMembershipInput): Promise<boolean> {
  try {
    await memberRef(input.companyId, input.uid).set(membershipDocument(input), { merge: true });
    logger.info('Γράφτηκε ιδιότητα μέλους', { uid: input.uid, companyId: input.companyId });
    return true;
  } catch (error: unknown) {
    logger.error('Η ιδιότητα μέλους ΔΕΝ γράφτηκε', {
      uid: input.uid,
      companyId: input.companyId,
      error: getErrorMessage(error),
    });
    return false;
  }
}

/**
 * **Το ίχνος** — ποιος μπήκε σε ποιον χώρο και με ποιανού την πράξη (ADR-195).
 *
 * ⚠️ **Ποτέ μπλοκάρον, και ποτέ μέσα σε συναλλαγή**: η ιδιότητα μέλους **έχει ήδη**
 * γραφτεί· ένα ίχνος που αποτυγχάνει δεν επιτρέπεται να ακυρώσει ένταξη που έγινε.
 *
 * 🔑 **`ENTITY_TYPES.COMPANY` με πεδίο `members`**, ίδιο με ό,τι κατέγραφε ήδη ο
 * `claims-handler`: η οντότητα που **άλλαξε** είναι ο χώρος, όχι ο άνθρωπος. Ένας νέος
 * τύπος οντότητας για την ένταξη θα ήταν **λεξιλογική απόφαση** που δεν ανήκει εδώ.
 */
export async function recordMembershipGrantAudit(
  input: GrantMembershipInput & { readonly grantedByName: string | null },
): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: input.companyId,
    entityName: null,
    action: 'updated',
    changes: [{ field: 'members', oldValue: null, newValue: input.uid }],
    performedBy: input.grantedByUid,
    performedByName: input.grantedByName,
    companyId: input.companyId,
  }).catch((error: unknown) => {
    logger.warn('Το ίχνος ένταξης απέτυχε (μη μπλοκάρον)', { error: getErrorMessage(error) });
  });
}

// =============================================================================
// ΤΟ ΕΓΓΡΑΦΟ — μία γραφή του «τι είναι μέλος»
// =============================================================================

function memberRef(companyId: string, uid: string) {
  return getAdminFirestore()
    .collection(COLLECTIONS.COMPANIES)
    .doc(companyId)
    .collection(SUBCOLLECTIONS.WORKSPACE_MEMBERS)
    .doc(uid);
}

/**
 * ⚠️ **ΤΟ `uid` ΓΡΑΦΕΤΑΙ ΚΑΙ ΩΣ ΠΕΔΙΟ, ΟΧΙ ΜΟΝΟ ΩΣ ΚΛΕΙΔΙ** — και είναι απαίτηση
 * **λειτουργίας**: το `listMemberWorkspaces` κάνει **collection-group** ερώτημα με
 * `where('uid','==',…)`, και ένα collection-group δεν μπορεί να φιλτράρει στο **id** του
 * εγγράφου. Χωρίς αυτό το πεδίο, ο άνθρωπος θα ήταν μέλος **και δεν θα φαινόταν πουθενά**.
 *
 * ⚠️ **`status: 'active'`** ρητά: το `normalizeMembership` διαβάζει άγνωστη κατάσταση ως
 * `'suspended'` (fail-closed), οπότε παράλειψη εδώ θα έγραφε μέλος που ο κριτής **αρνείται**.
 */
function membershipDocument(input: GrantMembershipInput) {
  return {
    uid: input.uid,
    globalRole: input.globalRole,
    status: 'active',
    joinedAt: AdminFieldValue.serverTimestamp(),
    addedBy: input.grantedByUid,
    updatedAt: AdminFieldValue.serverTimestamp(),
  };
}
