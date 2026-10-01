#!/usr/bin/env tsx
/**
 * **Ο ΤΟΠΟΣ ΤΩΝ ΚΑΤΑΣΤΗΜΑΤΩΝ «ΜΟΝΟ ΠΕΡΙΟΧΗ» ΦΕΥΓΕΙ ΑΠΟ ΤΟ ΔΗΜΟΣΙΟ ΕΓΓΡΑΦΟ** — ADR-896 §6 (contract).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Μετρημένο 2026-10-01: για κατάστημα «μόνο περιοχή» (`street: null`) το `agency_profiles.locations[]`
 * (`read: if true`) κρατούσε `place.landId` — που οδηγεί στο `public_lands.displayAddress` — και ακριβές `position`,
 * ενώ η κάρτα υποσχόταν «η ακριβής διεύθυνση δεν δημοσιεύεται». Ο νέος κώδικας γράφει τον τόπο στο **ιδιωτικό**
 * `showcase_card_channels.premises` και ο αναγνώστης **ήδη αγνοεί** τα παλιά πεδία· αυτά όμως **μένουν** στη βάση,
 * διαθέσιμα σε όποιον ρωτήσει το SDK, ώσπου να τα σβήσει κάποιος. Αυτό το αρχείο.
 *
 * 🔑 **Σειρά (expand/contract)**: πρώτα ανεβαίνει ο κώδικας, **μετά** τρέχει αυτό. Ανάποδα, ο παλιός editor θα
 * έβλεπε κατάστημα χωρίς τόπο. Κανόνες: **καμία** αλλαγή (το ιδιωτικό έγγραφο είναι ήδη `deny_all`).
 *
 * 🔑 **Καμία γραφή εδώ.** Η πράξη είναι ο `moveAreaOnlyPremises` του **ενός** γραφέα της κάρτας· η κρίση
 * «τι απέμεινε» είναι ο `areaOnlyResidue` — ο ίδιος που χρησιμοποιεί ο γραφέας μέσα στη συναλλαγή.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ — ξηρό εξ ορισμού· το ξηρό τρέξιμο ΕΙΝΑΙ η αναφορά απόκλισης (exit 1 αν ≠ 0)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   npm run migrate:showcase-area-only-premises
 *   npm run migrate:showcase-area-only-premises -- --apply
 *
 * @see docs/centralized-systems/reference/adrs/ADR-896-professionals-directory-map.md §6
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { areaOnlyResidue } from '@/lib/agency/showcase-area-only-residue';
import { moveAreaOnlyPremises, type AreaOnlyPremisesMove } from '@/services/mandate/showcase-card-custody';

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά).
applyEnvLocal();

const APPLY = process.argv.slice(2).includes('--apply');

interface ProfileWithResidue {
  readonly companyId: string;
  readonly locationIds: readonly string[];
}

/** Κάθε δημόσιο προφίλ που **ακόμη** δημοσιεύει τόπο καταστήματος «μόνο περιοχή» — ό,τι βλέπει σήμερα ο κόσμος. */
async function profilesWithResidue(): Promise<readonly ProfileWithResidue[]> {
  const snapshot = await getAdminFirestore().collection(COLLECTIONS.AGENCY_PROFILES).get();
  return snapshot.docs.flatMap((doc) => {
    const residue = areaOnlyResidue(doc.data().locations);
    return residue.length === 0 ? [] : [{ companyId: doc.id, locationIds: residue.map(({ locationId }) => locationId) }];
  });
}

async function main(): Promise<void> {
  const pending = await profilesWithResidue();
  console.log(`🔎 Προφίλ με τόπο καταστήματος «μόνο περιοχή» ακόμη δημόσιο: ${pending.length}`);
  for (const profile of pending) console.log(`   • ${profile.companyId} — ${profile.locationIds.join(', ')}`);

  if (!APPLY) {
    console.log(pending.length === 0 ? '✅ Απόκλιση 0 — καμία διαρροή.' : '⚠️  Ξηρό τρέξιμο. Με `-- --apply` μετακινούνται.');
    process.exit(pending.length === 0 ? 0 : 1);
  }

  const tally: Record<AreaOnlyPremisesMove, number> = { moved: 0, clean: 0, absent: 0, unavailable: 0 };
  for (const profile of pending) {
    tally[await moveAreaOnlyPremises(getAdminFirestore(), profile.companyId)] += 1;
  }
  console.log(
    `✍️  Μετακινήθηκαν: ${tally.moved} · ήδη καθαρά: ${tally.clean} · χάθηκαν στο μεταξύ: ${tally.absent}` +
      ` · χωρίς ευρετήριο περιοχών (ξαναδοκίμασε): ${tally.unavailable}`,
  );
  const left = await profilesWithResidue();
  console.log(left.length === 0 ? '✅ Απόκλιση 0.' : `❌ Απομένουν ${left.length}.`);
  process.exit(left.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('❌ Η μετανάστευση απέτυχε:', error);
  process.exit(1);
});
