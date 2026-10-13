/**
 * @fileoverview **Η ΜΙΑ συναλλαγή των «πράξεων μετά τη δημοσίευση»** της αγγελίας ιδιώτη — δηλώσεις αντικειμενικής
 * (ADR-898 Φ3β), κοινόχρηστα (ADR-777 §8.93), και κάθε επόμενη ενότητα του «Βελτίωσε την αγγελία σου» (ADR-842 Φ4).
 * @related `owner-property-declarations.service.ts` · `owner-property-common-charges.service.ts` (οι καλούντες) ·
 *   `owner-property-write-completion.ts` (ίχνος → επαναπροβολή)
 * @module services/owner-property/owner-property-amendment
 *
 * 🔴 **ΣΥΝΑΛΛΑΓΗ, ΟΧΙ «ΑΝΑΓΝΩΣΗ ΚΑΙ ΜΕΤΑ `set`»**: η οθόνη αποθηκεύει **κάθε απάντηση αμέσως** (μοτίβο Google Docs).
 * Δύο απαντήσεις μέσα σε λίγα ms θα διάβαζαν το **ίδιο** παλιό έγγραφο, και η δεύτερη θα έσβηνε την πρώτη. Μέσα στη
 * συναλλαγή η διόρθωση εφαρμόζεται πάνω στο **φρέσκο** έγγραφο, και το Firestore ξανατρέχει τη συνάρτηση σε σύγκρουση.
 *
 * 🔑 **Γιατί υπάρχει ως δικό του αρχείο**: γεννήθηκε μέσα στον γραφέα των δηλώσεων· η δεύτερη ενότητα θα τον
 * αντέγραφε ολόκληρο (N.18). Ο καλών δίνει **μόνο** ό,τι διαφέρει — τι αλλάζει, και αν αρνείται.
 *
 * 🔑 **Θεματοφυλακή από τη ΜΙΑ αρχή** (`mayAdminister(custodyOf(…))`, CHECK 3.56) — ξένο έγγραφο ⇒ `absent`, ίδια
 * απάντηση με «δεν υπάρχει».
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { custodyOf, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { completeWrite, writeFailure } from '@/services/owner-property/owner-property-write-completion';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';
import type { OwnerProperty } from '@/types/owner-property';

/** Τι αποφάσισε ο καλών πάνω στο φρέσκο έγγραφο: τα πεδία που αλλάζουν, ή ονομασμένη άρνηση. */
export type OwnerPropertyAmendment =
  | { readonly kind: 'amend'; readonly fields: Partial<OwnerProperty> }
  | { readonly kind: 'refuse'; readonly result: OwnerPropertyWriteResult };

export interface OwnerPropertyAmendmentInput {
  readonly ownerPropertyId: string;
  readonly actor: ListingActor;
  /** Κρίνει πάνω στο **φρέσκο** έγγραφο. Μπορεί να ξανατρέξει (σύγκρουση) ⇒ καμία παρενέργεια μέσα του. */
  readonly amend: (existing: OwnerProperty, at: string) => OwnerPropertyAmendment | Promise<OwnerPropertyAmendment>;
  /** Το μήνυμα του καταγραφέα όταν η συναλλαγή πετάξει. */
  readonly failureMessage: string;
  readonly logger: Parameters<typeof writeFailure>[0];
}

type Proceed = { readonly kind: 'proceed'; readonly before: OwnerProperty; readonly after: OwnerProperty };

/** Η συναλλαγή: φρέσκο έγγραφο → θεματοφυλακή → κρίση του καλούντος → εγγραφή. */
function amendInTransaction(
  adminDb: AdminFirestore,
  { ownerPropertyId, actor, amend }: OwnerPropertyAmendmentInput,
): Promise<OwnerPropertyWriteResult | Proceed> {
  const ref = adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId);
  return adminDb.runTransaction(async (tx) => {
    const now = nowISO();
    const existing = ownerPropertyFromDocument((await tx.get(ref)).data(), ownerPropertyId);
    if (existing === null || !mayAdminister(custodyOf(existing), actor)) return { kind: 'absent' } as const;
    const amendment = await amend(existing, now);
    if (amendment.kind === 'refuse') return amendment.result;
    const after: OwnerProperty = { ...existing, ...amendment.fields, updatedAt: now };
    tx.set(ref, after);
    return { kind: 'proceed', before: existing, after } as const;
  });
}

/** **Μια πράξη πάνω σε υπάρχουσα αγγελία ιδιώτη** — συναλλαγή, και μετά ίχνος + επαναπροβολή. */
export async function amendOwnerProperty(
  adminDb: AdminFirestore,
  input: OwnerPropertyAmendmentInput,
): Promise<OwnerPropertyWriteResult> {
  let outcome: OwnerPropertyWriteResult | Proceed;
  try {
    outcome = await amendInTransaction(adminDb, input);
  } catch (error) {
    return writeFailure(input.logger, input.failureMessage, input.ownerPropertyId, error);
  }
  if (outcome.kind !== 'proceed') return outcome;

  // ⚠️ Ίχνος και επαναπροβολή ΕΞΩ από τη συναλλαγή (ίδιο με την εντολή): η προβολή είναι παράγωγο σε άλλη συλλογή.
  return completeWrite(adminDb, outcome.after, { actor: input.actor, before: outcome.before });
}
