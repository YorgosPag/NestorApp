/**
 * ADR-353 — Combobox option sets for the contextual Array ribbon tabs.
 *
 * Extracted from `contextual-array-tab.ts` (ADR-353 M2) to keep that file
 * under the 500-line Google standard (N.7.1). Pure data, no logic — the tab
 * declaration imports these and wires them to command keys.
 *
 * `isLiteralLabel: true` → the label is shown verbatim (numbers / degrees /
 * enum names), NOT resolved through i18n. Mirrors the pre-existing pattern.
 */

export const COUNT_OPTIONS = [
  { value: '1', labelKey: '1', isLiteralLabel: true },
  { value: '2', labelKey: '2', isLiteralLabel: true },
  { value: '3', labelKey: '3', isLiteralLabel: true },
  { value: '4', labelKey: '4', isLiteralLabel: true },
  { value: '5', labelKey: '5', isLiteralLabel: true },
  { value: '6', labelKey: '6', isLiteralLabel: true },
  { value: '8', labelKey: '8', isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '12', labelKey: '12', isLiteralLabel: true },
  { value: '20', labelKey: '20', isLiteralLabel: true },
] as const;

export const ANGLE_OPTIONS = [
  { value: '0', labelKey: '0°', isLiteralLabel: true },
  { value: '15', labelKey: '15°', isLiteralLabel: true },
  { value: '30', labelKey: '30°', isLiteralLabel: true },
  { value: '45', labelKey: '45°', isLiteralLabel: true },
  { value: '60', labelKey: '60°', isLiteralLabel: true },
  { value: '90', labelKey: '90°', isLiteralLabel: true },
] as const;

export const SPACING_OPTIONS = [
  { value: '5', labelKey: '5', isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
] as const;

export const FILL_ANGLE_OPTIONS = [
  { value: '360', labelKey: '360°', isLiteralLabel: true },
  { value: '270', labelKey: '270°', isLiteralLabel: true },
  { value: '180', labelKey: '180°', isLiteralLabel: true },
  { value: '90', labelKey: '90°', isLiteralLabel: true },
  { value: '-90', labelKey: '-90°', isLiteralLabel: true },
  { value: '-180', labelKey: '-180°', isLiteralLabel: true },
  { value: '-360', labelKey: '-360°', isLiteralLabel: true },
] as const;

export const START_ANGLE_OPTIONS = [
  { value: '0', labelKey: '0°', isLiteralLabel: true },
  { value: '45', labelKey: '45°', isLiteralLabel: true },
  { value: '90', labelKey: '90°', isLiteralLabel: true },
  { value: '180', labelKey: '180°', isLiteralLabel: true },
  { value: '270', labelKey: '270°', isLiteralLabel: true },
] as const;

export const RADIUS_OPTIONS = [
  { value: '0', labelKey: 'auto', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
  { value: '250', labelKey: '250', isLiteralLabel: true },
  { value: '500', labelKey: '500', isLiteralLabel: true },
  { value: '1000', labelKey: '1000', isLiteralLabel: true },
] as const;

export const METHOD_OPTIONS = [
  { value: 'divide', labelKey: 'Divide', isLiteralLabel: true },
  { value: 'measure', labelKey: 'Measure', isLiteralLabel: true },
] as const;

// ── ADR-353 M2 — "magical" scatter / align / distribution controls ─────────────

/** Constant angle added on top of the tangent (AutoCAD "Base angle"). ± allowed. */
export const ALIGN_OFFSET_OPTIONS = [
  { value: '0', labelKey: '0°', isLiteralLabel: true },
  { value: '45', labelKey: '45°', isLiteralLabel: true },
  { value: '90', labelKey: '90°', isLiteralLabel: true },
  { value: '-90', labelKey: '-90°', isLiteralLabel: true },
  { value: '180', labelKey: '180°', isLiteralLabel: true },
] as const;

/** Seeded ± rotation jitter per item, in degrees. 0 = off. */
export const ROTATION_JITTER_OPTIONS = [
  { value: '0', labelKey: '0°', isLiteralLabel: true },
  { value: '5', labelKey: '5°', isLiteralLabel: true },
  { value: '10', labelKey: '10°', isLiteralLabel: true },
  { value: '15', labelKey: '15°', isLiteralLabel: true },
  { value: '30', labelKey: '30°', isLiteralLabel: true },
  { value: '45', labelKey: '45°', isLiteralLabel: true },
  { value: '90', labelKey: '90°', isLiteralLabel: true },
] as const;

/** Seeded ± uniform scale jitter per item, in percent. 0 = off. */
export const SCALE_JITTER_OPTIONS = [
  { value: '0', labelKey: '0%', isLiteralLabel: true },
  { value: '10', labelKey: '10%', isLiteralLabel: true },
  { value: '20', labelKey: '20%', isLiteralLabel: true },
  { value: '30', labelKey: '30%', isLiteralLabel: true },
  { value: '50', labelKey: '50%', isLiteralLabel: true },
] as const;

/** Seeded ± lateral (path-normal) offset jitter per item, in drawing units. 0 = off. */
export const OFFSET_JITTER_OPTIONS = [
  { value: '0', labelKey: '0', isLiteralLabel: true },
  { value: '5', labelKey: '5', isLiteralLabel: true },
  { value: '10', labelKey: '10', isLiteralLabel: true },
  { value: '25', labelKey: '25', isLiteralLabel: true },
  { value: '50', labelKey: '50', isLiteralLabel: true },
] as const;

/** Deterministic seed for all jitter + random source pick. Same seed → same layout. */
export const SEED_OPTIONS = [
  { value: '0', labelKey: '0', isLiteralLabel: true },
  { value: '1', labelKey: '1', isLiteralLabel: true },
  { value: '2', labelKey: '2', isLiteralLabel: true },
  { value: '7', labelKey: '7', isLiteralLabel: true },
  { value: '42', labelKey: '42', isLiteralLabel: true },
  { value: '100', labelKey: '100', isLiteralLabel: true },
] as const;

/** How multiple pre-selected sources populate the path (C4D Cloner parity). */
export const DISTRIBUTION_OPTIONS = [
  { value: 'group', labelKey: 'Group', isLiteralLabel: true },
  { value: 'sequential', labelKey: 'Sequential', isLiteralLabel: true },
  { value: 'random', labelKey: 'Random', isLiteralLabel: true },
] as const;
