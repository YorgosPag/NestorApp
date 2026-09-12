/**
 * Firestore Rules — συλλογή `workspace_invitations` (ADR-853 §7)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — **και οι δύο πλευρές** περνούν από
 * τον διακομιστή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΠΕΜΠΤΟ `deny_all` ΤΗΣ ΟΙΚΟΓΕΝΕΙΑΣ — ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ **ΔΙΠΛΟΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Στο `mandate_requests` κρύβαμε **το πρόσωπο**. Στο `first_contacts` προστατεύαμε τον
 * **ΕΝΑΝ γραφέα**. Στο `first_contact_invitations` το **μυστικό**. Στο
 * `workspace_access_requests` την **αυτο-έγκριση**.
 *
 * Εδώ ισχύουν **δύο** ταυτόχρονα:
 *
 * | Πεδίο / πράξη | Τι δίνει |
 * |---|---|
 * | `nonceHash` | το μισό του υπογεγραμμένου συνδέσμου — υλικό εξαργύρωσης **ΞΕΝΗΣ** πρόσκλησης |
 * | `inviteeEmail` | ποιον προσκαλεί ποιο γραφείο — εμπορική πληροφορία, όχι μόνο προσωπική |
 * | **ΓΡΑΦΗ** | **αυτο-πρόσκληση**: διαλέγεις μόνος σου **χώρο ΚΑΙ ρόλο** |
 *
 * 🔴 **Η ΓΡΑΦΗ ΕΙΝΑΙ ΧΕΙΡΟΤΕΡΗ ΑΠΟ ΤΗΝ ΑΝΑΓΝΩΣΗ, ΚΑΙ ΕΙΝΑΙ ΑΝΤΙ-ΔΙΑΙΣΘΗΤΙΚΟ.** Οι δύο
 * φρουροί του ρόλου — το ταβάνι `compareRoleLevels` (Ρ1) και ο αποκλεισμός του
 * `super_admin` (Ρ2) — ζουν **αποκλειστικά στον διακομιστή**, στην έκδοση. Πελάτης που
 * μπορεί να γράψει εδώ τους παρακάμπτει **και τους δύο**: φτιάχνει πρόσκληση προς τον
 * εαυτό του, σε οποιονδήποτε χώρο, με όποιον ρόλο θέλει — και μετά την εξαργυρώνει
 * **νόμιμα**, γιατί η εξαργύρωση εμπιστεύεται το έγγραφο.
 *
 * ⚠️ **Ο `denyAllMatrix` ΔΕΝ πιάνει τίποτα από αυτά μόνος του.** Αρνείται σε όλους, άρα
 * κάθε κελί περνά **ούτως ή άλλως** — ακόμη κι αν ο κανόνας χαλαρώσει, αρκεί κανένα
 * σπαρμένο έγγραφο να μην **αφορά** τον δοκιμαζόμενο. Γι' αυτό το seed παρακάτω στοχεύει
 * **ΑΚΡΙΒΩΣ** τον `SAME_TENANT_COMPANY_ID`, δηλαδή την εταιρεία που οι σουίτες
 * **μπορούν να υποδυθούν**.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ — ο άξονας του email ΔΕΝ είναι εκτελέσιμος εδώ.** Το
 * `PersonaClaims` δηλώνει **τρία** πεδία (`uid`, `companyId`, `globalRole`) και **κανένα
 * email**, οπότε μια άγκυρα για τη μετάλλαξη
 * *«allow read: if resource.data.inviteeEmail == request.auth.token.email»* θα ήταν
 * **πράσινη επειδή δεν μπορεί να τρέξει**. Η δέσμευση στον παραλήπτη αποδεικνύεται εκεί
 * όπου **εκτελείται**: άγκυρες `Τ1` / `Τ1β` στο
 * `src/server/auth/__tests__/workspace-invitation.test.ts`.
 *
 * @since 2026-09-12 (ADR-853 Φ2)
 */

import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'workspace_invitations',
)!;

/** Το email του σπαρμένου παραλήπτη — δες το δηλωμένο όριο στην κεφαλίδα. */
const SEED_INVITEE_EMAIL = 'nikos.seed@example.gr';

/**
 * Μια **ζωντανή** πρόσκληση προς τον `SAME_TENANT_COMPANY_ID`.
 *
 * 🔑 **Ο χώρος ΔΕΝ είναι αυθαίρετος** — είναι η εταιρεία που ο `same_tenant_admin`
 * **υποδύεται**. Χωρίς αυτή τη σύμπτωση, το πιο λογικό χαλάρωμα που θα σκεφτόταν ο
 * επόμενος
 *
 *     allow read: if resource.data.companyId == getUserCompanyId();
 *
 * *(«μα ο διαχειριστής πρέπει να δει τις προσκλήσεις του γραφείου του!»)* **ΔΕΝ θα
 * κοκκίνιζε ποτέ**.
 *
 * ⚠️ Σπέρνεται σε **κάθε** άγκυρα και όχι μία φορά: ο `useDenyAllEmulator` καθαρίζει τα
 * δεδομένα μετά από **κάθε** test (`afterEach → resetData`).
 */
async function seedInvitation(env: RulesTestEnvironment, invitationId: string): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    await ctx.firestore().collection('workspace_invitations').doc(invitationId).set({
      id: invitationId,
      companyId: SAME_TENANT_COMPANY_ID,
      inviteeEmail: SEED_INVITEE_EMAIL,
      role: 'internal_user',
      invitedByUid: PERSONA_CLAIMS.same_tenant_admin.uid,
      nonceHash: 'c'.repeat(64),
      state: 'pending',
      createdAt: '2026-09-12T10:00:00.000Z',
      expiresAt: '2026-09-19T10:00:00.000Z',
      openedAt: null,
      resolvedAt: null,
      resolvedByUid: null,
    });
  });
}

describe('workspace_invitations.rules — το έγγραφο κρατά ΜΥΣΤΙΚΟ, και η γραφή είναι αυτο-πρόσκληση', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  // ==========================================================================
  // ΑΓΚΥΡΑ 1 — Ο ΔΙΑΧΕΙΡΙΣΤΗΣ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΧΩΡΟΥ. «Μα εγώ τις έστειλα.»
  // ==========================================================================

  describe('🔴 ούτε ο ΔΙΑΧΕΙΡΙΣΤΗΣ που έστειλε τις προσκλήσεις του ΔΙΚΟΥ του γραφείου', () => {
    const INVITATION_ID = 'winv_anchor_0001';

    it('δεν διαβάζει το έγγραφο — και μαζί του θα έπαιρνε το `nonceHash` κάθε προσκεκλημένου', async () => {
      await seedInvitation(env(), INVITATION_ID);

      // ⚠️ Το seed δείχνει ΑΚΡΙΒΩΣ στην εταιρεία αυτού του persona. Αν κάποιος γράψει
      //    `allow read: if resource.data.companyId == getUserCompanyId()`, ΕΔΩ κοκκινίζει.
      const admin = getContext(env(), 'same_tenant_admin');

      await assertFails(
        admin.firestore().collection('workspace_invitations').doc(INVITATION_ID).get(),
      );
    });

    it('🔑 ούτε με ερώτημα «οι προσκλήσεις του γραφείου μου» — ΤΟ ΠΙΟ ΛΟΓΙΚΟ ΧΑΛΑΡΩΜΑ', async () => {
      await seedInvitation(env(), INVITATION_ID);

      const admin = getContext(env(), 'same_tenant_admin');

      await assertFails(
        admin
          .firestore()
          .collection('workspace_invitations')
          .where('companyId', '==', SAME_TENANT_COMPANY_ID)
          .get(),
      );
    });

    it('🔴 ούτε ερώτημα ΜΟΝΟ στις εκκρεμείς — «θα δω λιγότερα» δεν είναι μετριασμός', async () => {
      await seedInvitation(env(), INVITATION_ID);

      // 🔑 Φιλτράροντας σε `state == 'pending'` δεν βλέπει «λιγότερα»: βλέπει **ακριβώς**
      //    τις προσκλήσεις που μπορούν ακόμη να εξαργυρωθούν — τις **μόνες** που αξίζει
      //    να κλέψει κανείς.
      const admin = getContext(env(), 'same_tenant_admin');

      await assertFails(
        admin
          .firestore()
          .collection('workspace_invitations')
          .where('state', '==', 'pending')
          .get(),
      );
    });
  });

  // ==========================================================================
  // ΑΓΚΥΡΑ 2 — Η ΓΡΑΦΗ. Η ΑΥΤΟ-ΠΡΟΣΚΛΗΣΗ ΕΙΝΑΙ Η ΧΕΙΡΟΤΕΡΗ ΠΡΑΞΗ ΕΔΩ.
  // ==========================================================================

  describe('🔴 και η ΓΡΑΦΗ είναι χειρότερη: παρακάμπτει ΚΑΙ ΤΟΥΣ ΔΥΟ φρουρούς ρόλου', () => {
    it('🔴 ο ξένος δεν ΓΕΝΝΑ πρόσκληση — αλλιώς αυτο-προσκαλείται σε ΟΠΟΙΟΝΔΗΠΟΤΕ χώρο', async () => {
      // ⚠️ **Η πιο ύπουλη πράξη του αρχείου, και δεν χρειάζεται να διαβάσει τίποτα.**
      //    Φτιάχνει πρόσκληση με **δικό του** `nonceHash`, προς **ξένο** χώρο, με ρόλο
      //    `company_admin` — και μετά την εξαργυρώνει **νόμιμα**. Τα Ρ1/Ρ2 ζουν μόνο
      //    στον διακομιστή, στην έκδοση· εδώ δεν υπάρχει κανείς να ρωτήσει.
      const stranger = getContext(env(), 'external_user');

      await assertFails(
        stranger.firestore().collection('workspace_invitations').doc('winv_anchor_0002').set({
          id: 'winv_anchor_0002',
          companyId: SAME_TENANT_COMPANY_ID,
          inviteeEmail: 'eisvoleas@example.gr',
          role: 'company_admin',
          invitedByUid: PERSONA_CLAIMS.external_user.uid,
          nonceHash: 'd'.repeat(64),
          state: 'pending',
          createdAt: '2026-09-12T10:00:00.000Z',
          expiresAt: '2026-09-19T10:00:00.000Z',
          openedAt: null,
          resolvedAt: null,
          resolvedByUid: null,
        }),
      );
    });

    it('🔴 ούτε γράφει `accepted` σε υπάρχουσα — η αυτο-ένταξη χωρίς να πατηθεί σύνδεσμος', async () => {
      await seedInvitation(env(), 'winv_anchor_0003');

      const stranger = getContext(env(), 'external_user');

      await assertFails(
        stranger
          .firestore()
          .collection('workspace_invitations')
          .doc('winv_anchor_0003')
          .update({ state: 'accepted', resolvedByUid: PERSONA_CLAIMS.external_user.uid }),
      );
    });

    it('🔑 ούτε ΔΙΑΓΡΑΦΕΙ — η ανάκληση είναι ονομασμένη πράξη του διακομιστή, όχι σβήσιμο', async () => {
      await seedInvitation(env(), 'winv_anchor_0004');

      // ⚠️ Διαγραφή από πελάτη θα έσβηνε την πρόσκληση **ξένου** ανθρώπου πριν προλάβει
      //    να την πατήσει — και θα άφηνε τον χώρο να νομίζει ότι εκείνος αρνήθηκε.
      const stranger = getContext(env(), 'external_user');

      await assertFails(
        stranger.firestore().collection('workspace_invitations').doc('winv_anchor_0004').delete(),
      );
    });
  });
});
