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

/** Μια στήλη/γραμμή σύγκρισης: ποια προσφορά, ποιο όνομα (ήδη λυμένο ή `null`), ποιος αριθμός. */
export interface QuoteVendorPeer {
  quoteId: string;
  vendorName: string | null;
  displayNumber?: string;
}

/**
 * **Ετικέτες μέσα σε ΣΥΝΟΛΟ** (σύγκριση · leveling) — καθεμία μοναδική. Ο αριθμός μπαίνει όταν το όνομα **λείπει**
 * (`quoteVendorLabel`) **ή επαναλαμβάνεται**: δύο προσφορές του ίδιου προμηθευτή (αναθεώρηση, χειροκίνητη + πύλη)
 * ήταν δύο στήλες «Δοκιμαστικός Προμηθευτής Β» χωρίς τρόπο να ξεχωρίσουν (μετρημένο ζωντανά 2026-10-28, §8.5.4 ·
 * Ariba «Supplier (Bid 2)»). Μοναδικό όνομα ⇒ σκέτο όνομα, όπως πριν.
 */
export function quoteVendorLabelsById(peers: readonly QuoteVendorPeer[], t: TFunction): Map<string, string> {
  const counts = new Map<string, number>();
  for (const peer of peers) {
    const name = nonBlank(peer.vendorName);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return new Map(peers.map((peer) => {
    const name = nonBlank(peer.vendorName);
    const number = nonBlank(peer.displayNumber);
    const repeated = name !== null && (counts.get(name) ?? 0) > 1 && number !== null;
    const label = repeated ? t('quotes.vendorWithQuote', { vendor: name, quote: number }) : quoteVendorLabel(name, t, peer.displayNumber);
    return [peer.quoteId, label] as const;
  }));
}

/** Το όνομα **στην προσφώνηση** μηνύματος προς τον ίδιο τον προμηθευτή — ποτέ «άγνωστος» ούτε αριθμός προσφοράς. */
export function quoteVendorAddressee(name: string | null | undefined, t: TFunction): string {
  return nonBlank(name) ?? t('quotes.vendorAddresseeFallback');
}

/**
 * **Ο τίτλος ειδοποίησης που ονομάζει τον προμηθευτή** — server, χωρίς `t` (ADR-327, 2026-10-28). Γνωστό όνομα ⇒ το
 * `known` κλειδί με `vendorName`· άγνωστο ⇒ το `unknown` κλειδί (δική του διατύπωση, χωρίς `{vendorName}`). Πριν: ο
 * καλών έβαζε `?? quoteId` (ωμό αναγνωριστικό στον τίτλο) ή κενό όνομα από πρόσκληση χωρίς όνομα ΚΑΙ email.
 * Δύο ρητά κλειδιά, όχι συρραφή: το CHECK 3.8 βλέπει κάθε κλειδί κυριολεκτικά.
 */
export function vendorNotificationTitle(
  name: string | null | undefined,
  keys: { readonly known: string; readonly unknown: string },
  params: Readonly<Record<string, string>> = {},
): { titleKey: string; titleParams: Record<string, string> } {
  const known = nonBlank(name);
  return known
    ? { titleKey: keys.known, titleParams: { ...params, vendorName: known } }
    : { titleKey: keys.unknown, titleParams: { ...params } };
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

/** Ο ενεργός είναι ο προμηθευτής (πύλη), όχι εσωτερικός χρήστης ⇒ **δεν** αναζητείται στο `users/{uid}`. */
export function isVendorActorId(actorId: string): boolean {
  return actorId.startsWith('vendor:');
}

/** Το στιγμιότυπο από την πρόσκληση (όνομα που έδωσε ο PM ή της επαφής τη στιγμή της πρόσκλησης · email). */
export function vendorSnapshotFromInvite(
  invite: Pick<VendorInvite, 'id' | 'recipientName' | 'recipientEmail'>,
): QuoteVendorSnapshot {
  const email = nonBlank(invite.recipientEmail);
  return { name: nonBlank(invite.recipientName) ?? email ?? '', email, inviteId: invite.id };
}
