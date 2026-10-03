/**
 * Firestore Rules — συλλογή `conveyance_contributions` (ADR-901 Φ4.4 — Transmittal)
 *
 * Σχήμα κανόνα: `read: if false` · `write: if false` — οικοδεσπότης **και** επαγγελματίες περνούν από τον διακομιστή.
 *
 * 🔴 Δύο «λογικές» μεταλλάξεις που αυτή η σουίτα πρέπει να κοκκινίζει:
 *
 *     allow read: if resource.data.companyId == getUserCompanyId();   // «ο οικοδεσπότης βλέπει τα δικά του»
 *     allow read, update: if resource.data.authorUid == request.auth.uid; // «ο συντάκτης βλέπει/αποσύρει τα δικά του»
 *
 * Η πρώτη δίνει στον οικοδεσπότη (πλευρά πωλητή) την έκθεση του δικηγόρου του **αγοραστή** (Α23). Η δεύτερη
 * αφήνει απόσυρση χωρίς ίχνος και χωρίς αποδέσμευση της σταλμένης έκδοσης (Α26). Γι' αυτό το σπαρμένο έγγραφο
 * ανήκει στον **ίδιο** μισθωτή **και** έχει συντάκτη μια persona της σουίτας.
 *
 * @since 2026-10-03 (ADR-901 Φ4.4)
 */

import { assertFails } from '@firebase/rules-unit-testing';

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS, SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { getContext, withSeedContext } from '../_harness/auth-contexts';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'conveyance_contributions',
)!;

const CONTRIBUTION_ID = 'ctb_anchor_0001';
const AUTHOR = PERSONA_CLAIMS.external_user.uid;

describe('conveyance_contributions.rules — το transmittal ανήκει στον διακομιστή', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('🔴 ούτε ο οικοδεσπότης ούτε ο ίδιος ο συντάκτης', () => {
    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection('conveyance_contributions').doc(CONTRIBUTION_ID).set({
          id: CONTRIBUTION_ID,
          companyId: SAME_TENANT_COMPANY_ID,
          caseId: 'cvc_anchor_0001',
          projectId: null,
          authorUid: AUTHOR,
          authorRole: 'buyer_lawyer',
          authorEngagementId: 'eng_anchor_0001',
          checklistItemId: 'legal_due_diligence_report',
          entryPointId: 'case-legal-due-diligence',
          file: { fileId: 'file_anchor_0001', fingerprint: 'file_anchor_0001:0:', displayName: 'report.pdf', contentType: 'application/pdf' },
          supersedes: null,
          issuedAt: '2026-10-03T08:00:00.000Z',
          withdrawnAt: null,
          withdrawnBy: null,
        });
      });
    });

    it('ο διαχειριστής του ΙΔΙΟΥ μισθωτή διαβάζει την έκθεση του δικηγόρου του αγοραστή ⇒ άρνηση (Α23)', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(admin.firestore().collection('conveyance_contributions').doc(CONTRIBUTION_ID).get());
    });

    it('ερώτημα φιλτραρισμένο στον δικό του μισθωτή ⇒ άρνηση', async () => {
      const admin = getContext(env(), 'same_tenant_admin');
      await assertFails(
        admin.firestore().collection('conveyance_contributions').where('companyId', '==', SAME_TENANT_COMPANY_ID).get(),
      );
    });

    it('ο συντάκτης διαβάζει το δικό του transmittal ⇒ άρνηση (μόνο μέσω API)', async () => {
      const author = getContext(env(), 'external_user');
      await assertFails(author.firestore().collection('conveyance_contributions').doc(CONTRIBUTION_ID).get());
    });

    it('ο συντάκτης αποσύρει από τον client (χωρίς ίχνος/αποδέσμευση) ⇒ άρνηση (Α26)', async () => {
      const author = getContext(env(), 'external_user');
      await assertFails(
        author.firestore().collection('conveyance_contributions').doc(CONTRIBUTION_ID)
          .update({ withdrawnAt: '2026-10-03T09:00:00.000Z', withdrawnBy: AUTHOR }),
      );
    });
  });
});
