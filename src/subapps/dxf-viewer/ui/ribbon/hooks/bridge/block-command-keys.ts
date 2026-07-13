/**
 * ADR-641 (single-click selection surface) — command-key SSoT για τις ιδιότητες
 * ενός επιλεγμένου BLOCK (INSERT) στο αριστερό Properties palette.
 *
 * Mirror του `column-command-keys` / `line-tool-command-keys`: κάθε πεδίο του panel
 * αναφέρεται μέσω ενός σταθερού `commandKey` (κοινό identifier read/write). Καθαρά
 * data — zero React. Τα keys ζουν εδώ (ribbon/hooks/bridge) ώστε, αν αργότερα ένα
 * ribbon quick-panel χρειαστεί κάποιο από αυτά, να μοιράζεται τα ΙΔΙΑ tokens (SSoT).
 *
 * @see ../../../block-advanced-panel/block-property-fields.ts (descriptor consumer)
 * @see ../../../block-advanced-panel/useBlockPropertyBridge.ts (read/write bridge)
 */

/** Οι commandKeys των πεδίων ιδιοτήτων ενός block instance. */
export const BLOCK_PROPERTY_KEYS = {
  /** Όνομα block (DXF group 2) — read-only. */
  name: 'blockProps.name',
  /** Πλήθος περιεχόμενων αντικειμένων — read-only, derived (`entities.length`). */
  count: 'blockProps.count',
  /** Επίπεδο (layer) — select, live catalog. */
  layer: 'blockProps.layer',
  /** Χρώμα — dxf-color picker. */
  color: 'blockProps.color',
  /** Διαφάνεια (AutoCAD object transparency 0..90). */
  transparency: 'blockProps.transparency',
  /** Σημείο εισαγωγής X (display units). */
  posX: 'blockProps.posX',
  /** Σημείο εισαγωγής Y (display units). */
  posY: 'blockProps.posY',
  /** Κλίμακα X (ratio). */
  scaleX: 'blockProps.scaleX',
  /** Κλίμακα Y (ratio). */
  scaleY: 'blockProps.scaleY',
  /** Γωνία περιστροφής (μοίρες). */
  rotation: 'blockProps.rotation',
} as const;

export type BlockPropertyKey = (typeof BLOCK_PROPERTY_KEYS)[keyof typeof BLOCK_PROPERTY_KEYS];
