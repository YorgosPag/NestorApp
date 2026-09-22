/**
 * Firestore Rules — συλλογή `network_inbox` + η υποσυλλογή `network_inbox_unread` (ADR-867 §4.5, Β10)
 *
 * Σχήμα κανόνα (`firestore.rules`):
 *   - `network_inbox/{uid}`:                          κλειστό σε κάθε πελάτη — το έγγραφο δεν έχει δεδομένα
 *   - `network_inbox/{uid}/network_inbox_unread/*`:   `get, list` **μόνο** ο ίδιος (`isOwner(uid)`) · γραφή κανείς
 *
 * Ο πίνακας των 35 μιλά για το **γονικό** έγγραφο (`networkServerOnlyMatrix` — ίδιο πρότυπο με
 * `network_away`). Η υποσυλλογή, όπου ζει όλη η αξία, φρουρείται εδώ με δικές της άγκυρες:
 *
 *   **Κ1. Ο ΙΔΙΟΣ ΜΕΤΡΑ ΤΑ ΔΙΚΑ ΤΟΥ.** Χωρίς `list` από τον ιδιοκτήτη, το badge δεν έχει πηγή — ένας
 *   κανόνας `if false` θα ήταν «ασφαλής» και θα έδειχνε **0** για πάντα.
 *   **Κ2. 🔴 ΚΑΝΕΝΑΣ ΑΛΛΟΣ.** Η λίστα ενός ανθρώπου λέει **ποια νήματα δεν διάβασε ακόμη** — η ένδειξη
 *   ανάγνωσης που το ADR-867 §8 #4 αρνείται. Ούτε ο διαχειριστής του χώρου, ούτε ο `super_admin`.
 *   **Κ3. ΚΑΜΙΑ ΓΡΑΦΗ, ΟΥΤΕ ΑΠΟ ΤΟΝ ΙΔΙΟ.** Αλλιώς «σβήνω το badge» χωρίς να διαβάσω — η γραμμή είναι
 *   **προβολή** της αλήθειας, και τη γράφει **μόνο** ο `thread-writer.ts` (CHECK 3.89 Κ3).
 *
 * @since 2026-09-22 (ADR-867 Β10)
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

import { getContext, withSeedContext } from '../_harness/auth-contexts';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';
import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { PERSONA_CLAIMS } from '../_registry/personas';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'network_inbox')!;

const NETWORK_INBOX = 'network_inbox';
const NETWORK_INBOX_UNREAD = 'network_inbox_unread';

/** Ο ιδιοκτήτης του κουτιού — ιδιώτης (`external_user`), η συνηθισμένη περίπτωση του `(me)`. */
const OWNER_UID = PERSONA_CLAIMS.external_user.uid;
const THREAD_ID = 'nthr-inbox-seed-1';

describe('network_inbox.rules — το κουτί αδιάβαστων ανήκει ΜΟΝΟ στον άνθρωπο (ADR-867 §4.5)', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }

  describe('network_inbox_unread — γραμμή ανά αδιάβαστο νήμα', () => {
    const rows = (persona: Parameters<typeof getContext>[1], uid: string) =>
      getContext(env(), persona).firestore().collection(NETWORK_INBOX).doc(uid).collection(NETWORK_INBOX_UNREAD);

    beforeEach(async () => {
      await withSeedContext(env(), async (ctx) => {
        await ctx.firestore().collection(NETWORK_INBOX).doc(OWNER_UID).collection(NETWORK_INBOX_UNREAD)
          .doc(THREAD_ID).set({ liveMessageAt: '2026-09-22T10:00:00.000Z' });
      });
    });

    it('Κ1 — ο ίδιος απαριθμεί ΚΑΙ διαβάζει τις δικές του γραμμές (αλλιώς το badge δεν έχει πηγή)', async () => {
      const listed = await assertSucceeds(rows('external_user', OWNER_UID).limit(100).get());
      expect(listed.size).toBe(1);
      await assertSucceeds(rows('external_user', OWNER_UID).doc(THREAD_ID).get());
    });

    it('🔴 Κ2 — κανένας άλλος: ούτε συνάδελφος, ούτε διαχειριστής, ούτε ξένος χώρος, ούτε super_admin', async () => {
      for (const persona of ['same_tenant_user', 'same_tenant_admin', 'cross_tenant_admin', 'super_admin'] as const) {
        await assertFails(rows(persona, OWNER_UID).get());
        await assertFails(rows(persona, OWNER_UID).doc(THREAD_ID).get());
      }
    });

    it('🔴 Κ2 — ο ανώνυμος: άρνηση', async () => {
      await assertFails(rows('anonymous', OWNER_UID).get());
    });

    it('🔴 Κ3 — καμία γραφή, ούτε ο ίδιος στο δικό του κουτί', async () => {
      await assertFails(rows('external_user', OWNER_UID).doc(THREAD_ID).delete());
      await assertFails(rows('external_user', OWNER_UID).doc('nthr-forged').set({ liveMessageAt: '2026-09-22T11:00:00.000Z' }));
      await assertFails(rows('external_user', OWNER_UID).doc(THREAD_ID).update({ liveMessageAt: '2026-09-22T12:00:00.000Z' }));
    });
  });
});
