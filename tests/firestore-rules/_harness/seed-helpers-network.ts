/**
 * Seeders του **ΔΙΚΤΥΟΥ ΣΥΝΕΡΓΑΤΩΝ** (ADR-867 Β4) — νήμα, μήνυμα, γραμμή ακροατηρίου.
 *
 * 🔑 **Χωριστό αρχείο, όχι επέκταση του `seed-helpers.ts`**: εκείνο έχει ήδη περάσει το
 * ταβάνι του N.7.1 — **split, όχι trim** (ίδια κίνηση με το `seed-helpers-mandate.ts`).
 *
 * 🔴 **ΤΟ SEED ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΔΕΙΓΜΑ**: γράφει **ακριβώς** το σχήμα που γράφει ο
 * `thread-writer.ts` — και **τίποτα άλλο**. Ένα seed με πεδία που η παραγωγή δεν γράφει
 * (ή χωρίς το `until` που κρίνει ο κανόνας) θα έβαφε πράσινο κάτι που δεν ελέγχθηκε.
 *
 * ⚠️ **Τα ονόματα των υποσυλλογών είναι `network_messages` / `network_audience`** — ποτέ
 * `messages` / `audience`. Δες `src/config/firestore-collections.ts`: υπάρχει ΗΔΗ top-level
 * `messages` (ADR-029), και ένα collection group query σαρώνει **κατά όνομα**.
 *
 * @module tests/firestore-rules/_harness/seed-helpers-network
 * @see docs/centralized-systems/reference/adrs/ADR-867-network-messaging-core.md §4.1 · §4.2
 */

import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { withSeedContext } from './auth-contexts';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';

export const NETWORK_THREADS = 'network_threads';
export const NETWORK_THREAD_MESSAGES = 'network_messages';
export const NETWORK_THREAD_AUDIENCE = 'network_audience';

/** Οι δύο πλευρές μιας γραμμής ακροατηρίου, όσο χρειάζεται το seed. */
export interface SeedAudienceEntry {
  readonly uid: string;
  readonly side: 'host' | 'counterpart' | 'person';
  readonly role: 'responsible' | 'collaborator' | 'counterpart' | 'person';
  /** `null` = **διαβάζει τώρα**. Ο κανόνας κρίνει **αυτό** το πεδίο, τίποτα άλλο. */
  readonly until: string | null;
}

/**
 * Ένα **νήμα πράξης** με το ακροατήριό του και ένα μήνυμα μέσα.
 *
 * 🔑 **Το μήνυμα ΔΕΝ είναι διακοσμητικό**: χωρίς αυτό, η άγκυρα «ο τρίτος δεν διαβάζει τα
 * μηνύματα» θα ήταν πράσινη επειδή **δεν υπάρχουν μηνύματα** — το ακριβές σχήμα «0 =
 * κανείς δεν κοίταξε», μέσα στο εργαλείο που υπάρχει για να το πιάνει.
 */
export async function seedNetworkActThread(
  env: RulesTestEnvironment,
  threadId: string,
  counterpartUid: string,
  audience: readonly SeedAudienceEntry[],
): Promise<void> {
  await withSeedContext(env, async (ctx) => {
    const db = ctx.firestore();
    const thread = db.collection(NETWORK_THREADS).doc(threadId);

    await thread.set({
      id: threadId,
      topic: {
        kind: 'act',
        actKind: 'mandate',
        actSeed: `ownp-seed-1:${SAME_TENANT_COMPANY_ID}`,
        hostCompanyId: SAME_TENANT_COMPANY_ID,
        counterpartUid,
      },
      state: 'open',
      createdAt: '2026-09-17T09:00:00.000Z',
      lastMessageAt: '2026-09-17T09:05:00.000Z',
      updatedAt: '2026-09-17T09:05:00.000Z',
    });

    await thread.collection(NETWORK_THREAD_MESSAGES).doc('nmsg-seed-1').set({
      id: 'nmsg-seed-1',
      senderUid: counterpartUid,
      text: 'Καλησπέρα, υπάρχει ενδιαφέρον για το διαμέρισμα;',
      createdAt: '2026-09-17T09:05:00.000Z',
      editedAt: null,
      retractedAt: null,
    });

    for (const entry of audience) {
      await thread.collection(NETWORK_THREAD_AUDIENCE).doc(entry.uid).set({
        uid: entry.uid,
        side: entry.side,
        role: entry.role,
        reason: entry.side === 'counterpart' ? 'counterpart' : 'creator',
        addedBy: 'persona-same-user',
        since: '2026-09-17T09:00:00.000Z',
        until: entry.until,
        lastReadAt: null,
        muted: false,
      });
    }
  });
}
