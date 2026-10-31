/**
 * **Το κλειδί ιδεμποτίας μιας έκδοσης** (ADR-923 §5.6): hash συνταγής + έκδοσης δεδομένων + έκδοσης τιμοκαταλόγου.
 * Ίδιες είσοδοι ⇒ **το ίδιο** αρχείο, χωρίς νέα απόδοση.
 *
 * 🔑 **Τι ΜΠΑΙΝΕΙ**: ό,τι αλλάζει τα bytes — ο ορισμός της συνταγής (ΟΧΙ η αναθεώρησή της: ένα σώσιμο χωρίς αλλαγή δεν
 *    αξίζει νέο PDF), οι αναθεωρήσεις κάθε δεδομένου στο εύρος, η ταυτότητα του κοινού, οι εκπτώσεις που ισχύουν, η έκδοση
 *    απόδοσης (πρότυπα · προσαρμογέας · μηχανή · αποδόσεις εικόνων).
 * 🔑 **Κανονική μορφή**: ταξινομημένα κλειδιά και ταξινομημένες λίστες, άρα η σειρά ανάγνωσης δεν αλλάζει το hash.
 * 🔒 Το κοινό **είναι** μέρος του κλειδιού: δύο κοινά δεν μοιράζονται ποτέ αρχείο, άρα ούτε τιμή (§12).
 * @module subapps/catalog/publishing/publication-input-hash
 */

import { createHash } from 'node:crypto';

import { canonicalJson } from '@/lib/legal/canonical-json';
import type { PublicationRecipeDefinition } from '../types/publication';

/** Μία έκδοση δεδομένου: `kind:id@revision`. */
export interface DataVersionRef {
  readonly key: string;
  readonly revision: number;
}

export interface PublicationInputs {
  readonly companyId: string;
  readonly recipe: PublicationRecipeDefinition;
  readonly data: readonly DataVersionRef[];
  readonly audienceKey: string;
  /** Το σφράγισμα της έκδοσης τιμών (`linesHash`) + οι αναθεωρήσεις των συνθηκών/αναθέσεων που την επηρεάζουν. */
  readonly pricing: readonly DataVersionRef[];
  readonly renderVersion: string;
}

const sorted = (refs: readonly DataVersionRef[]) => [...refs].map(({ key, revision }) => `${key}@${revision}`).sort();

export function publicationInputHash(inputs: PublicationInputs): string {
  const canonical = canonicalJson({ ...inputs, data: sorted(inputs.data), pricing: sorted(inputs.pricing) });
  return createHash('sha256').update(canonical).digest('hex');
}
