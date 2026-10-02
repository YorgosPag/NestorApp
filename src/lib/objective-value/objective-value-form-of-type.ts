/**
 * @fileoverview **Είδος αγγελίας → έντυπο της αντικειμενικής** (ADR-898 §7 · Φ3) — δεδομένα, χωρίς τη μηχανή.
 * @related `listing-objective-value.ts` (ο υπολογισμός) · `services/listings/public-listing-objective-value.ts` (η
 *   προβολή: η πρόσοψη ισχύει μόνο σε κατοικία)
 * @module lib/objective-value/objective-value-form-of-type
 *
 * ⚠️ **Χωριστό αρχείο, επίτηδες**: η προβολή της αγγελίας τρέχει και στον browser (δείκτης πληρότητας του ιδιώτη)·
 * αν ρωτούσε τον πίνακα από το `listing-objective-value.ts`, θα κουβαλούσε όλη τη μηχανή και τα όρια.
 */

import { normalizePropertyType } from '@/constants/property-type-aliases';
import type { PropertyTypeCanonical } from '@/constants/property-types';

import type { ObjectiveValueForm } from './objective-value-types';

/**
 * **Είδος αγγελίας → έντυπο** · `null` = εκτός εμβέλειας (ADR-898 §7): κατάστημα/γραφείο/αίθουσα = έντυπο 2,
 * οικόπεδο/αγροτεμάχιο = έντυπο 3. Θέση στάθμευσης δεν είναι είδος αγγελίας (παρακολούθημα, Φ4).
 */
export const OBJECTIVE_VALUE_FORM_OF_TYPE: Readonly<Record<PropertyTypeCanonical, ObjectiveValueForm | null>> = {
  studio: 'residence',
  apartment_1br: 'residence',
  apartment: 'residence',
  maisonette: 'residence',
  penthouse: 'residence',
  loft: 'residence',
  detached_house: 'residence',
  villa: 'residence',
  shop: null,
  office: null,
  hall: null,
  storage: 'storage',
  plot: null,
  parcel: null,
};

/**
 * **Το έντυπο ενός είδους, όπως κι αν είναι γραμμένο** — ωμό ή κανονικό (ADR-898 Φ3β-3). `null` = δεν αποτιμάται με τα
 * έντυπα 1/4 (ή άγνωστο είδος). Η ΜΙΑ ερώτηση «αποτιμάται;» — την κάνουν η προβολή, η αγγελία και οι οθόνες.
 */
export function objectiveValueFormOf(type: unknown): ObjectiveValueForm | null {
  const canonical = normalizePropertyType(type);
  return canonical === null ? null : OBJECTIVE_VALUE_FORM_OF_TYPE[canonical];
}
