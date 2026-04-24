/**
 * Procurement Unit of Measure — Predefined List
 *
 * 14 standard units + "Άλλο" (custom entry).
 * Strict dropdown for consistency — aggregation/reports
 * break if "τεμ" vs "τεμάχια" vs "TEM".
 *
 * @module config/procurement-units
 * @see ADR-267 §8 (Unit of Measure)
 */

export interface ProcurementUnit {
  readonly value: string;
  readonly label: { readonly el: string; readonly en: string };
}

/** Predefined unit options (Procore/SAP pattern) */
export const PROCUREMENT_UNIT_OPTIONS: readonly ProcurementUnit[] = [
  { value: 'τεμ',  label: { el: 'Τεμάχιο', en: 'Piece' } },
  { value: 'm',    label: { el: 'Μέτρο', en: 'Meter' } },
  { value: 'm²',   label: { el: 'Τετραγωνικό μέτρο', en: 'Square meter' } },
  { value: 'm³',   label: { el: 'Κυβικό μέτρο', en: 'Cubic meter' } },
  { value: 'kg',   label: { el: 'Κιλό', en: 'Kilogram' } },
  { value: 'ton',  label: { el: 'Τόνος', en: 'Ton' } },
  { value: 'lt',   label: { el: 'Λίτρο', en: 'Liter' } },
  { value: 'σακ',  label: { el: 'Σακί', en: 'Bag' } },
  { value: 'κουτ', label: { el: 'Κουτί', en: 'Box' } },
  { value: 'παλ',  label: { el: 'Παλέτα', en: 'Pallet' } },
  { value: 'ρολ',  label: { el: 'Ρολό', en: 'Roll' } },
  { value: 'ζεύγ', label: { el: 'Ζεύγος', en: 'Pair' } },
  { value: 'δοχ',  label: { el: 'Δοχείο', en: 'Container' } },
  { value: 'σετ',  label: { el: 'Σετ', en: 'Set' } },
] as const;

