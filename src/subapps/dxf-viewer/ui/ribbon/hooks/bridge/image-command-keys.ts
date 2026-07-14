/**
 * ADR-654 — command-key SSoT για τις ιδιότητες ενός επιλεγμένου entourage `ImageEntity`
 * (έπιπλο/άνθρωπος/όχημα/φυτό — `type:'image'`) στο ΑΡΙΣΤΕΡΟ Properties palette.
 *
 * Mirror του `block-command-keys` / `column-command-keys`: κάθε πεδίο του panel αναφέρεται
 * μέσω ενός σταθερού `commandKey` (κοινό identifier read/write). Καθαρά data — zero React.
 * Τα keys ζουν εδώ (ribbon/hooks/bridge) ώστε, αν αργότερα ένα ribbon quick-panel χρειαστεί
 * κάποιο από αυτά, να μοιράζεται τα ΙΔΙΑ tokens (SSoT).
 *
 * @see ../../../image-advanced-panel/image-property-fields.ts (descriptor consumer)
 * @see ../../../image-advanced-panel/useImagePropertyBridge.ts (read/write bridge)
 */

/** Οι commandKeys των πεδίων ιδιοτήτων ενός image (entourage) instance. */
export const IMAGE_PROPERTY_KEYS = {
  /** Πηγή (filename από το `url`) — read-only. */
  source: 'imageProps.source',
  /** Επίπεδο (layer) — select, live catalog. */
  layer: 'imageProps.layer',
  /** Κάτω-αριστερή γωνία X (display units). */
  posX: 'imageProps.posX',
  /** Κάτω-αριστερή γωνία Y (display units). */
  posY: 'imageProps.posY',
  /** Πλάτος πλαισίου (display units). */
  width: 'imageProps.width',
  /** Ύψος πλαισίου (display units). */
  height: 'imageProps.height',
  /** Γωνία περιστροφής (μοίρες). */
  rotation: 'imageProps.rotation',
} as const;

export type ImagePropertyKey = (typeof IMAGE_PROPERTY_KEYS)[keyof typeof IMAGE_PROPERTY_KEYS];
