/**
 * Property tab constants — SSOT for labels and option arrays.
 *
 * Label values are i18n translation KEYS (not raw text).
 * Consumers resolve them via t(key), e.g. t(UNIT_TYPE_LABEL_KEYS[type]).
 *
 * Used by: PropertiesTabContent, PropertyInlineCreateForm
 * @module components/building-management/tabs/property-tab-constants
 */

import type { TFunction } from 'i18next';
import type { PropertyType, CommercialStatus } from '@/types/property';
import { isLandProperty } from '@/constants/property-classification';
import { PROPERTY_TYPES, PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { COMMERCIAL_STATUSES, normalizeCommercialStatus } from '@/constants/commercial-statuses';
import { UNIT_STATUS_NAMESPACE, commercialStatusLabelKey } from '@/lib/units/unit-status-badges';

// ============================================================================
// TYPE LABELS & OPTIONS (i18n keys — resolve with t())
// ============================================================================

/**
 * Maps unit type value → i18n key in "properties" namespace.
 * ADR-145: Derived από canonical SSoT — αυτόματα complete με όλους τους 14 τύπους.
 */
export const UNIT_TYPE_LABEL_KEYS: Record<string, string> = { ...PROPERTY_TYPE_I18N_KEYS };

/**
 * Τα είδη μονάδας για το φίλτρο της καρτέλας «Ακίνητα» **ενός κτιρίου**.
 * ADR-145: Derived από canonical SSoT — fixes previous missing penthouse/loft/
 * villa/detached_house/hall (ADR-233 additions που δεν είχαν propagate εδώ).
 *
 * 🔴 **Η ΓΗ ΕΞΑΙΡΕΙΤΑΙ** (ADR-777 §8.32): αυτό το φίλτρο ρωτά *«τι υπάρχει **μέσα σε
 * αυτό το κτίριο**;»*, και ένα κτίριο δεν περιέχει οικόπεδα — η σχέση είναι
 * **αντίστροφη** (το `PublicBuilding` κληρονομεί τη θέση του **από** τη γη). Χωρίς
 * αυτή τη γραμμή, το dropdown θα πρόσφερε δύο επιλογές που **δεν μπορούν ποτέ** να
 * δώσουν αποτέλεσμα — φίλτρο χωρίς απόδειξη ζωής (ADR-749 §5).
 *
 * ⚠️ **ΔΕΝ χρησιμοποιείται το `CREATABLE_PROPERTY_TYPES`**, παρότι μοιάζει συγγενικό:
 * εκείνο εξαιρεί **και** την `storage`, γιατί οι αποθήκες δημιουργούνται από δική
 * τους σελίδα — αλλά **υπάρχουν** μέσα σε κτίριο, άρα το φίλτρο τις χρειάζεται.
 * Δύο διαφορετικές ερωτήσεις με διαφορετική απάντηση.
 */
export const UNIT_TYPES_FOR_FILTER: PropertyType[] = PROPERTY_TYPES.filter(
  (type) => !isLandProperty(type),
);

// ============================================================================
// STATUS LABELS & OPTIONS (i18n keys — resolve with t())
// ============================================================================

/**
 * Οι διαθέσεις του φίλτρου «Κατάσταση» — **όλες** οι κανονικές (`COMMERCIAL_STATUSES`), ποτέ
 * χειρόγραφη λίστα. Ως τις 2026-10-19 ήταν τοπική: περιείχε το φάντασμα `under-negotiation`
 * (ούτε κατάσταση ούτε ψευδώνυμο — ο γραφέας το έκανε σιωπηλά `unavailable`) και **έλειπε**
 * το `for-sale-and-rent`.
 */
export const UNIT_STATUSES_FOR_FILTER: readonly CommercialStatus[] = COMMERCIAL_STATUSES;

// ============================================================================
// HELPERS
// ============================================================================

/** Resolve a unit type to its translated label */
export function getPropertyTypeLabel(type: string, t: TFunction): string {
  const key = UNIT_TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
}

/**
 * Η μεταφρασμένη ετικέτα μιας διάθεσης — από το SSoT των σημάτων (`commercialStatusLabelKey`,
 * namespace `properties-enums`). Άγνωστη τιμή ⇒ η ίδια η τιμή (ορατή, όχι κενή).
 */
export function getPropertyStatusLabel(status: string | null, t: TFunction): string {
  const canonical = normalizeCommercialStatus(status);
  if (!canonical) return status ?? '';
  return t(commercialStatusLabelKey(canonical), { ns: UNIT_STATUS_NAMESPACE });
}

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface FloorRecord {
  id: string;
  number: number;
  name: string;
}
