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

import {
  contradictsDocumentText,
  resolvedDocumentExpiry,
  type DocumentFacts,
} from '@/lib/document-validity/document-facts';
import type { LegalityClaim } from '@/lib/legality/legality-claim';
import { wholePropertySpace } from '@/lib/spaces/space-ref';

import type { EnergyCertificate } from './energy-certificate';

/** Ό,τι χρειάζεται η αξίωση από τα γεγονότα του αρχείου-πηγής — χωρίς το «ποιος/πότε». */
export type EnergySourceFacts = Pick<DocumentFacts, 'kind' | 'issuedOn' | 'printedValidUntil' | 'source'>;

/**
 * Το μπλοκ ως αξίωση — ή `null` όταν δεν υπάρχει κλάση να βεβαιωθεί («υπό έκδοση» και «εξαιρείται» **δεν** είναι
 * αξίωση: λένε γιατί λείπει, δεν βεβαιώνουν κάτι).
 *
 * - `tier: 'self-declared'` — ο αγγελιοδότης το λέει· κανένα μητρώο δεν ρωτήθηκε. (Η αναβάθμιση σε βαθμίδα «έγγραφο»
 *   όταν υπάρχει ανάγνωση είναι εύρημα του ADR-838, όχι απόφαση εδώ.)
 * - `authority: null` — επιτρέπεται **μόνο** σε αυτή τη βαθμίδα (`claimAuthorityIsWellFormed`).
 * - `validUntil` (ADR-915 Φ3β-2): **η ΜΙΑ γέφυρα** `resolvedDocumentExpiry` — τα γεγονότα του αρχείου-πηγής
 *   κερδίζουν ανά πεδίο (Α3) και η τυπωμένη λήξη, αν νωρίτερη, ισχύει (Α4). Χωρίς γεγονότα ⇒ ο κανόνας από την
 *   πληκτρολογημένη έκδοση, **ακριβώς** όπως πριν. `null` ⇒ `expiry-unknown`, ποτέ «ισχύει».
 */
export function energyPerformanceClaimOf(
  certificate: EnergyCertificate,
  propertyId: string,
  assertedAt: string,
  facts: EnergySourceFacts | null = null,
): LegalityClaim | null {
  if (certificate.class === null) return null;
  return {
    kind: 'energy-performance',
    subject: [wholePropertySpace(propertyId)],
    tier: 'self-declared',
    value: certificate.class,
    authority: null,
    assertedAt,
    validUntil: resolvedDocumentExpiry('energy-certificate', facts, certificate.issuedOn).expiresOn,
  };
}

/**
 * **Αντιλέγει το μπλοκ στο έγγραφο από το οποίο λέει ότι ήρθε;** Ο τίμιος πελάτης δεν φτάνει ποτέ εδώ: η χειροκίνητη
 * αλλαγή ημερομηνίας **σβήνει** το `sourceFileId` (`applyEnergyCertificatePatch`). Τον φτάνει μόνο μπαγιάτικο ή
 * πλαστό σώμα — που θα έδειχνε ημερομηνία «του ΠΕΑ» την οποία το ΠΕΑ δεν γράφει.
 */
export function energyIssuedOnContradicts(certificate: EnergyCertificate, facts: EnergySourceFacts | null): boolean {
  return certificate.sourceFileId !== null && contradictsDocumentText('energy-certificate', facts, certificate.issuedOn);
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
 * - `facts` = τα γεγονότα του `sourceFileId` (ADR-915 Φ3β-2)· ίδια γεγονότα ⇒ ίδια λήξη ⇒ ίδια δήλωση.
 */
export function withEnergyPerformanceClaim(
  claims: readonly LegalityClaim[],
  certificate: EnergyCertificate,
  propertyId: string,
  assertedAt: string,
  facts: EnergySourceFacts | null = null,
): readonly LegalityClaim[] {
  const isOwnDeclaration = (claim: LegalityClaim): boolean =>
    claim.kind === 'energy-performance' && claim.tier === 'self-declared';
  const others = claims.filter((claim) => !isOwnDeclaration(claim));
  const next = energyPerformanceClaimOf(certificate, propertyId, assertedAt, facts);
  if (next === null) return others;
  const standing = claims.find((claim) => isOwnDeclaration(claim) && sameAssertion(claim, next));
  return [...others, standing ?? next];
}
