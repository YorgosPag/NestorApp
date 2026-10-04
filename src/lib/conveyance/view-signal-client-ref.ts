/**
 * @fileoverview **ΤΟ ΣΗΜΑ ΜΙΑΣ ΟΨΗΣ ΓΙΑ ΤΟΝ ΠΕΛΑΤΗ** (Web SDK) — χτισμένο σε **ένα** σημείο, **μόνο ανάγνωση**.
 * @related ADR-901 §14.8 · `services/conveyance/conveyance-view-signal.server.ts` (ο δίδυμος του Admin SDK)
 * @module lib/conveyance/view-signal-client-ref
 *
 * 🔑 Ο **ίδιος** σπόρος (`viewSignalSeed`) και ο **ίδιος** γεννήτορας id με τον γραφέα: το έγγραφο υπολογίζεται,
 *    δεν αναζητείται — κανένα ερώτημα, κανένας δείκτης, κανένα `list` (που ο κανόνας αρνείται ούτως ή άλλως).
 * ⛔ **ΚΑΜΙΑ ΓΡΑΦΗ, ΠΟΤΕ**: ο κανόνας κλείνει κάθε γραφή πελάτη· ένα `setDoc` εδώ θα ήταν δεύτερος γραφέας.
 */

import { doc, type DocumentReference } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase';
import { generateDeterministicConveyanceViewSignalId } from '@/services/enterprise-id.service';
import { viewSignalSeed, type CaseViewKey } from './view-signal-key';

/** Το id του σήματος — και το κλειδί της συνδρομής (αλλάζει ⇒ νέα συνδρομή). */
export function viewSignalId(view: CaseViewKey): string {
  return generateDeterministicConveyanceViewSignalId(viewSignalSeed(view));
}

/** `conveyance_view_signals/{cvs_…}` — ανάγνωση μόνο από τον κάτοχο της όψης (κανόνας). */
export function clientViewSignalDoc(view: CaseViewKey): DocumentReference {
  return doc(db, COLLECTIONS.CONVEYANCE_VIEW_SIGNALS, viewSignalId(view));
}

/** Το σύνορο: μόνο ο αριθμός — ό,τι άλλο κι αν έγραφε κάποτε το έγγραφο, δεν διαβάζεται. */
export function viewSignalRevisionOf(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const revision = (raw as { readonly revision?: unknown }).revision;
  return typeof revision === 'number' && Number.isFinite(revision) ? revision : null;
}
