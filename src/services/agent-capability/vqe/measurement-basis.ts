/**
 * Measurement Basis — «με ποιον κανόνα μετρήθηκε;»
 *
 * Παράγεται **αποκλειστικά από τα ίδια τα items**, ποτέ από δήλωση του
 * καλούντος (εξαίρεση: ο κωδικός ICMS 3, που δεν προκύπτει από τα δεδομένα).
 * Είναι σκόπιμο: μια βάση μέτρησης που ο καλών *δηλώνει* μπορεί να είναι λάθος·
 * μια βάση που *παράγεται* δεν μπορεί.
 *
 * Πεδίο που δεν είναι ενιαίο σε όλο το σύνολο επιστρέφεται `null` + προειδοποίηση.
 * Το εναλλακτικό — να διαλέξουμε την τιμή του πρώτου item — θα ήταν σιωπηλό
 * ψέμα ακριβώς εκεί που ο φάκελος υπάρχει για να μη λέγονται ψέματα.
 *
 * @module services/agent-capability/vqe/measurement-basis
 * @see ADR-734 §6.2 (MeasurementBasis)
 * @see ADR-329 (scope & cost allocation), ADR-175 §4.1.4 (waste factor)
 */

import type { BOQItem } from '@/types/boq';
import type { MeasurementBasis } from '@/types/vqe';
import { type Derived, envelopeIssue } from './derived';

/** Αποτέλεσμα ελέγχου ομοιομορφίας ενός πεδίου στο σύνολο. */
interface Uniformity<T> {
  /** Η κοινή τιμή, ή `null` όταν το σύνολο είναι κενό ή ετερογενές. */
  readonly value: T | null;
  /** True μόνο όταν υπάρχουν items αλλά διαφωνούν. */
  readonly nonUniform: boolean;
}

/** Η κοινή τιμή ενός πεδίου, αν υπάρχει. */
function uniformValue<T>(items: readonly BOQItem[], pick: (item: BOQItem) => T): Uniformity<T> {
  if (items.length === 0) return { value: null, nonUniform: false };
  const first = pick(items[0]);
  for (const item of items) {
    if (!Object.is(pick(item), first)) return { value: null, nonUniform: true };
  }
  return { value: first, nonUniform: false };
}

/**
 * Η βάση μέτρησης του συνόλου.
 *
 * @param items - Τα items που συνεισέφεραν στην τιμή
 * @param icmsCode - ICMS 3 κωδικός, όταν τον γνωρίζει ο καλών (Φάση 3)
 */
export function deriveMeasurementBasis(
  items: readonly BOQItem[],
  icmsCode: string | null,
): Derived<MeasurementBasis> {
  const category = uniformValue(items, (item) => item.categoryCode);
  const unit = uniformValue(items, (item) => item.unit);
  const scope = uniformValue(items, (item) => item.scope);
  const waste = uniformValue(items, (item) => item.wasteFactor);
  const allocation = uniformValue(items, (item) => item.costAllocationMethod);

  const checked: readonly (readonly [keyof MeasurementBasis, boolean])[] = [
    ['atoeCategoryCode', category.nonUniform],
    ['unit', unit.nonUniform],
    ['scope', scope.nonUniform],
    ['wasteFactorApplied', waste.nonUniform],
    ['costAllocationMethod', allocation.nonUniform],
  ];

  return {
    result: {
      atoeCategoryCode: category.value,
      unit: unit.value,
      scope: scope.value,
      wasteFactorApplied: waste.value,
      costAllocationMethod: allocation.value,
      icmsCode,
    },
    warnings: checked
      .filter(([, nonUniform]) => nonUniform)
      .map(([field]) => envelopeIssue('non_uniform_measurement_basis', { field })),
  };
}
