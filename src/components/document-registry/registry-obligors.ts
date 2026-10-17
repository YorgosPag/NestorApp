/**
 * @fileoverview **«Το φέρνει» — ΠΟΙΟΣ, συγκεκριμένα** (ADR-915 §25): από τη γραμμή και την απόκριση στους ανθρώπους
 *   που θα δείξει η οθόνη. Ένας κανόνας για γραμμή εγγράφου **και** κενού.
 * @related lib/document-validity/registry-owners.ts (ποιος είναι ιδιοκτήτης) · RegistryIssuerValue.tsx (η απόδοση)
 * @module components/document-registry/registry-obligors
 *
 * Τρεις απαντήσεις, ποτέ συγχωνευμένες:
 *  - `unknown` — δεν ρωτήθηκε ή η ανάγνωση απέτυχε ⇒ μόνο ο ρόλος, **χωρίς** ισχυρισμό·
 *  - `none`    — ρωτήθηκε, κανείς δεν ορίστηκε ⇒ «δεν έχει οριστεί» (ποτέ σιωπηλό κενό)·
 *  - `people`  — οι άνθρωποι, με σύνδεσμο **μόνο** όσοι είναι επαφές του μισθωτή (`people` — ξένη ≡ ανύπαρκτη).
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O.
 */

import {
  registryRowPartyOf,
  registryRowPropertyIdOf,
  type RegistryRow,
} from '@/lib/document-validity/document-registry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

/** Πόσοι ονομάζονται πάνω στη γραμμή· οι υπόλοιποι μετριούνται («+N ακόμη»). */
export const OBLIGOR_NAMES_SHOWN = 3;

export interface RegistryObligorPerson {
  readonly contactId: string;
  /** `null` = η επαφή υπάρχει αλλά δεν έχει όνομα. */
  readonly name: string | null;
  /** `false` = η επαφή δεν διαβάστηκε (διαγραμμένη · ξένη) — ούτε όνομα ούτε σύνδεσμος. */
  readonly reachable: boolean;
}

export type RegistryObligors =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'none' }
  | { readonly kind: 'people'; readonly shown: readonly RegistryObligorPerson[]; readonly more: number };

const UNKNOWN: RegistryObligors = { kind: 'unknown' };

type Names = Pick<DocumentRegistryResponse, 'properties' | 'people'>;

function peopleOf(contactIds: readonly string[], registry: Names): RegistryObligors {
  if (contactIds.length === 0) return { kind: 'none' };
  const people = contactIds.map((contactId): RegistryObligorPerson => {
    const label = registry.people[contactId];
    return { contactId, name: label?.name ?? null, reachable: label !== undefined };
  });
  return { kind: 'people', shown: people.slice(0, OBLIGOR_NAMES_SHOWN), more: Math.max(0, people.length - OBLIGOR_NAMES_SHOWN) };
}

/**
 * Οι άνθρωποι πίσω από το «Το φέρνει» μιας γραμμής. **Το πρόσωπο της γραμμής νικά** (5γ): η ενημερότητα του Α λέει «Α»,
 * ποτέ «Α, Β» — αλλιώς δύο γραμμές συμπωλητών θα έγραφαν τα ίδια ονόματα και η διάκριση θα χανόταν. Χωρίς πρόσωπο ⇒ οι
 * ιδιοκτήτες του ακινήτου. Πρόσωπο **χωρίς** επαφή (πωλητής που δεν ταυτοποιήθηκε) ⇒ «δεν έχει οριστεί».
 */
export function registryObligorsOf(row: RegistryRow, registry: Names): RegistryObligors {
  const party = registryRowPartyOf(row);
  if (party !== null) return peopleOf(party.contactId === null ? [] : [party.contactId], registry);
  const propertyId = registryRowPropertyIdOf(row);
  const owners = propertyId === null ? null : registry.properties[propertyId]?.ownerContactIds ?? null;
  return owners === null ? UNKNOWN : peopleOf(owners, registry);
}
