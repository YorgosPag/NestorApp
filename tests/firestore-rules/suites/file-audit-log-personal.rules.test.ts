/**
 * Firestore Rules — συλλογή `file_audit_log_personal` (ADR-866 §2.6.11 · Φ0 βήμα 2β.4)
 *
 * Σχήμα κανόνα (firestore.rules):
 *   - get/list:       `resource.data.userId == request.auth.uid` — ούτε admin εταιρείας ούτε super admin
 *   - create:         κάτοχος = δράστης = αιτών · χρόνος διακομιστή · χωρίς `companyId` · **ΜΟΝΟ**
 *                     ζευγαρωμένη με την αλλαγή του αρχείου που περιγράφει (`personalActivityMatchesChange`)
 *   - update/delete:  ποτέ — αμετάβλητο
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΡΟΥΡΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ Ο ΠΙΝΑΚΑΣ PERSONAS **ΔΕΝ ΜΠΟΡΕΙ** (άγκυρα ADR-866 §7 Α35)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Δ1. Ο ΠΟΛΙΤΗΣ ΧΩΡΙΣ ΕΤΑΙΡΕΙΑ** γράφει τη δραστηριότητα του δικού του αρχείου — ζευγαρωμένα —
 *   και τη διαβάζει. Κανείς άλλος δεν τη διαβάζει.
 *   **Δ2. ΠΛΑΣΤΟΓΡΑΦΙΑ**: γραμμή που **δεν** περιγράφει την αλλαγή (λάθος πράξη · άλλο αρχείο · άλλος
 *   δράστης · χρόνος πελάτη · `companyId`) ⇒ άρνηση **ολόκληρης** της δέσμης.
 *   **Δ3. ΑΜΕΤΑΒΛΗΤΟ**: ούτε ο κάτοχος αλλάζει ή σβήνει γραμμή του.
 *   **Δ4. Rules are not filters**: αφιλτράριστη λίστα ⇒ άρνηση και για τον κάτοχο.
 *
 * @since 2026-09-18 (ADR-866 Φ0 βήμα 2β.4)
 */

import { initEmulator, teardownEmulator, resetData } from '../_harness/emulator';
import { getContext } from '../_harness/auth-contexts';
import { assertCell, type AssertTarget } from '../_harness/assertions';
import { seedPersonalFile } from '../_harness/seed-helpers';
import {
  PERSONAL_ACTIVITY,
  RESTORE_UPDATES,
  TRASH_UPDATES,
  commitPairedActivity,
  personalActivityRow,
  seedPersonalActivity,
} from '../_harness/personal-activity';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'file_audit_log_personal')!;

const OWNER_UID = PERSONA_CLAIMS.same_tenant_user.uid;
const LOG_ID = 'act-seeded-1';
const FILE_ID = 'file-personal-1';

/** Άνθρωπος **χωρίς** claim εταιρείας — ο ιδιώτης ιδιοκτήτης (ADR-864 Ε-1). */
const CITIZEN_UID = 'citizen-without-company';

describe('file_audit_log_personal.rules — η δραστηριότητα του προσωπικού αρχείου (ADR-866 §2.6.11)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initEmulator();
  });

  afterAll(async () => {
    await teardownEmulator(env);
  });

  afterEach(async () => {
    await resetData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        await seedPersonalFile(env, FILE_ID, OWNER_UID);
        await seedPersonalActivity(env, LOG_ID, OWNER_UID, FILE_ID);

        const target: AssertTarget = {
          collection: PERSONAL_ACTIVITY,
          docId: LOG_ID,
          data: { action: 'restore' },
          // 🔑 Έγκυρη γραμμή, αλλά ΜΕΜΟΝΩΜΕΝΗ: δεν περιγράφει καμία αλλαγή ⇒ ούτε ο κάτοχος.
          createData: personalActivityRow(OWNER_UID, FILE_ID, 'rename'),
          listFilter: { field: 'userId', op: '==', value: OWNER_UID },
        };

        await assertCell(getContext(env, cell.persona), cell, target);
      });
    });
  }

  const citizen = () => env.authenticatedContext(CITIZEN_UID, {}).firestore();

  describe('🔴 Δ1 — ο ΠΟΛΙΤΗΣ γράφει ζευγαρωμένα και διαβάζει τη δική του δραστηριότητα', () => {
    beforeEach(async () => {
      await seedPersonalFile(env, FILE_ID, CITIZEN_UID);
    });

    it('κάδος → επαναφορά → μετονομασία: τρεις δέσμες, τρεις γραμμές, όλες αναγνώσιμες από τον κάτοχο', async () => {
      const db = citizen();
      await assertSucceeds(commitPairedActivity(db, { uid: CITIZEN_UID, fileId: FILE_ID, action: 'delete', updates: TRASH_UPDATES }));
      await assertSucceeds(commitPairedActivity(db, { uid: CITIZEN_UID, fileId: FILE_ID, action: 'restore', updates: RESTORE_UPDATES }));
      await assertSucceeds(commitPairedActivity(db, {
        uid: CITIZEN_UID, fileId: FILE_ID, action: 'rename', updates: { displayName: 'Συμβόλαιο 2026' },
      }));

      const snap = await assertSucceeds(
        db.collection(PERSONAL_ACTIVITY).where('userId', '==', CITIZEN_UID).where('fileId', '==', FILE_ID).get(),
      );
      expect(snap.docs.map((d) => d.data().action).sort()).toEqual(['delete', 'rename', 'restore']);
    });

    it('🔴 ξένος πολίτης δεν διαβάζει τη δραστηριότητα — ούτε με φίλτρο που ονομάζει τον κάτοχο', async () => {
      await seedPersonalActivity(env, LOG_ID, CITIZEN_UID, FILE_ID);
      const stranger = env.authenticatedContext('another-citizen', {}).firestore();
      await assertFails(stranger.collection(PERSONAL_ACTIVITY).doc(LOG_ID).get());
      await assertFails(stranger.collection(PERSONAL_ACTIVITY).where('userId', '==', CITIZEN_UID).get());
    });

    it('🔴 ΟΥΤΕ ο admin της εταιρείας ΟΥΤΕ ο super admin', async () => {
      await seedPersonalActivity(env, LOG_ID, OWNER_UID, FILE_ID);
      await assertFails(getContext(env, 'same_tenant_admin').firestore().collection(PERSONAL_ACTIVITY).doc(LOG_ID).get());
      await assertFails(getContext(env, 'super_admin').firestore().collection(PERSONAL_ACTIVITY).doc(LOG_ID).get());
    });
  });

  describe('🔴 Δ2 — καμία πλαστή γραμμή: η δέσμη πέφτει ΟΛΟΚΛΗΡΗ', () => {
    beforeEach(async () => {
      await seedPersonalFile(env, FILE_ID, CITIZEN_UID);
    });

    const trash = { uid: CITIZEN_UID, fileId: FILE_ID, updates: TRASH_UPDATES } as const;

    it('λάθος πράξη: «μετονόμασα» ενώ πήγε στον κάδο', async () => {
      await assertFails(commitPairedActivity(citizen(), { ...trash, action: 'rename' }));
    });

    it('«διέγραψα» ενώ έγινε μόνο μετονομασία — η γραμμή δεν επιτρέπεται να υπερβάλλει', async () => {
      await assertFails(commitPairedActivity(citizen(), {
        uid: CITIZEN_UID, fileId: FILE_ID, action: 'delete', updates: { displayName: 'άλλο όνομα' },
      }));
    });

    it('«επανέφερα» αρχείο που ΔΕΝ ήταν στον κάδο', async () => {
      await assertFails(commitPairedActivity(citizen(), { ...trash, action: 'restore', updates: RESTORE_UPDATES }));
    });

    it('πράξη εκτός κλειστού συνόλου (`share`) — ακόμη και με πραγματική αλλαγή', async () => {
      await assertFails(commitPairedActivity(citizen(), { ...trash, action: 'share' }));
    });

    it('δράστης ΑΛΛΟΣ από τον αιτούντα', async () => {
      await assertFails(commitPairedActivity(citizen(), { ...trash, action: 'delete', row: { performedBy: 'someone-else' } }));
    });

    it('χρόνος ΠΕΛΑΤΗ αντί διακομιστή', async () => {
      await assertFails(commitPairedActivity(citizen(), { ...trash, action: 'delete', row: { timestamp: new Date() } }));
    });

    it('ψευδο-εταιρεία στη γραμμή (`companyId`)', async () => {
      await assertFails(commitPairedActivity(citizen(), { ...trash, action: 'delete', row: { companyId: 'comp_x' } }));
    });

    it('γραμμή για αρχείο ΑΛΛΟΥ ανθρώπου — ακόμη κι αν εκείνο αλλάζει στην ίδια δέσμη', async () => {
      await seedPersonalFile(env, 'file-of-other', 'another-citizen');
      await assertFails(commitPairedActivity(citizen(), { uid: CITIZEN_UID, fileId: 'file-of-other', action: 'delete', updates: TRASH_UPDATES }));
    });
  });

  describe('🔴 Δ3 — αμετάβλητο: ούτε ο κάτοχος αλλάζει ή σβήνει', () => {
    it('update → deny · delete → deny', async () => {
      await seedPersonalActivity(env, LOG_ID, CITIZEN_UID, FILE_ID);
      const ref = citizen().collection(PERSONAL_ACTIVITY).doc(LOG_ID);
      await assertFails(ref.update({ action: 'restore' }));
      await assertFails(ref.delete());
    });
  });

  describe('🔴 Δ4 — rules are not filters', () => {
    it('αφιλτράριστη λίστα → deny ΚΑΙ για τον κάτοχο', async () => {
      await seedPersonalActivity(env, LOG_ID, CITIZEN_UID, FILE_ID);
      await assertFails(citizen().collection(PERSONAL_ACTIVITY).get());
    });
  });
});
