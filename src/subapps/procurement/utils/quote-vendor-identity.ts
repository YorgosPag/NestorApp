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
import type { TFunction } from 'i18next';

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

/**
 * **Η ΜΟΝΗ ετικέτα «άγνωστος» στην οθόνη** (ADR-327 §8.5 — 2026-10-28). Το `null` μένει στα δεδομένα (είναι γεγονός,
 * όχι κείμενο)· εδώ γίνεται κείμενο. `quoteNumber` = όπου ο αριθμός **δεν** φαίνεται ήδη δίπλα (σύγκριση, leveling,
 * διάλογοι, toasts) ⇒ δύο άγνωστοι στην ίδια σύγκριση ξεχωρίζουν· η κάρτα/κεφαλίδα που ήδη έχει τίτλο τον αριθμό
 * τον παραλείπει. Πριν: κάθε καλών διάλεγε δικό του fallback (`''` · `'—'` · «Προμηθευτής» · ωμό `vendorContactId`).
 */
export function quoteVendorLabel(name: string | null | undefined, t: TFunction, quoteNumber?: string): string {
  const known = nonBlank(name);
  if (known) return known;
  const number = nonBlank(quoteNumber);
  return number ? t('quotes.vendorUnknownWithQuote', { quote: number }) : t('quotes.vendorUnknown');
}

/** Το όνομα **στην προσφώνηση** μηνύματος προς τον ίδιο τον προμηθευτή — ποτέ «άγνωστος» ούτε αριθμός προσφοράς. */
export function quoteVendorAddressee(name: string | null | undefined, t: TFunction): string {
  return nonBlank(name) ?? t('quotes.vendorAddresseeFallback');
}

/** Το email του προμηθευτή: στιγμιότυπο πρόσκλησης (πύλη) → σάρωση. Πριν: ρωτούσε **μόνο** τη σάρωση. */
export function quoteVendorEmail(quote: Pick<Quote, 'vendorSnapshot' | 'extractedData'>): string | null {
  return nonBlank(quote.vendorSnapshot?.email) ?? nonBlank(quote.extractedData?.vendorEmails?.value?.[0]);
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
