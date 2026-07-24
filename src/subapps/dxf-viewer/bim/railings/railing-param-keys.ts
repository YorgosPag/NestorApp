/**
 * ADR-407 Φ9 — Railing param command-keys + combobox option ladders (SSoT).
 *
 * ONE source of truth shared by BOTH consumers of the railing param surface:
 *   1. the contextual ribbon tab + `useRibbonRailingBridge` (ribbon comboboxes)
 *   2. the left Properties palette (`RailingPropertiesTab` → `BimPropertyRow`)
 *
 * Mirror of `stair-command-keys.ts` (ADR-358): the tab/panel reference these
 * `commandKey` constants (never literal strings), and the bridge routes reads/
 * writes through the `isRailingRibbonKey` / `isRailingRibbonStringKey` guards.
 *
 * All booleans are surfaced as `'on'`/`'off'` string comboboxes (not toggles) so
 * every railing field flows through the ONE combobox read/write path — uniform,
 * and identically consumable by `BimPropertyRow` (select-only) in the panel.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type { RibbonComboboxOption } from '../../ui/ribbon/types/ribbon-types';
import { literalNumberOptions } from '../../ui/ribbon/data/ribbon-numeric-options';

/** String (enum + boolean) railing fields — routed via `isRailingRibbonStringKey`. */
export const RAILING_STRING_KEYS = {
  predefinedType: 'railing.string.predefinedType',
  balusterShape: 'railing.string.balusterShape',
  balusterJustification: 'railing.string.balusterJustification',
  postsEnabled: 'railing.string.postsEnabled',
  postsAtStart: 'railing.string.postsAtStart',
  postsAtCorners: 'railing.string.postsAtCorners',
  postsAtEnd: 'railing.string.postsAtEnd',
  topRailEnabled: 'railing.string.topRailEnabled',
  handrailEnabled: 'railing.string.handrailEnabled',
  infillKind: 'railing.string.infillKind',
} as const;

/** Numeric (mm) railing fields — routed via `isRailingRibbonKey`. */
export const RAILING_NUMBER_KEYS = {
  totalHeight: 'railing.params.totalHeight',
  baseElevation: 'railing.params.baseElevation',
  balusterWidth: 'railing.params.balusterWidth',
  balusterSpacing: 'railing.params.balusterSpacing',
  postsWidth: 'railing.params.postsWidth',
  topRailWidth: 'railing.params.topRailWidth',
  topRailHeight: 'railing.params.topRailHeight',
  handrailHeight: 'railing.params.handrailHeight',
} as const;

/** Convenience aggregate (mirror `STAIR_RIBBON_KEYS`). */
export const RAILING_RIBBON_KEYS = {
  stringParams: RAILING_STRING_KEYS,
  params: RAILING_NUMBER_KEYS,
} as const;

/**
 * Field label i18n keys (SSoT — shared by the ribbon comboboxes AND the panel
 * rows so a label change happens once). Enum fields reuse their `section.title`
 * as the field label; numeric fields have a flat leaf key.
 */
export const RAILING_LABEL_KEYS = {
  predefinedType: 'ribbon.commands.railingEditor.predefinedType.section.title',
  totalHeight: 'ribbon.commands.railingEditor.totalHeight',
  baseElevation: 'ribbon.commands.railingEditor.baseElevation',
  balusterShape: 'ribbon.commands.railingEditor.balusterShape.section.title',
  balusterWidth: 'ribbon.commands.railingEditor.balusterWidth',
  balusterSpacing: 'ribbon.commands.railingEditor.balusterSpacing',
  balusterJustification: 'ribbon.commands.railingEditor.justification.section.title',
  postsEnabled: 'ribbon.commands.railingEditor.postsEnabled',
  postsWidth: 'ribbon.commands.railingEditor.postsWidth',
  postsAtStart: 'ribbon.commands.railingEditor.postsAtStart',
  postsAtCorners: 'ribbon.commands.railingEditor.postsAtCorners',
  postsAtEnd: 'ribbon.commands.railingEditor.postsAtEnd',
  topRailEnabled: 'ribbon.commands.railingEditor.topRailEnabled',
  topRailWidth: 'ribbon.commands.railingEditor.topRailWidth',
  topRailHeight: 'ribbon.commands.railingEditor.topRailHeight',
  handrailEnabled: 'ribbon.commands.railingEditor.handrailEnabled',
  handrailHeight: 'ribbon.commands.railingEditor.handrailHeight',
  infillKind: 'ribbon.commands.railingEditor.infillKind.section.title',
} as const;

const STRING_KEY_SET: ReadonlySet<string> = new Set(Object.values(RAILING_STRING_KEYS));
const NUMBER_KEY_SET: ReadonlySet<string> = new Set(Object.values(RAILING_NUMBER_KEYS));

/** `true` when `key` is a numeric (mm) railing combobox key. */
export function isRailingRibbonKey(key: string): boolean {
  return NUMBER_KEY_SET.has(key);
}

/** `true` when `key` is a string/enum/boolean railing combobox key. */
export function isRailingRibbonStringKey(key: string): boolean {
  return STRING_KEY_SET.has(key);
}

/** `true` when `key` belongs to the railing surface at all (either flavour). */
export function isAnyRailingRibbonKey(key: string): boolean {
  return isRailingRibbonKey(key) || isRailingRibbonStringKey(key);
}

// ─── Enum option ladders (i18n labels under `ribbon.commands.railingEditor.*`) ──

/** IfcRailing PredefinedType (handrail / guardrail / balustrade). */
export const RAILING_PREDEFINED_TYPE_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: 'guardrail', labelKey: 'ribbon.commands.railingEditor.predefinedType.guardrail', isLiteralLabel: false },
  { value: 'handrail', labelKey: 'ribbon.commands.railingEditor.predefinedType.handrail', isLiteralLabel: false },
  { value: 'balustrade', labelKey: 'ribbon.commands.railingEditor.predefinedType.balustrade', isLiteralLabel: false },
];

/** Member cross-section profile (round / rectangular). */
export const RAILING_SHAPE_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: 'round', labelKey: 'ribbon.commands.railingEditor.shape.round', isLiteralLabel: false },
  { value: 'rectangular', labelKey: 'ribbon.commands.railingEditor.shape.rectangular', isLiteralLabel: false },
];

/** Baluster pattern justification along the path (start / center / end). */
export const RAILING_JUSTIFICATION_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: 'center', labelKey: 'ribbon.commands.railingEditor.justification.center', isLiteralLabel: false },
  { value: 'start', labelKey: 'ribbon.commands.railingEditor.justification.start', isLiteralLabel: false },
  { value: 'end', labelKey: 'ribbon.commands.railingEditor.justification.end', isLiteralLabel: false },
];

/** Boolean fields → on/off combobox (uniform combobox path, no toggle control). */
export const RAILING_ON_OFF_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: 'on', labelKey: 'ribbon.commands.railingEditor.onOff.on', isLiteralLabel: false },
  { value: 'off', labelKey: 'ribbon.commands.railingEditor.onOff.off', isLiteralLabel: false },
];

/** Infill kind (none / glass / mesh / solid). */
export const RAILING_INFILL_OPTIONS: readonly RibbonComboboxOption[] = [
  { value: 'none', labelKey: 'ribbon.commands.railingEditor.infillKind.none', isLiteralLabel: false },
  { value: 'glass', labelKey: 'ribbon.commands.railingEditor.infillKind.glass', isLiteralLabel: false },
  { value: 'mesh', labelKey: 'ribbon.commands.railingEditor.infillKind.mesh', isLiteralLabel: false },
  { value: 'solid', labelKey: 'ribbon.commands.railingEditor.infillKind.solid', isLiteralLabel: false },
];

// ─── Numeric (mm) ladders — raw mm literals (no unit scaling; explicit mm) ──────

export const RAILING_TOTAL_HEIGHT_OPTIONS = literalNumberOptions([900, 1000, 1050, 1100]);
export const RAILING_BASE_ELEVATION_OPTIONS = literalNumberOptions([0, 100, 150, 200, 300]);
export const RAILING_BALUSTER_WIDTH_OPTIONS = literalNumberOptions([12, 16, 20, 25, 32, 40, 50]);
export const RAILING_BALUSTER_SPACING_OPTIONS = literalNumberOptions([75, 80, 90, 100]);
export const RAILING_POST_WIDTH_OPTIONS = literalNumberOptions([30, 40, 50, 60, 80]);
export const RAILING_TOP_RAIL_WIDTH_OPTIONS = literalNumberOptions([32, 40, 50, 60]);
export const RAILING_TOP_RAIL_HEIGHT_OPTIONS = literalNumberOptions([900, 950, 1000, 1050, 1100]);
export const RAILING_HANDRAIL_HEIGHT_OPTIONS = literalNumberOptions([850, 900, 950, 1000]);
