/**
 * @fileoverview **Πώς φαίνονται οι φάκελοι** — καθαρές αποφάσεις παρουσίασης, μία φορά.
 * @related ADR-866 Φ1.2 · §2.9.6 · §2.9.8 (Δ2) · §2.7.1 (οικόπεδο) · constants/property-types.ts
 * @module lib/property-dossier/property-dossier-view
 *
 * 🔑 **Γιατί εδώ και όχι μέσα στα components**: η λίστα, το φίλτρο και η κεφαλίδα της λεπτομέρειας ρωτούν τα
 * **ίδια** δύο πράγματα — *«ποιοι είναι ενεργοί/αρχειοθετημένοι, με ποια σειρά;»* και *«πώς λέγεται η κάτοψη
 * **αυτού** του ακινήτου;»*. Γραμμένα μέσα σε JSX θα γίνονταν δύο απαντήσεις (ADR-749), και δεν θα δοκιμάζονταν.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία εξάρτηση από React ή Firestore.
 */

import { PROPERTY_TYPE_CLASS } from '@/constants/property-types';
import type { PropertyDossier, PropertyDossierLifecycle } from '@/types/property-dossier';

/** Οι φάκελοι, χωρισμένοι κατά **κύκλο ζωής** — η απάντηση του φίλτρου «Ενεργοί · Αρχειοθετημένοι» (Ε-Φ1.2-2). */
export type PartitionedDossiers = Readonly<Record<PropertyDossierLifecycle, readonly PropertyDossier[]>>;

/**
 * **Πιο πρόσφατη αλλαγή πρώτα** (Drive «Last modified»): ο φάκελος που μόλις άγγιξες είναι αυτός που ψάχνεις.
 *
 * ⚠️ Τα `updatedAt` είναι ISO-8601 του **ίδιου** ρολογιού (`nowISO`) ⇒ η λεξικογραφική σύγκριση **είναι** χρονική.
 * Ισοπαλία ⇒ κατά ταυτότητα, ώστε η σειρά να μην «χορεύει» ανάμεσα σε δύο στιγμιότυπα της ζωντανής λίστας.
 */
function byMostRecent(a: PropertyDossier, b: PropertyDossier): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? 1 : -1;
  return a.id < b.id ? -1 : 1;
}

/** Χωρίζει **και** ταξινομεί. Κάθε κύκλος ζωής έχει κλειδί — και ο άδειος (ώστε η οθόνη να μετρά `0`, όχι `undefined`). */
export function partitionDossiers(dossiers: readonly PropertyDossier[]): PartitionedDossiers {
  const sorted = [...dossiers].sort(byMostRecent);
  return {
    active: sorted.filter((dossier) => dossier.lifecycle === 'active'),
    archived: sorted.filter((dossier) => dossier.lifecycle === 'archived'),
  };
}

/**
 * **Πώς λέγεται η «κάτοψη» αυτού του ακινήτου** — σε **γη** δεν υπάρχει κάτοψη, υπάρχει **τοπογραφικό** (§2.7.1).
 *
 * 🔑 Η ίδια κατηγορία αρχείων (`floorplans`) — αλλάζει **μόνο** η λέξη που βλέπει ο άνθρωπος. Η κλάση έρχεται από
 * το **ένα** `PROPERTY_TYPE_CLASS` (όχι δεύτερη λίστα «οικοπέδων»)· άγνωστο είδος ⇒ «κάτοψη» (η συνήθης περίπτωση).
 */
export function floorplanTabKind(type: PropertyDossier['type']): 'floorplan' | 'topographic' {
  return type !== null && PROPERTY_TYPE_CLASS[type] === 'land' ? 'topographic' : 'floorplan';
}
