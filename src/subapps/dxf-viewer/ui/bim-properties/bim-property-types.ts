/**
 * ADR-471 — Generic BIM Properties-palette descriptor types (SSoT).
 *
 * Member-agnostic μοντέλο για τις γραμμές/groups του docked Properties panel
 * οποιουδήποτε δομικού στοιχείου (κολόνα/δοκάρι/…). Εξάχθηκε (boy-scout, N.0.2)
 * από το column-only `column-property-fields.ts` ώστε ΟΛΑ τα advanced panels να
 * μοιράζονται ΕΝΑ μοντέλο + ΕΝΑ `BimPropertyRow` renderer — μηδέν διπλότυπο.
 *
 * Καθαρά data types — zero React/DOM. Το `commandKey` είναι κοινό με το αντίστοιχο
 * bridge (read via resolver, write via apply), όπως στο ribbon.
 */

/** Combobox option για row του panel (συμβατό με `RibbonComboboxOption`). */
export interface BimPropertyOption {
  readonly value: string;
  readonly labelKey: string;
  /** `true` = το `labelKey` είναι κυριολεκτική ετικέτα (π.χ. «16»), όχι i18n key. */
  readonly isLiteralLabel?: boolean;
}

/** Ένα editable πεδίο ή read-only readout μέσα σε group. */
export interface BimPropertyField {
  /** Κοινό commandKey με το bridge (read via resolver, write via apply). */
  readonly commandKey: string;
  readonly labelKey: string;
  readonly tooltipKey?: string;
  readonly options: readonly BimPropertyOption[];
  /** `true` = readout (μη επεξεργάσιμο — bridge δίνει value, ΟΧΙ write). */
  readonly readOnly?: boolean;
}

/** Λογικό group (= section) μέσα στο panel. */
export interface BimPropertyGroup {
  readonly id: string;
  readonly titleKey: string;
  /** Αν οριστεί, gated μέσω του per-member visibility resolver (π.χ. structural=RC only). */
  readonly visibilityKey?: string;
  readonly fields: readonly BimPropertyField[];
}
