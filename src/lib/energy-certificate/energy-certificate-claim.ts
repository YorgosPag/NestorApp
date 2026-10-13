/**
 * @fileoverview **Η αξίωση νομιμότητας που γεννά η δήλωση του ΠΕΑ** (ADR-777 §8.94 · ADR-838).
 * @related `./energy-certificate.ts` · `lib/legality/legality-claim.ts` · `lib/legality/legality-signal.ts` ·
 *   `services/listings/legality-projection.ts`
 * @module lib/energy-certificate/energy-certificate-claim
 *
 * 🔑 **Ο ΠΡΩΤΟΣ ΓΡΑΦΕΑΣ ΑΞΙΩΣΗΣ.** Το κανάλι νομιμότητας (ADR-838) ήξερε από την αρχή το είδος `'energy-performance'`
 * — με λήξη, με βαθμίδα, με οθόνη — και δήλωνε ρητά ότι **κανείς δεν γράφει αξιώσεις**. Η ισχύς του ΠΕΑ δεν γίνεται
 * δεύτερο δημόσιο πεδίο: γράφεται **εκεί**, ώστε το «ισχύει το πιστοποιητικό;» να έχει **μία** απάντηση.
 *
 * ⛔ **ΔΕΝ είναι η «παραγωγή από υπάρχοντα πεδία» που απαγορεύει το `legality-projection.ts`.** Εκείνη θα έφτιαχνε
 * αξίωση από παλιά `energy.class` χωρίς `assertedAt` — «ψέμα με ημερομηνία». Εδώ η αξίωση γράφεται **τη στιγμή που ο
 * άνθρωπος δηλώνει**, με εκείνη τη στιγμή ως `assertedAt`. Ακίνητο με παλιά κλάση που κανείς δεν ξαναδήλωσε μένει
 * `undeclared` στη νομιμότητα — που είναι η αλήθεια.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O, μηδέν ρολόι (η στιγμή έρχεται από τον καλούντα).
 */

import type { LegalityClaim } from '@/lib/legality/legality-claim';
import { wholePropertySpace } from '@/lib/spaces/space-ref';

import { certificateValidUntil, type EnergyCertificate } from './energy-certificate';

/**
 * Το μπλοκ ως αξίωση — ή `null` όταν δεν υπάρχει κλάση να βεβαιωθεί («υπό έκδοση» και «εξαιρείται» **δεν** είναι
 * αξίωση: λένε γιατί λείπει, δεν βεβαιώνουν κάτι).
 *
 * - `tier: 'self-declared'` — ο αγγελιοδότης το λέει· κανένα έγγραφο δεν ανέβηκε, κανένα μητρώο δεν ρωτήθηκε.
 * - `authority: null` — επιτρέπεται **μόνο** σε αυτή τη βαθμίδα (`claimAuthorityIsWellFormed`).
 * - `validUntil: null` όταν η έκδοση είναι άγνωστη ⇒ το κανάλι απαντά `expiry-unknown`, ποτέ «ισχύει».
 */
export function energyPerformanceClaimOf(
  certificate: EnergyCertificate,
  propertyId: string,
  assertedAt: string,
): LegalityClaim | null {
  if (certificate.class === null) return null;
  return {
    kind: 'energy-performance',
    subject: [wholePropertySpace(propertyId)],
    tier: 'self-declared',
    value: certificate.class,
    authority: null,
    assertedAt,
    validUntil: certificateValidUntil(certificate.issuedOn),
  };
}

/** Το κλειδί της αξίωσης: ό,τι, αν αλλάξει, κάνει τη δήλωση **άλλη** δήλωση. */
function sameAssertion(claim: LegalityClaim, next: LegalityClaim): boolean {
  return claim.value === next.value && claim.validUntil === next.validUntil && claim.tier === next.tier;
}

/**
 * **Οι αξιώσεις του εγγράφου μετά τη δήλωση** — αντικαθίσταται **μόνο** η αυτοδηλωμένη `'energy-performance'`.
 *
 * - Κάθε άλλο είδος μένει ανέγγιχτο· το ίδιο και μια ΠΕΑ-αξίωση **ανώτερης** βαθμίδας (έγγραφο, μητρώο): η δήλωση του
 *   αγγελιοδότη δεν σβήνει ό,τι ξέρουμε ισχυρότερα.
 * - Ίδια δήλωση ⇒ **κρατιέται η παλιά**, με το παλιό της `assertedAt`: η αποθήκευση άσχετου πεδίου δεν «ξαναδηλώνει»
 *   το πιστοποιητικό σήμερα.
 * - Χωρίς κλάση ⇒ η αυτοδηλωμένη αξίωση φεύγει.
 */
export function withEnergyPerformanceClaim(
  claims: readonly LegalityClaim[],
  certificate: EnergyCertificate,
  propertyId: string,
  assertedAt: string,
): readonly LegalityClaim[] {
  const isOwnDeclaration = (claim: LegalityClaim): boolean =>
    claim.kind === 'energy-performance' && claim.tier === 'self-declared';
  const others = claims.filter((claim) => !isOwnDeclaration(claim));
  const next = energyPerformanceClaimOf(certificate, propertyId, assertedAt);
  if (next === null) return others;
  const standing = claims.find((claim) => isOwnDeclaration(claim) && sameAssertion(claim, next));
  return [...others, standing ?? next];
}
