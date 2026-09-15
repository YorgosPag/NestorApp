/**
 * @fileoverview ⚖️ **ΤΑ ΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΟΠΩΣ ΤΑ ΔΙΑΒΑΖΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ** — καθαρές αποφάσεις παρουσίασης (ADR-841 §7 Α23 Φ4 Α2).
 * @related types/showcase-legal-identity.ts · components/mandate/LegalIdentityStatement.tsx · lib/agency/showcase-structured-data.ts
 * @module lib/agency/showcase-legal-presentation
 *
 * 🔑 **Η απόφαση ζει εδώ, όχι σε JSX** (ίδιο ιδίωμα με το `composeCredibility`): σελίδα **και** JSON-LD ρωτούν τις ίδιες
 * συναρτήσεις, και οι άγκυρες τις εκτελούν χωρίς render.
 *
 * **Layering**: leaf — καθαρό, πελάτης και διακομιστής.
 */

import type { ShowcaseCredential } from '@/types/agency-profile';
import type { ShowcaseLegalIdentity, ShowcaseSeat } from '@/types/showcase-legal-identity';

/**
 * **Η έδρα σε μία γραμμή** — ό,τι η δημοσίευση επέτρεψε (Δ7), ούτε λέξη παραπάνω: `municipality` ⇒ μόνο ο δήμος.
 * Η κοπή έγινε ήδη στον αναγνώστη (`showcase-read-legal-identity.ts`)· εδώ μόνο συναρμολόγηση.
 */
export function seatLineOf(seat: ShowcaseSeat): string {
  const locality = seat.postalCode === null ? seat.locality : `${seat.postalCode} ${seat.locality}`;
  return seat.streetLine === null ? locality : `${seat.streetLine}, ${locality}`;
}

function restatesRegistryNumber(credential: ShowcaseCredential, gemiNumber: string): boolean {
  const { attestation } = credential;
  if (!('registration' in attestation)) return false;
  const { registration } = attestation;
  return registration.authorityKind === 'national' && registration.authority === 'gemi' && registration.number === gemiNumber;
}

/**
 * **Τα πιστοποιητικά που μένουν να ειπωθούν δίπλα στα νομικά στοιχεία.**
 *
 * 🔴 Ο μεσίτης δηλώνει τον αριθμό ΓΕΜΗ **και** ως πιστοποιητικό επαγγέλματος — ο **ίδιος** αριθμός, από το **ίδιο** προφίλ
 * (`bindRegistryNumber`, Δ1). Δύο γραμμές για ένα γεγονός, με δύο διαφορετικές διατυπώσεις βεβαίωσης, θα έμοιαζαν με δύο
 * ισχυρισμούς. ⇒ Ο αριθμός λέγεται **μία** φορά, στα νομικά στοιχεία. **Άλλος** αριθμός ή άλλη αρχή **μένουν** (άλλο γεγονός).
 */
export function credentialsBesideLegalIdentity(
  credentials: readonly ShowcaseCredential[],
  identity: ShowcaseLegalIdentity | null,
): readonly ShowcaseCredential[] {
  const gemiNumber = identity?.gemiNumber ?? null;
  if (gemiNumber === null) return credentials;
  return credentials.filter((credential) => !restatesRegistryNumber(credential, gemiNumber));
}
