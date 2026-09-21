#!/usr/bin/env tsx
/**
 * **ΤΑ ΙΔΙΩΤΙΚΑ ΠΕΔΙΑ ΤΗΣ ΘΕΣΗΣ ΦΕΥΓΟΥΝ ΑΠΟ ΤΗ ΔΗΜΟΣΙΑ ΓΡΑΜΜΗ** — ADR-867 Β9(β) Ε9 (contract).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Μετρημένο 2026-09-21: ο ιδιοκτήτης διάβαζε με κανόνες το `network_audience/{uid}` του μεσίτη και έβλεπε
 * `muted: true`, `following: true` — και το `lastReadAt`, δηλαδή ένδειξη ανάγνωσης που το §8 #4 αρνείται.
 * Ο νέος κώδικας γράφει και διαβάζει το **ιδιωτικό** έγγραφο (`network_audience_private/{uid}`)· τα παλιά
 * αντίγραφα όμως **μένουν** στη δημόσια γραμμή — ορατά — ώσπου να τα σβήσει κάποιος. Αυτό το αρχείο.
 *
 * 🔑 **Σειρά (expand/contract)**: πρώτα ανεβαίνει ο κώδικας (διαβάζει ιδιωτικό, με εφεδρεία στη δημόσια
 * γραμμή ανά πεδίο), **μετά** τρέχει αυτό. Ανάποδα, ο παλιός κώδικας θα έχανε σίγαση και ώρα ανάγνωσης.
 * ⚠️ Πρώτα `firebase deploy --only firestore:rules` (ο κανόνας του ιδιωτικού εγγράφου) — αλλιώς η οθόνη
 * παίρνει άρνηση στη δική της πλευρά (commit ≠ deploy, CHECK 3.86).
 *
 * 🔑 **Καμία γραφή εδώ.** Η μετακίνηση είναι ο `moveLegacyPrivateSeat` του `thread-writer.ts` (CHECK 3.89 Κ3)·
 * η κρίση «τι απέμεινε» είναι ο `legacyPrivateResidue` — ο ίδιος που χρησιμοποιεί ο γραφέας.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ — ξηρό εξ ορισμού· το ξηρό τρέξιμο ΕΙΝΑΙ η αναφορά απόκλισης (exit 1 αν ≠ 0)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   npm run migrate:network-audience-private
 *   npm run migrate:network-audience-private -- --apply
 *
 * @see docs/centralized-systems/reference/adrs/ADR-867-network-messaging-core.md Β9(β) Ε9
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { legacyPrivateResidue } from '@/services/network-messaging/audience-seats';
import { networkAudienceGroup } from '@/services/network-messaging/network-thread-ref';
import { moveLegacyPrivateSeat, type LegacyPrivateMove } from '@/services/network-messaging/thread-writer';

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά).
applyEnvLocal();

const APPLY = process.argv.slice(2).includes('--apply');

interface SeatWithResidue {
  readonly threadId: string;
  readonly uid: string;
  readonly fields: readonly string[];
}

/** Όλες οι δημόσιες γραμμές που κουβαλούν ακόμη ιδιωτικό όνομα — **ό,τι βλέπει σήμερα η άλλη πλευρά**. */
async function seatsWithResidue(): Promise<readonly SeatWithResidue[]> {
  const snapshot = await networkAudienceGroup(getAdminFirestore()).get();
  return snapshot.docs.flatMap((doc) => {
    // Χωρίς ιδιωτικό έγγραφο εδώ: το «πρέπει να φύγει;» δεν εξαρτάται από αυτό — μόνο το «τι μεταφέρεται».
    const residue = legacyPrivateResidue(doc.data(), undefined);
    const threadId = doc.ref.parent.parent?.id;
    return residue === null || threadId === undefined ? [] : [{ threadId, uid: doc.id, fields: residue.strip }];
  });
}

async function main(): Promise<void> {
  const pending = await seatsWithResidue();
  console.log(`🔎 Δημόσιες γραμμές με ιδιωτικά πεδία (ορατά στην άλλη πλευρά): ${pending.length}`);
  for (const seat of pending) console.log(`   • ${seat.threadId}/${seat.uid} — ${seat.fields.join(', ')}`);

  if (!APPLY) {
    console.log(pending.length === 0 ? '✅ Απόκλιση 0 — καμία διαρροή.' : '⚠️  Ξηρό τρέξιμο. Με `-- --apply` μετακινούνται.');
    process.exit(pending.length === 0 ? 0 : 1);
  }

  const tally: Record<LegacyPrivateMove, number> = { moved: 0, clean: 0, absent: 0 };
  for (const seat of pending) {
    tally[await moveLegacyPrivateSeat(getAdminFirestore(), seat.threadId, seat.uid)] += 1;
  }
  console.log(`✍️  Μετακινήθηκαν: ${tally.moved} · ήδη καθαρές: ${tally.clean} · χάθηκαν στο μεταξύ: ${tally.absent}`);
  const left = await seatsWithResidue();
  console.log(left.length === 0 ? '✅ Απόκλιση 0.' : `❌ Απομένουν ${left.length}.`);
  process.exit(left.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('❌ Η μετανάστευση απέτυχε:', error);
  process.exit(1);
});
