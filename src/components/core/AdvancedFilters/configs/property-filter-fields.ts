/**
 * @fileoverview **ΤΑ ΚΟΙΝΑ ΠΕΔΙΑ ΦΙΛΤΡΟΥ ΑΚΙΝΗΤΟΥ** — μία δήλωση ανά ερώτημα.
 * @related ADR-840 §5 (Α3) · N.18 (CHECK 3.28, jscpd)
 * @module components/core/AdvancedFilters/configs/property-filter-fields
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι δύο πίνακες φίλτρων ακινήτου (`propertyListFiltersConfig` · `propertyFiltersConfig`)
 * ρωτούν **τα ίδια πράγματα**: «ποιο έργο;», «ποιο κτίριο;», «ποιος όροφος;», «ποια
 * χαρακτηριστικά;». Όταν το ADR-840 Σ1 πρόσθεσε «έργο» και «κτίριο» στον δεύτερο, το
 * **CHECK 3.28** το έπιασε αμέσως: **24 γραμμές / 100 tokens** πανομοιότυπες — δίδυμο,
 * όχι κεντρικοποίηση.
 *
 * 🔑 **Η αντιγραφή δεν είναι αισθητικό θέμα εδώ.** Ήταν ήδη μετρήσιμα επιζήμια: τα δύο
 * αντίγραφα του καταλόγου χαρακτηριστικών **είχαν ήδη αποκλίνει** — ο ένας πίνακας
 * πρόσφερε «πισίνα», ο άλλος όχι, χωρίς κανείς να το αποφασίσει. Ο ενωμένος κατάλογος
 * παρακάτω είναι η **ένωση**, γιατί η απουσία ήταν παράλειψη και όχι κανόνας.
 *
 * ⚠️ **Τα αντικείμενα μοιράζονται με ΑΝΑΦΟΡΑ.** Κανείς δεν επιτρέπεται να τα μεταλλάξει
 * στη θέση τους: ο εγχυτής δυναμικών επιλογών (`usePropertyFiltersConfig`) δουλεύει
 * **πάνω σε βαθύ αντίγραφο** ακριβώς γι' αυτόν τον λόγο.
 */

import type { AdvancedFiltersConfig, FilterFieldConfig } from '../types';
import { AFO, FL, FT, PROPERTY_FILTER_LABELS, SP } from './shared';

/**
 * «Ποιο έργο;» — οι πραγματικές επιλογές έρχονται από τον εγχυτή· εδώ ζει μόνο η
 * ουδέτερη «όλα», ώστε ο πίνακας να είναι έγκυρος και χωρίς δεδομένα.
 */
export const PROJECT_FILTER_FIELD: FilterFieldConfig = {
  id: 'project',
  type: 'select',
  label: FL.project,
  placeholder: SP.project_placeholder,
  width: 1,
  ariaLabel: 'Project filter',
  options: [{ value: 'all', label: PROPERTY_FILTER_LABELS.ALL_PROJECTS }],
};

/** «Ποιο κτίριο;» */
export const BUILDING_FILTER_FIELD: FilterFieldConfig = {
  id: 'building',
  type: 'select',
  label: FL.building,
  placeholder: SP.building_placeholder,
  width: 1,
  ariaLabel: 'Building filter',
  options: [{ value: 'all', label: PROPERTY_FILTER_LABELS.ALL_BUILDINGS }],
};

/** «Ποιος όροφος;» — ⚠️ ο εγχυτής κρατά το **ισόγειο (0)**· δες `usePropertyFiltersConfig`. */
export const FLOOR_FILTER_FIELD: FilterFieldConfig = {
  id: 'floor',
  type: 'select',
  label: FL.floor,
  placeholder: SP.floor_placeholder,
  width: 1,
  ariaLabel: 'Floor filter',
  options: [{ value: 'all', label: PROPERTY_FILTER_LABELS.ALL_FLOORS }],
};

/**
 * «Ποιο είδος ακινήτου;» — **δύο ονόματα για το ίδιο ερώτημα** (ADR-840 §4).
 *
 * Το `propertyListFiltersConfig` το λέει `type`, το `FilterState` το λέει `propertyType`.
 * Η συγχώνευση των ονομάτων ανήκει στη σύγκλιση των Πωλήσεων (ADR-840 §8 #2)· μέχρι
 * τότε ο **ίδιος** ορισμός εξυπηρετεί και τα δύο, με το όνομα ως παράμετρο.
 */
export function propertyTypeFilterField(id: 'type' | 'propertyType'): FilterFieldConfig {
  return {
    id,
    type: 'select',
    label: FL.property_type,
    placeholder: SP.type_placeholder,
    width: 1,
    ariaLabel: 'Property type filter',
    options: [{ value: 'all', label: PROPERTY_FILTER_LABELS.ALL_TYPES }],
  };
}

/**
 * «Ποια χαρακτηριστικά;» — **η ένωση των δύο καταλόγων που είχαν αποκλίνει.**
 * Η «πισίνα» έλειπε από τον έναν χωρίς δηλωμένο λόγο· δες την επικεφαλίδα.
 */
export const PROPERTY_FEATURE_FILTERS: AdvancedFiltersConfig = {
  show: true,
  title: FT.advanced,
  options: [
    { id: 'parking', label: AFO.parking, category: 'features' },
    { id: 'storage', label: AFO.storage, category: 'features' },
    { id: 'fireplace', label: AFO.fireplace, category: 'features' },
    { id: 'view', label: AFO.view, category: 'features' },
    { id: 'pool', label: AFO.pool, category: 'features' },
  ],
  categories: ['features'],
};
