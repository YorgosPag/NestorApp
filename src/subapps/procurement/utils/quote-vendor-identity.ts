/**
 * **Ποιος είναι ο προμηθευτής μιας προσφοράς** (ADR-327 §8.5 Γ) — ΟΙ κανόνες, μία φορά, καθαροί (client + server).
 *
 * Πριν: 7 σημεία του UI έγραφαν `quote.extractedData?.vendorName?.value ?? …` — δηλαδή ρωτούσαν **μόνο τη σάρωση**.
 * Προσφορά πύλης δεν έχει σάρωση ⇒ «Προμηθευτής» / «—» / ωμό id. Και πρόσκληση χωρίς επαφή έγραφε `vendorContactId: ''`
 * και ενεργό `vendor:` — υπογραφή χωρίς όνομα στο ιστορικό.
 *
 * Σειρά (ισχυρότερη πηγή πρώτα): **επαφή** (όταν ο καλών έχει το όνομά της) → **στιγμιότυπο πρόσκλησης** (πύλη) →
 * **σάρωση** (AI) → `null` (ο καλών δείχνει τη δική του ετικέτα «άγνωστος» — ποτέ ωμό id).
 *
 * @module subapps/procurement/utils/quote-vendor-identity
 * @enterprise ADR-327 §8.5 Γ
 */

import type { Quote, QuoteVendorSnapshot } from '../types/quote';
import type { VendorInvite } from '../types/vendor-invite';

type VendorFacts = Pick<Quote, 'vendorContactId' | 'vendorSnapshot' | 'extractedData'>;

function nonBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Το όνομα για εμφάνιση. `contactName` = το όνομα της επαφής, όταν ο καλών το έχει ήδη (lookup). */
export function quoteVendorDisplayName(quote: VendorFacts, contactName?: string | null): string | null {
  return nonBlank(contactName)
    ?? nonBlank(quote.vendorSnapshot?.name)
    ?? nonBlank(quote.extractedData?.vendorName?.value);
}

/** Η προσφορά **δεν** είναι δεμένη σε επαφή ⇒ ο PM μπορεί να την προσθέσει στις επαφές. */
export function quoteLacksVendorContact(quote: Pick<Quote, 'vendorContactId'>): boolean {
  return !nonBlank(quote.vendorContactId);
}

/**
 * Ο **ενεργός** στο ιστορικό μιας ενέργειας του προμηθευτή μέσω πύλης: `vendor:{contactId}`, ή —χωρίς επαφή—
 * `vendor:invite:{inviteId}` (η πρόσκληση είναι η ταυτότητα· ποτέ σκέτο `vendor:`).
 */
export function vendorActorId(identity: { vendorContactId: string; inviteId: string }): string {
  const contactId = nonBlank(identity.vendorContactId);
  return contactId ? `vendor:${contactId}` : `vendor:invite:${identity.inviteId}`;
}

/** Το στιγμιότυπο από την πρόσκληση (όνομα που έδωσε ο PM ή της επαφής τη στιγμή της πρόσκλησης · email). */
export function vendorSnapshotFromInvite(
  invite: Pick<VendorInvite, 'id' | 'recipientName' | 'recipientEmail'>,
): QuoteVendorSnapshot {
  const email = nonBlank(invite.recipientEmail);
  return { name: nonBlank(invite.recipientName) ?? email ?? '', email, inviteId: invite.id };
}
