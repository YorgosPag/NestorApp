/**
 * @fileoverview **Ο γραφέας των δηλώσεων της αντικειμενικής του ιδιώτη** (ADR-898 Φ3β) — πρόσοψη, μικτά με
 * κοινόχρηστους, ημερομηνία άδειας, θέρμανση/ανελκυστήρας, πρόσοψη σε μέτωπο, και η απόκρυψη.
 * @related `lib/objective-value/objective-value-declarations.ts` (σχήμα · διόρθωση · κανόνες) ·
 *   `owner-property-write-completion.ts` (ίχνος → επαναπροβολή) · `app/api/owner-properties/[ownerPropertyId]/route.ts`
 * @module services/owner-property/owner-property-declarations.service
 *
 * 🔴 **ΣΥΝΑΛΛΑΓΗ, ΟΧΙ «ΑΝΑΓΝΩΣΗ ΚΑΙ ΜΕΤΑ `set`»**: η οθόνη «Βελτίωσε την αγγελία σου» αποθηκεύει **κάθε απάντηση
 * αμέσως** (μοτίβο Google Docs). Δύο απαντήσεις μέσα σε λίγα ms θα διάβαζαν το **ίδιο** παλιό έγγραφο, και η δεύτερη
 * θα έσβηνε την πρώτη. Μέσα στη συναλλαγή η διόρθωση εφαρμόζεται πάνω στο **φρέσκο** έγγραφο, και το Firestore
 * ξανατρέχει τη συνάρτηση σε σύγκρουση ⇒ καμία απάντηση δεν χάνεται.
 *
 * 🔑 **Μερική διόρθωση**: αλλάζουν **μόνο** τα κλειδιά που στάλθηκαν· ρητό `null` = «σβήσε την απάντηση».
 *
 * 🔑 **Ο δρόμος του μετώπου επαληθεύεται στον server** (ποτέ εμπιστοσύνη στη φόρμα): πρέπει να είναι υποψήφιο μέτωπο
 * στη θέση **που θα δημοσιευτεί** — ίδια γνώση θέσης με τον γραφέα της προβολής. Ζώνες που δεν διαβάστηκαν ⇒
 * `zone-unverified` (503), **ποτέ** «άκυρο».
 *
 * 🔑 **Θεματοφυλακή από τη ΜΙΑ αρχή** (`mayAdminister(custodyOf(…))`, CHECK 3.56) — ξένο έγγραφο ⇒ `absent`, ίδια
 * απάντηση με «δεν υπάρχει».
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { marketDayOf } from '@/lib/listings/listing-stats';
import {
  applyObjectiveValuePatch,
  objectiveValuePatchViolations,
  type ObjectiveValueDeclarationsPatch,
} from '@/lib/objective-value/objective-value-declarations';
import { custodyOf, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { placeKnowledgeFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveListingPosition } from '@/services/listings/public-listing-position';
import { zoneFrontVerdict } from '@/services/market/zone-front-verdict';
import { completeWrite, writeFailure } from '@/services/owner-property/owner-property-write-completion';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';
import type { OwnerProperty } from '@/types/owner-property';

const logger = createModuleLogger('owner-property-declarations.service');

type Proceed = { readonly kind: 'proceed'; readonly before: OwnerProperty; readonly after: OwnerProperty };

/** Η θέση που **θα δημοσιευτεί** — η ίδια γνώση θέσης με τον γραφέα της προβολής. */
function publishedPositionOf(property: OwnerProperty, at: string) {
  const disclosure = property.place.kind === 'declined' ? 'declined' : null;
  return resolveListingPosition(placeKnowledgeFromOwnerProperty(property, at), disclosure);
}

/** Ο δρόμος του μετώπου, αν δηλώνεται, πρέπει να είναι υποψήφιο μέτωπο **τώρα**. `null` = εντάξει. */
async function zoneFrontRefusal(
  patch: ObjectiveValueDeclarationsPatch,
  property: OwnerProperty,
  at: string,
): Promise<OwnerPropertyWriteResult | null> {
  switch (await zoneFrontVerdict(patch, () => publishedPositionOf(property, at))) {
    case 'accepted':
      return null;
    case 'zone-unverified':
      return { kind: 'zone-unverified' };
    case 'not-candidate':
      return { kind: 'invalid-declarations', violations: ['zoneFrontNotCandidate'] };
  }
}

/** Η συναλλαγή: φρέσκο έγγραφο → θεματοφυλακή → μέτωπο → διόρθωση → εγγραφή. */
async function applyInTransaction(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  patch: ObjectiveValueDeclarationsPatch,
  actor: ListingActor,
): Promise<OwnerPropertyWriteResult | Proceed> {
  const ref = adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId);
  return adminDb.runTransaction(async (tx) => {
    const now = nowISO();
    const existing = ownerPropertyFromDocument((await tx.get(ref)).data(), ownerPropertyId);
    if (existing === null || !mayAdminister(custodyOf(existing), actor)) return { kind: 'absent' } as const;
    const refusal = await zoneFrontRefusal(patch, existing, now);
    if (refusal !== null) return refusal;
    const after: OwnerProperty = {
      ...existing,
      objectiveValueDeclarations: applyObjectiveValuePatch(existing.objectiveValueDeclarations, patch),
      updatedAt: now,
    };
    tx.set(ref, after);
    return { kind: 'proceed', before: existing, after } as const;
  });
}

/**
 * **Οι δηλώσεις της αντικειμενικής** σε υπάρχουσα αγγελία ιδιώτη. Η διόρθωση έχει ήδη περάσει το σχήμα
 * (`objectiveValueDeclarationsPatchSchema`) στη διαδρομή.
 */
export async function setOwnerPropertyObjectiveValueDeclarations(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  patch: ObjectiveValueDeclarationsPatch,
  actor: ListingActor,
): Promise<OwnerPropertyWriteResult> {
  const violations = objectiveValuePatchViolations(patch, marketDayOf(Date.now()));
  if (violations.length > 0) return { kind: 'invalid-declarations', violations };

  let outcome: OwnerPropertyWriteResult | Proceed;
  try {
    outcome = await applyInTransaction(adminDb, ownerPropertyId, patch, actor);
  } catch (error) {
    return writeFailure(logger, 'Οι δηλώσεις της αντικειμενικής δεν αποθηκεύτηκαν', ownerPropertyId, error);
  }
  if (outcome.kind !== 'proceed') return outcome;

  // ⚠️ Ίχνος και επαναπροβολή ΕΞΩ από τη συναλλαγή (ίδιο με την εντολή): η προβολή είναι παράγωγο σε άλλη συλλογή.
  return completeWrite(adminDb, outcome.after, { actor, before: outcome.before });
}
