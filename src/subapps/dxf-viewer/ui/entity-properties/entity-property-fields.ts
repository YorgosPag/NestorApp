/**
 * ADR-507 / ADR-510 — generic descriptor SSoT για τα per-object πεδία ΟΠΟΙΑΣΔΗΠΟΤΕ
 * οντότητας στο ΑΡΙΣΤΕΡΟ Properties palette (γραμμή / γραμμοσκίαση / …).
 *
 * Γενικεύει το πρώην line-only `line-property-fields.ts` ώστε ΟΛΑ τα style panels να
 * μοιράζονται ΕΝΑ μοντέλο + ΕΝΑ `EntityPropertyRow` renderer (SSoT, μηδέν διπλότυπο).
 * Πέρα από τα line controls (select/color/numeric) προσθέτει **toggle** (Σταυρωτή /
 * Πίσω πλάνο / Μονόχρωμη) + **readout** (Εμβαδόν) που χρειάζεται η γραμμοσκίαση.
 *
 * Read/write γίνεται από το ΙΔΙΟ per-entity bridge (get/onComboboxChange + get/onToggle)
 * — εδώ ΜΟΝΟ η δομή/κατανομή. Καθαρά data types — zero React/DOM.
 */

import type { BimPropertyOption } from '../bim-properties/bim-property-types';
import type { RibbonNumericInputConfig } from '../ribbon/types/ribbon-types';

/** Control renderer για ένα πεδίο του Properties panel. */
export type EntityPropertyControl = 'select' | 'color' | 'numeric' | 'toggle' | 'readout';

/** Ένα πεδίο ιδιότητας οντότητας (descriptor). */
export interface EntityPropertyField {
  readonly commandKey: string;
  readonly labelKey: string;
  readonly control: EntityPropertyControl;
  /** Στατικές επιλογές όταν το bridge δεν τις τροφοδοτεί live (π.χ. lineweight, presets). */
  readonly options: readonly BimPropertyOption[];
  /** Numeric constraints (μόνο `control:'numeric'`). */
  readonly numericInput?: RibbonNumericInputConfig;
}

/** Λογικό group (= section) μέσα στο panel· gated μέσω `getPanelVisibility` όταν οριστεί. */
export interface EntityPropertyGroup {
  readonly id: string;
  readonly titleKey: string;
  readonly visibilityKey?: string;
  readonly fields: readonly EntityPropertyField[];
}
