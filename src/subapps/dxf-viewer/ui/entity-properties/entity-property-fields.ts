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

/**
 * Control renderer για ένα πεδίο του Properties panel.
 *
 * Το `readout-action` (ADR-736 §6) είναι το `readout` **συν** ένα κουμπί ενέργειας στη γραμμή:
 * η τιμή μένει read-only, αλλά ο χρήστης μπορεί να την **αντικαταστήσει** μέσω διαλόγου. Είναι
 * το ιδίωμα κάθε object inspector για μια σύνδεση προς αρχείο — InDesign *Relink*, Figma
 * *Replace image*, AutoCAD External References *Change Path*, Revit *Manage Images*: η διαδρομή
 * δεν πληκτρολογείται, **δείχνεται** και αλλάζει με επιλογή αρχείου.
 */
export type EntityPropertyControl =
  | 'select' | 'color' | 'numeric' | 'toggle' | 'readout' | 'rename' | 'readout-action';

/** Ένα πεδίο ιδιότητας οντότητας (descriptor). */
export interface EntityPropertyField {
  readonly commandKey: string;
  readonly labelKey: string;
  readonly control: EntityPropertyControl;
  /** Στατικές επιλογές όταν το bridge δεν τις τροφοδοτεί live (π.χ. lineweight, presets). */
  readonly options: readonly BimPropertyOption[];
  /** Numeric constraints (μόνο `control:'numeric'`). */
  readonly numericInput?: RibbonNumericInputConfig;
  /**
   * Κλειδί i18n για το προσβάσιμο όνομα του κουμπιού ενέργειας (μόνο `control:'readout-action'`).
   * Ξεχωριστό από το `labelKey`: εκείνο ονομάζει το **πεδίο** («Πηγή»), αυτό την **πράξη**
   * («Αντικατάσταση εικόνας») — ένα κουμπί που διαβάζεται «Πηγή» δεν λέει τι κάνει.
   */
  readonly actionLabelKey?: string;
}

/** Λογικό group (= section) μέσα στο panel· gated μέσω `getPanelVisibility` όταν οριστεί. */
export interface EntityPropertyGroup {
  readonly id: string;
  readonly titleKey: string;
  readonly visibilityKey?: string;
  readonly fields: readonly EntityPropertyField[];
}
