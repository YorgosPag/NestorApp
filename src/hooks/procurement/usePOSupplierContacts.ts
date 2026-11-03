'use client';

/**
 * usePOSupplierContacts — Lightweight supplier contacts hook for PO form
 *
 * Thin consumer of `usePersonaContacts(['supplier'])` (ADR-928 Φ3γ: the same live read now serves the subcontractor
 * picker). Active contacts only, ADR-300 stale-while-revalidate cache (same cache key as before).
 *
 * @module hooks/procurement/usePOSupplierContacts
 * @see ADR-267 §Phase D — Entity Selectors
 * @see ADR-300 — Stale-while-revalidate
 * @see ADR-214 — Contact Query Service
 */

import type { Contact } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';
import { getContactDisplayName } from '@/types/contacts/helpers';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { usePersonaContacts } from './usePersonaContacts';

const SUPPLIER: readonly PersonaType[] = ['supplier'];

interface UsePOSupplierContactsReturn {
  suppliers: Contact[];
  loading: boolean;
  error: string | null;
}

export function usePOSupplierContacts(): UsePOSupplierContactsReturn {
  const { contacts, loading, error } = usePersonaContacts(SUPPLIER);
  return { suppliers: contacts, loading, error };
}

/**
 * Προμηθευτές → επιλογές combobox — **μία** αντιστοίχιση για κάθε επιλογέα προμηθευτή
 * (παραγγελία, συμφωνία-πλαίσιο, προτιμώμενοι προμηθευτές υλικού). Ήταν γραμμένη τρεις
 * φορές· το CHECK 3.28 τις είδε όταν άλλαξαν μαζί (2026-09-21).
 * `exclude`: ταυτότητες που **δεν** προσφέρονται (π.χ. ήδη επιλεγμένες).
 */
export function supplierContactsToOptions(
  suppliers: readonly Contact[],
  exclude: readonly string[] = [],
): ComboboxOption[] {
  return suppliers
    .filter((c): c is Contact & { id: string } => typeof c.id === 'string' && !exclude.includes(c.id))
    .map((c) => ({
      value: c.id,
      label: getContactDisplayName(c),
      secondaryLabel: c.type === 'company' ? c.companyName ?? undefined : undefined,
    }));
}

/**
 * Προμηθευτές → `ταυτότητα → όνομα προβολής`, με την ίδια ονομασία με τις επιλογές. Ήταν γραμμένο
 * δύο φορές (σελίδα συμβάσεων · φόρμα υλικού)· το CHECK 3.28 το είδε (ADR-923 §5.11 «3γ», Βήμα 2).
 */
export function supplierNamesById(suppliers: readonly Contact[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const contact of suppliers) {
    if (contact.id) names.set(contact.id, getContactDisplayName(contact));
  }
  return names;
}
