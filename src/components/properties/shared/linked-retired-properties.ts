/**
 * Αποσυρμένα ακίνητα που **τα αναφέρει ήδη** κάτι — πώς φαίνονται σε επιλογέα (ADR-329 §3.9)
 *
 * Ένας επιλογέας δεν προσφέρει ό,τι έχει αποσυρθεί (κάδος · αρχείο). Όμως μια επιμέτρηση που
 * **ήδη** δείχνει σε αρχειοθετημένο ακίνητο οφείλει να το δείχνει με το όνομά του — αλλιώς το
 * πεδίο φαίνεται άδειο και η κατανομή κόστους χάνει σιωπηλά το μερίδιό του.
 *
 * Καθαρές συναρτήσεις: ο γάντζος `usePropertiesByBuilding` φέρνει τα πάντα
 * (`includeRetired`), και εδώ αποφασίζεται **τι από αυτά βλέπει ο άνθρωπος**.
 *
 * @module components/properties/shared/linked-retired-properties
 * @enterprise ADR-281 · ADR-329 §3.9
 */

import {
  isArchived,
  isRetired,
  isTrashed,
  type MaybeTrashed,
} from '@/lib/firestore/trashed-status';
import type { Property } from '@/types/property';

/** Γιατί ένα ακίνητο δεν προσφέρεται πια — `null` για ζωντανό. */
export type RetiredKind = 'archived' | 'trashed';

export function retiredKindOf(property: MaybeTrashed): RetiredKind | null {
  if (isArchived(property)) return 'archived';
  if (isTrashed(property)) return 'trashed';
  return null;
}

/**
 * Τα ακίνητα που προσφέρονται για **νέα** επιλογή.
 *
 * Γενικό στο σχήμα της γραμμής: ο επιλογέας μεσιτείας κρατά μόνο `{ id, name, status }`,
 * και η ερώτηση είναι η ίδια.
 */
export function liveProperties<T extends MaybeTrashed>(all: readonly T[]): T[] {
  return all.filter((property) => !isRetired(property));
}

/** Τα αποσυρμένα που **είναι ήδη συνδεδεμένα** — φαίνονται, δεν ξαναεπιλέγονται. */
export function linkedRetiredProperties<T extends MaybeTrashed & { readonly id: string }>(
  all: readonly T[],
  linkedIds: readonly string[],
): T[] {
  if (linkedIds.length === 0) return [];
  const linked = new Set(linkedIds);
  return all.filter((property) => isRetired(property) && linked.has(property.id));
}

/** Η σύντομη ετικέτα (chip · γραμμή κατανομής): κωδικός ή όνομα, με το επίθεμα απόσυρσης. */
export function propertyShortLabel(property: Pick<Property, 'code' | 'name'>, badge: string): string {
  const label = property.code ?? property.name;
  return badge ? `${label} ${badge}` : label;
}

/** Η ετικέτα ενός ακινήτου σε επιλογέα: «κωδικός — όνομα», ή σκέτο όνομα. */
export function propertyOptionLabel(property: Pick<Property, 'code' | 'name'>): string {
  return property.code ? `${property.code} — ${property.name}` : property.name;
}
