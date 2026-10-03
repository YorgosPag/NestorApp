/**
 * **Ο αριθμός μητρώου του νομικού επαγγελματία, όπως τον ξέρει η επαφή** (persona `lawyer` / `notary`).
 *
 * Η ΜΙΑ ανάγνωση των persona για το στιγμιότυπο του συμβολαίου (`professional-snapshot.service`) **και** για την
 * προσυμπλήρωση της δήλωσης στην πρόσκληση υπόθεσης (ADR-901 Φ3 · Ε-4) — εξήχθη από το snapshot service ώστε να
 * μη γραφτεί δεύτερη φορά στον server. Καθαρό (leaf): μόνο τύποι και φρουροί persona.
 *
 * @module lib/contacts/legal-professional-credentials
 */

import {
  findActivePersona,
  isLawyerPersona,
  isNotaryPersona,
  type PersonaData,
} from '@/types/contacts/personas';
import type { LawyerSnapshotData, LegalProfessionalRole, NotarySnapshotData } from '@/types/legal-contracts';

/** Τα στοιχεία μητρώου του ρόλου από τις **ενεργές** persona της επαφής — `null` όπου δεν υπάρχουν. */
export function legalRoleRegistryData(
  role: LegalProfessionalRole,
  personas: readonly PersonaData[],
): LawyerSnapshotData | NotarySnapshotData {
  const list = [...personas];
  if (role === 'notary') {
    const notary = findActivePersona(list, 'notary');
    const persona = notary && isNotaryPersona(notary) ? notary : null;
    return { type: 'notary', notaryRegistryNumber: persona?.notaryRegistryNumber ?? null, notaryDistrict: persona?.notaryDistrict ?? null };
  }
  const lawyer = findActivePersona(list, 'lawyer');
  const persona = lawyer && isLawyerPersona(lawyer) ? lawyer : null;
  return { type: 'lawyer', barAssociationNumber: persona?.barAssociationNumber ?? null, barAssociation: persona?.barAssociation ?? null };
}

/** Αριθμός + σύλλογος/περιφέρεια, ανεξάρτητα από τον ρόλο — η μορφή της προσυμπλήρωσης. */
export function legalRoleCredentialHint(
  role: LegalProfessionalRole,
  personas: readonly PersonaData[],
): { readonly number: string | null; readonly chapter: string | null } {
  const data = legalRoleRegistryData(role, personas);
  return data.type === 'notary'
    ? { number: data.notaryRegistryNumber, chapter: data.notaryDistrict }
    : { number: data.barAssociationNumber, chapter: data.barAssociation };
}
