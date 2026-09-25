/**
 * @fileoverview **Η ΑΠΟΔΕΙΞΗ ΕΝΟΣ ΕΠΑΓΓΕΛΜΑΤΙΑ** — ανάγνωση από έγγραφο + ο πήχης του μητρώου.
 * @related ADR-841 Α9.1/Α9.2 · ADR-884 Φ0.2 αναλλοίωτο #2 · types/professional-identity
 * @module lib/professional/professional-attestation
 *
 * 🔑 **Μετακόμισε εδώ από το `lib/agency/showcase-read.ts`** (ADR-884 Κ1): ο ίδιος αναγνώστης χρειάζεται
 * και στον υπογράφοντα μιας μελέτης στη χωρική περιήγηση. Δεύτερη υλοποίηση θα ήταν δεύτερη απάντηση
 * στο «τι μετράει ως απόδειξη» — και η μία θα ξεχνούσε ότι το `1234` χωρίς σύλλογο δεν επαληθεύεται.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import {
  isChapteredRegistry,
  isRegistryAuthority,
  type NationalRegistryId,
} from '@/constants/professional-registries';
import { text } from '@/lib/agency/showcase-read-primitives';
import type { ProfessionalAttestation } from '@/types/professional-identity';

/**
 * Διαβάζει την απόδειξη από ωμά δεδομένα. Η **απουσία** είναι έγκυρη — είναι το `unknown`.
 * `null` ⇒ υπάρχει κάτι, αλλά **δεν** είναι απόδειξη (ο καλών αποφασίζει τι σημαίνει αυτό για το έγγραφο).
 */
export function readProfessionalAttestation(raw: unknown): ProfessionalAttestation | null {
  if (raw === undefined || raw === null) return { state: 'unknown' };
  if (typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;

  const state = source.state;
  if (state === 'unknown') return { state: 'unknown' };
  if (state !== 'declared' && state !== 'verified') return null;

  const registration = source.registration as Record<string, unknown> | undefined;
  const authority = text(registration?.authority);
  const number = text(registration?.number);
  if (authority === null || number === null || !isRegistryAuthority(authority)) return null;

  if (isChapteredRegistry(authority)) {
    const chapter = text(registration?.chapter);
    // 🔒 Η Α9.1 στο σύνορο: «1234» χωρίς «ΔΣΘ» δεν επαληθεύεται από κανέναν.
    if (chapter === null) return null;
    return { state, registration: { authorityKind: 'chapter', authority, chapter, number } };
  }
  return { state, registration: { authorityKind: 'national', authority, number } };
}

/**
 * **Περνά τον πήχη του μητρώου;** — δήλωσε (ή επαληθεύτηκε) εγγραφή σε **αυτή** την αρχή.
 *
 * Ο πήχης είναι του ADR-841 Α9.2: **`declared` αρκεί** — ο ψεύτικος αριθμός εκθέτει αυτόν που τον έγραψε.
 * Το `unknown` **δεν** περνά ποτέ: σιωπή δεν είναι δήλωση. Η αρχή ελέγχεται **ρητά**: μελέτη ανακαίνισης
 * θέλει **ΤΕΕ** — εγγραφή σε δικηγορικό σύλλογο είναι αληθινή δήλωση για **άλλο** ερώτημα.
 */
export function attestsNationalRegistry(
  attestation: ProfessionalAttestation,
  authority: NationalRegistryId,
): boolean {
  if (attestation.state === 'unknown') return false;
  const { registration } = attestation;
  return (
    registration.authorityKind === 'national' &&
    registration.authority === authority &&
    registration.number.trim() !== ''
  );
}
