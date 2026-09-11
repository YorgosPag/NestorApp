/**
 * @fileoverview **ΠΟΙΟ ΑΚΙΝΗΤΟ ΔΕΙΧΝΕΙ Η ΟΘΟΝΗ** — παράγεται, δεν συγχρονίζεται.
 * @related ADR-777 §8.30 · ADR-849 Β1 · hooks/usePropertiesViewerState
 * @module hooks/property-viewer-selection
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 * Η καρτέλα `/properties/[id]` έκρινε «βρέθηκε;» από την **επιλογή**, που έμπαινε σε
 * `useEffect` **μετά** την απάντηση του καταλόγου. Άρα υπήρχε καρέ με «ο κατάλογος
 * απάντησε» **και** «καμία επιλογή» ⇒ «Το ακίνητο δεν βρέθηκε» για ακίνητο που
 * υπάρχει — το ίδιο μήνυμα που είδε ο άνθρωπος από το email του ADR-849.
 *
 * 🔑 Κανόνας του React (react.dev, *You Might Not Need an Effect*): *«If you can calculate
 * something during render, you don't need an Effect»*. Το ακίνητο της διαδρομής
 * **υπολογίζεται** από το id και τον κατάλογο, στο **ίδιο** καρέ.
 *
 * ⚠️ **Η διαδρομή νικά την επιλογή.** Όταν ο καλών ξέρει id (η σελίδα της οντότητας),
 * ένα κλικ σε άλλο πολύγωνο της κάτοψης **δεν** αλλάζει θέμα σε σελίδα που η διεύθυνσή
 * της λέει άλλο ακίνητο. Χωρίς id (η λίστα), μετρά η επιλογή — όπως πάντα.
 */

import type { Property } from '@/types/property-viewer';

export interface ViewedPropertyInput {
  readonly properties: readonly Property[];
  /** Το id της **διαδρομής** — `string` μόνο όταν ο καλών το ξέρει. */
  readonly explicitPropertyId: string | null | undefined;
  readonly selectedPropertyIds: readonly string[];
  /** Όλες οι επαφές — για τον εμπλουτισμό `buyerMismatch`. Κενό ⇒ χωρίς εμπλουτισμό. */
  readonly contactIds: readonly string[];
}

/** Το ακίνητο που δείχνει η οθόνη — ή `null`. Καθαρή συνάρτηση, χωρίς React. */
export function resolveViewedProperty(input: ViewedPropertyInput): Property | null {
  const targetId =
    typeof input.explicitPropertyId === 'string'
      ? input.explicitPropertyId
      : input.selectedPropertyIds.length === 1
        ? input.selectedPropertyIds[0]
        : null;
  if (targetId === null) return null;

  const property = input.properties.find((item) => item.id === targetId);
  if (!property) return null;

  if (property.soldTo && input.contactIds.length > 0) {
    return { ...property, buyerMismatch: !input.contactIds.includes(property.soldTo) };
  }
  return property;
}
