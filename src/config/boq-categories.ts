/**
 * BOQ Master Categories — ΑΤΟΕ (Αναλυτικό Τιμολόγιο Οικοδομικών Εργών)
 *
 * 12 κατηγορίες εργασιών σύμφωνα με τα ελληνικά πρότυπα.
 * Static data — χρησιμοποιείται ως fallback αν το Firestore boq_categories είναι κενό.
 *
 * @module config/boq-categories
 * @see ADR-175 §3.3 (ΑΤΟΕ Categories)
 */

import type { BOQMeasurementUnit, CategoryLevel } from '@/types/boq';

// ============================================================================
// MASTER CATEGORY DEFINITION
// ============================================================================

export interface MasterBOQCategory {
  /** Κωδικός (π.χ. 'OIK-1') */
  code: string;
  /** Ελληνική ονομασία */
  nameEL: string;
  /** Αγγλική ονομασία */
  nameEN: string;
  /** Περιγραφή */
  description: string;
  /** Επίπεδο ιεραρχίας */
  level: CategoryLevel;
  /** Σειρά εμφάνισης */
  sortOrder: number;
  /** Default φύρα (0.05 = 5%) */
  defaultWasteFactor: number;
  /** Επιτρεπόμενες μονάδες */
  allowedUnits: BOQMeasurementUnit[];
}

// ============================================================================
// 12 ΑΤΟΕ MASTER CATEGORIES
// ============================================================================

export const ATOE_MASTER_CATEGORIES: readonly MasterBOQCategory[] = [
  {
    code: 'OIK-1',
    nameEL: 'Χωματουργικά',
    nameEN: 'Earthworks',
    description: 'Εκσκαφές, επιχώσεις, μεταφορές',
    level: 'group',
    sortOrder: 1,
    defaultWasteFactor: 0.05,
    allowedUnits: ['m3', 'ton'],
  },
  {
    code: 'OIK-2',
    nameEL: 'Σκυροδέματα',
    nameEN: 'Concrete Works',
    description: 'Θεμέλια, πλάκες, κολώνες, δοκοί',
    level: 'group',
    sortOrder: 2,
    defaultWasteFactor: 0.05,
    allowedUnits: ['m3', 'm2', 'kg'],
  },
  {
    code: 'OIK-3',
    nameEL: 'Τοιχοποιίες',
    nameEN: 'Masonry',
    description: 'Τούβλα, μπλόκ, πέτρα',
    level: 'group',
    sortOrder: 3,
    defaultWasteFactor: 0.05,
    allowedUnits: ['m2', 'm3'],
  },
  {
    code: 'OIK-4',
    nameEL: 'Επιχρίσματα',
    nameEN: 'Plastering',
    description: 'Σοβάδες εσωτερικοί/εξωτερικοί, ειδικοί σοβάδες',
    level: 'group',
    sortOrder: 4,
    defaultWasteFactor: 0.05,
    allowedUnits: ['m2'],
  },
  {
    code: 'OIK-5',
    nameEL: 'Πατώματα / Δάπεδα',
    nameEN: 'Flooring',
    description: 'Πλακάκια, ξύλο, μάρμαρο, μωσαϊκό',
    level: 'group',
    sortOrder: 5,
    defaultWasteFactor: 0.08,
    allowedUnits: ['m2'],
  },
  {
    code: 'OIK-6',
    nameEL: 'Κουφώματα',
    nameEN: 'Doors & Windows',
    description: 'Πόρτες, παράθυρα, ρολά',
    level: 'group',
    sortOrder: 6,
    defaultWasteFactor: 0,
    allowedUnits: ['pcs', 'm2', 'set'],
  },
  {
    code: 'OIK-7',
    nameEL: 'Χρωματισμοί',
    nameEN: 'Painting',
    description: 'Βαφές εσωτερικές/εξωτερικές, βερνίκια',
    level: 'group',
    sortOrder: 7,
    defaultWasteFactor: 0.12,
    allowedUnits: ['m2', 'lt'],
  },
  {
    code: 'OIK-8',
    nameEL: 'Υδραυλικά',
    nameEN: 'Plumbing & HVAC',
    description: 'Σωληνώσεις, είδη υγιεινής, θέρμανση',
    level: 'group',
    sortOrder: 8,
    defaultWasteFactor: 0.05,
    allowedUnits: ['m', 'pcs', 'set'],
  },
  {
    code: 'OIK-9',
    nameEL: 'Ηλεκτρολογικά',
    nameEN: 'Electrical',
    description: 'Καλωδιώσεις, πίνακες, φωτισμός',
    level: 'group',
    sortOrder: 9,
    defaultWasteFactor: 0.05,
    allowedUnits: ['m', 'pcs', 'set'],
  },
  {
    code: 'OIK-10',
    nameEL: 'Μονώσεις',
    nameEN: 'Insulation',
    description: 'Θερμομόνωση, υγρομόνωση, ηχομόνωση',
    level: 'group',
    sortOrder: 10,
    defaultWasteFactor: 0.06,
    allowedUnits: ['m2', 'm3'],
  },
  {
    code: 'OIK-11',
    nameEL: 'Σοβατεπί / Ποδιές',
    nameEN: 'Baseboards & Sills',
    description: 'Σοβατεπί δαπέδων, ποδιές παραθύρων',
    level: 'group',
    sortOrder: 11,
    defaultWasteFactor: 0.05,
    allowedUnits: ['m', 'pcs'],
  },
  {
    code: 'OIK-12',
    nameEL: 'Μεταλλικά',
    nameEN: 'Metalwork',
    description: 'Κάγκελα, σκάλες, ειδικές μεταλλικές κατασκευές',
    level: 'group',
    sortOrder: 12,
    defaultWasteFactor: 0.07,
    allowedUnits: ['kg', 'm', 'm2', 'pcs'],
  },
] as const;

// ============================================================================
// LOOKUP HELPERS
// ============================================================================

/** Εύρεση κατηγορίας βάσει κωδικού */
export function findATOECategory(code: string): MasterBOQCategory | undefined {
  return ATOE_MASTER_CATEGORIES.find((cat) => cat.code === code);
}

/** Default waste factor βάσει κωδικού κατηγορίας */
export function getDefaultWasteFactor(categoryCode: string): number {
  return findATOECategory(categoryCode)?.defaultWasteFactor ?? 0;
}

/** Επιτρεπόμενες μονάδες βάσει κωδικού κατηγορίας */
export function getAllowedUnits(categoryCode: string): BOQMeasurementUnit[] {
  return findATOECategory(categoryCode)?.allowedUnits ?? ['m2', 'pcs', 'lump'];
}
