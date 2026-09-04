/**
 * **Η ΑΝΑΦΟΡΑ ΚΑΙ Η ΕΠΑΛΗΘΕΥΣΗ ΤΟΥ BACKFILL** — ADR-843 §10.17.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — **EXTRACT**, ΟΧΙ ΨΑΛΙΔΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Η τομή δεν έγινε στο μέγεθος αλλά στην **ερώτηση**: ο αδελφός απαντά *«τι πρέπει να
 * γραφτεί;»*· εδώ απαντιέται *«τι έγινε, και **φαίνεται**;»*. Η δεύτερη είναι η μόνη
 * που έχει σημασία για τον άνθρωπο — και είναι εκείνη που τα backfill scripts συνήθως
 * **δεν** κάνουν.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 Η ΕΠΑΛΗΘΕΥΣΗ ΡΩΤΑ «ΦΑΙΝΕΤΑΙ;», ΟΧΙ «ΕΓΡΑΨΑ;»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ένα `get()` του εγγράφου μετά τη γραφή αποδεικνύει ότι **το πεδίο υπάρχει**. Δεν
 * αποδεικνύει **τίποτα** από αυτά που μας νοιάζουν:
 *
 * - ότι το ερώτημα του εισερχομένου **το επιστρέφει** *(λάθος μονοπάτι πεδίου, λάθος
 *   σχήμα, ή ένα `offerer` γραμμένο ως string αντί για αντικείμενο θα περνούσαν)*·
 * - ότι η **σωστή** πλευρά το βλέπει *(προσωπικό ⇄ εταιρικό σκέλος)*.
 *
 * ⇒ Εδώ ξανατρέχει η **ίδια** ερώτηση που κάνει η οθόνη — {@link contactsAddressedTo},
 * ο κοινός πυρήνας του `collectAddressedContacts`. Είναι το μάθημα του Α18.7 του
 * ADR-841, εφαρμοσμένο σε γραφή αντί σε ανάγνωση: **η απόδειξη ζει στην ίδια συλλογή
 * που βλέπει ο άνθρωπος, ποτέ σε fixture**.
 *
 * ⚠️ **Και ΔΕΝ καλείται το `readOffererInbox`**, που θα ήταν η προφανής κίνηση:
 * σφραγίζει `seenAt` (write-once), δηλαδή ένα επαληθευτικό τρέξιμο θα **κατέστρεφε**
 * το *«πότε το είδε»* — ακριβώς το δεδομένο που η ζωντανή επαλήθευση με δεύτερο
 * λογαριασμό υπάρχει για να ελέγξει.
 *
 * @module scripts/migrations/backfill-first-contact-offerer.report
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { ListingCustody } from '@/lib/owner-property/listing-custody';
import { contactsAddressedTo } from '@/services/contact/first-contact-projection';

// =============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ — πέντε ιστορίες, ποτέ «ναι/όχι»
// =============================================================================

/**
 * **Τι έγινε με μία πράξη.**
 *
 * 🔑 **Μόνο το `unavailable` είναι αποτυχία.** Τα άλλα τέσσερα είναι **κανονικά**
 * αποτελέσματα, και η ισοπέδωσή τους σε «επιτυχία/αποτυχία» θα έκρυβε το μόνο που
 * χρειάζεται άνθρωπο: ένα `target-absent` σημαίνει *«η αγγελία διαγράφηκε»* —
 * αληθινό, μόνιμο, και **δεν θεραπεύεται με δεύτερο τρέξιμο**.
 */
export type BackfillOutcome =
  | { readonly id: string; readonly kind: 'already-present'; readonly custody: ListingCustody }
  | { readonly id: string; readonly kind: 'would-heal'; readonly custody: ListingCustody }
  | { readonly id: string; readonly kind: 'healed'; readonly custody: ListingCustody }
  | { readonly id: string; readonly kind: 'target-absent' }
  | { readonly id: string; readonly kind: 'unavailable' };

/** Πώς διαβάζεται μια θεματοφυλακή από άνθρωπο, σε **μία** γραμμή τερματικού. */
function describe(custody: ListingCustody): string {
  return custody.kind === 'personal'
    ? `προσωπικός χώρος · ${custody.userId}`
    : `χώρος εταιρείας · ${custody.companyId}`;
}

// =============================================================================
// 2. Η ΑΝΑΦΟΡΑ
// =============================================================================

const LABELS: Record<BackfillOutcome['kind'], string> = {
  'already-present': '⏭️  ΗΔΗ ΕΝΤΑΞΕΙ ',
  'would-heal': '👁️  ΘΑ ΓΡΑΦΟΤΑΝ ',
  healed: '✅ ΘΕΡΑΠΕΥΤΗΚΕ ',
  'target-absent': '⚠️  ΣΤΟΧΟΣ ΑΓΝΩΣΤΟΣ',
  unavailable: '❌ ΒΛΑΒΗ        ',
};

/**
 * **Τυπώνει τι έγινε, και λέει αν η εκτέλεση απέτυχε.**
 *
 * @returns `true` αν **οποιαδήποτε** πράξη κατέληξε σε βλάβη — δηλαδή αν το σύνολο
 *   είναι **άγνωστο**. Τότε ο καλών βγαίνει με κωδικό ≠ 0, ώστε ένα τρέξιμο μέσα σε
 *   αλυσίδα να **μη θεωρηθεί επιτυχία** επειδή τα υπόλοιπα πέρασαν.
 */
export function reportOutcome(outcomes: readonly BackfillOutcome[], apply: boolean): boolean {
  for (const outcome of outcomes) {
    const detail = 'custody' in outcome ? ` → ${describe(outcome.custody)}` : '';
    console.log(`   ${LABELS[outcome.kind]} ${outcome.id}${detail}`);
  }

  const tally = (kind: BackfillOutcome['kind']): number =>
    outcomes.filter((outcome) => outcome.kind === kind).length;

  const failed = tally('unavailable') > 0;

  console.log(`\n   ── ΣΥΝΟΨΗ ──`);
  console.log(`   ήδη εντάξει:      ${tally('already-present')}`);
  console.log(`   ${apply ? 'θεραπεύτηκαν:    ' : 'θα θεραπεύονταν: '} ${apply ? tally('healed') : tally('would-heal')}`);
  console.log(`   στόχος άγνωστος:  ${tally('target-absent')}`);
  console.log(`   βλάβες:           ${tally('unavailable')}`);

  if (!apply && tally('would-heal') > 0) {
    console.log(`\n   ℹ️  Ξηρό τρέξιμο — καμία γραφή. Ξανατρέξε με \`-- --apply\`.`);
  }
  if (failed) {
    console.log(`\n   🔴 Βλάβη σε τουλάχιστον μία πράξη: το σύνολο είναι ΑΓΝΩΣΤΟ, όχι κενό.`);
    console.log(`      Ξανατρέξε — το backfill είναι ιδεμποτεντ και θα συνεχίσει από εκεί.`);
  }

  return failed;
}

// =============================================================================
// 3. Η ΕΠΑΛΗΘΕΥΣΗ — από τη διαδρομή του ανθρώπου
// =============================================================================

/**
 * **Φαίνονται πλέον οι θεραπευμένες πράξεις στα εισερχόμενα του παραλήπτη τους;**
 *
 * 🔑 **Ρωτά μία φορά ανά ΔΙΑΚΡΙΤΟ παραλήπτη**, όχι μία ανά πράξη: το ερώτημα είναι
 * *«τι βλέπει αυτός ο άνθρωπος;»*, και δύο πράξεις προς τον ίδιο παραλήπτη είναι
 * **μία** οθόνη. Έτσι η επαλήθευση κοστίζει όσο και η πραγματική χρήση.
 *
 * ⚠️ **Μια βλάβη ΕΔΩ δεν ακυρώνει τη γραφή** — η γραφή έγινε. Αναφέρεται ως *«δεν
 * μπόρεσα να το επιβεβαιώσω»*, που είναι η αλήθεια, αντί για ένα ✅ που θα ήταν
 * ισχυρισμός χωρίς απόδειξη.
 */
export async function verifyVisibleToOfferers(
  adminDb: AdminFirestore,
  outcomes: readonly BackfillOutcome[],
): Promise<void> {
  const healed = outcomes.filter(
    (outcome): outcome is Extract<BackfillOutcome, { kind: 'healed' }> =>
      outcome.kind === 'healed',
  );
  if (healed.length === 0) return;

  console.log(`\n   ── ΕΠΑΛΗΘΕΥΣΗ: «ΦΑΙΝΕΤΑΙ;», από το ΙΔΙΟ ερώτημα με την οθόνη ──`);

  for (const [key, group] of groupByCustody(healed)) {
    const addressed = await contactsAddressedTo(adminDb, group.custody);

    if (addressed === null) {
      console.log(`   ⚠️  ${key} — η επαλήθευση δεν μπόρεσε να διαβάσει (η γραφή ΕΓΙΝΕ)`);
      continue;
    }

    const visible = new Set(addressed.map((contact) => contact.id));
    for (const id of group.ids) {
      console.log(visible.has(id) ? `   ✅ ${id} — ορατό σε ${key}` : `   ❌ ${id} — ΑΟΡΑΤΟ σε ${key}`);
    }
  }
}

/** Ομαδοποιεί κατά παραλήπτη — **μία** ανάγνωση ανά άνθρωπο, όχι ανά πράξη. */
function groupByCustody(
  healed: readonly Extract<BackfillOutcome, { kind: 'healed' }>[],
): ReadonlyMap<string, { readonly custody: ListingCustody; readonly ids: string[] }> {
  const groups = new Map<string, { custody: ListingCustody; ids: string[] }>();

  for (const outcome of healed) {
    const key = describe(outcome.custody);
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { custody: outcome.custody, ids: [outcome.id] });
    } else {
      existing.ids.push(outcome.id);
    }
  }

  return groups;
}
