/**
 * @fileoverview **Η ΜΙΑ έγχυση δυναμικών επιλογών** σε πίνακα φίλτρων (ADR-840 §7.6 · ADR-051).
 * @module components/core/AdvancedFilters/hooks/filter-option-injection
 *
 * Οι στατικοί πίνακες (`configs/*`) δηλώνουν **ποια** πεδία υπάρχουν· οι επιλογές τους προκύπτουν
 * από τα **ίδια τα δεδομένα** της οθόνης. Μέχρι 2026-10-19 ο βρόχος έγχυσης ζούσε σε δύο αντίγραφα
 * (ακίνητα · έργα) και τα κτίρια δεν τον είχαν καθόλου ⇒ έδειχναν ψεύτικα δείγματα
 * (`project1/2/3`, «Αθήνα/Πάτρα…») που δεν ταίριαζαν ποτέ με κανένα κτίριο.
 */

import type { FilterOption, FilterPanelConfig } from '../types';

/** `[όλα] + οι πραγματικές τιμές` — η σειρά που περιμένει κάθε select του πίνακα. */
export function withAllOption(allLabel: string, options: readonly FilterOption[]): FilterOption[] {
  return [{ value: 'all', label: allLabel }, ...options];
}

/**
 * Ταυτότητες → επιλογές με όνομα. Τα επιλυμένα αλφαβητικά (ελληνική σύγκριση)· όσα δεν έχουν όνομα
 * ακόμη, στο τέλος, με ουδέτερη ετικέτα (κλειδί i18n) — ποτέ η ωμή ταυτότητα στον άνθρωπο.
 */
export function namedOptions(
  ids: readonly string[],
  nameOf: (id: string) => string | null,
  unknownLabel: string,
): FilterOption[] {
  const named: FilterOption[] = [];
  const unnamed: FilterOption[] = [];
  for (const id of ids) {
    const name = nameOf(id);
    if (name === null) unnamed.push({ value: id, label: unknownLabel });
    else named.push({ value: id, label: name, verbatim: true });
  }
  named.sort((a, b) => a.label.localeCompare(b.label, 'el', { numeric: true }));
  return [...named, ...unnamed];
}

/** Ελεύθερες τιμές δεδομένων (π.χ. πόλεις) → μοναδικές, χωρίς κενά, ταξινομημένες, αυτούσιες. */
export function verbatimOptions(values: readonly (string | null | undefined)[]): FilterOption[] {
  const distinct = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) distinct.add(trimmed);
  }
  return Array.from(distinct)
    .sort((a, b) => a.localeCompare(b, 'el', { numeric: true }))
    .map(value => ({ value, label: value, verbatim: true }));
}

/**
 * Βαθύ αντίγραφο του πίνακα με τις επιλογές αντικατεστημένες **κατά όνομα πεδίου**, σε όποια σειρά
 * κι αν ζει. Ο πίνακας είναι κοινή σταθερά — η έγχυση δεν επιτρέπεται να τη μεταλλάξει.
 */
export function injectFilterOptions(
  baseConfig: FilterPanelConfig,
  optionsByField: ReadonlyMap<string, FilterOption[]>,
): FilterPanelConfig {
  const config = JSON.parse(JSON.stringify(baseConfig)) as FilterPanelConfig;
  for (const row of config.rows) {
    for (const field of row.fields) {
      const options = optionsByField.get(field.id);
      if (options) field.options = options;
    }
  }
  return config;
}
