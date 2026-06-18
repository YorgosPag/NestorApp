/**
 * Structural Project Presets — built-in definitions + pure factory (ADR-479).
 *
 * Καθρεφτίζει το `buildDefaultVariantFor` pattern (bim/stairs): pure function που
 * συνθέτει ένα πλήρες `StructuralSettings` payload. **SSoT-composing** — αντλεί τις
 * φυσικές τιμές από την πραγματική μελέτη ({@link THERMI_288_08}) και τα γυμνά
 * defaults από {@link DEFAULT_STRUCTURAL_SETTINGS}· ΔΕΝ re-hardcode-άρει αριθμούς
 * που ζουν ήδη σε engine SSoT (concrete grade, occupancy, σεισμικά).
 *
 * @see ./structural-preset-types.ts
 * @see ./reference-static-report.ts — η πηγή των φυσικών τιμών (Θέρμη 288/08)
 * @see docs/centralized-systems/reference/adrs/ADR-479-structural-project-presets.md
 */

import type { StructuralCodeId } from '../codes';
import { DEFAULT_STRUCTURAL_SETTINGS, type StructuralSettings } from '../structural-settings';
import { THERMI_288_08 } from './reference-static-report';
import type {
  StructuralPresetDefinition,
  StructuralPresetKind,
} from './structural-preset-types';

/**
 * Ελληνικό κτίριο Ο.Σ. (πολυκατοικία) — οι φυσικές παραδοχές της μελέτης Θέρμη
 * 288/08, παραμετρικά ως προς τον κανονισμό. Οι δύο preset variants (EC8 / ΕΚΩΣ-ΕΑΚ)
 * διαφέρουν ΜΟΝΟ στο `codeId` — ίδια υλικά/σεισμικά/έδαφος.
 */
function greekRcSettings(codeId: StructuralCodeId): StructuralSettings {
  return {
    codeId,
    defaultConcreteGrade: THERMI_288_08.concreteGrade,
    occupancy: THERMI_288_08.primaryOccupancy,
    seismicGroundType: THERMI_288_08.seismic.groundType,
    seismicGroundAccelRatio: THERMI_288_08.seismic.groundAccelRatio,
    soilBearingCapacityKpa: THERMI_288_08.soil.allowableBearingKpa,
  };
}

/**
 * **SSoT** built-in presets. Νέο preset → εδώ μία εγγραφή (i18n labels + settings)·
 * μηδέν αλλαγή σε consumers (το `applyStructuralPreset` διαβάζει το factory).
 */
export const STRUCTURAL_PRESET_DEFINITIONS: Readonly<
  Record<StructuralPresetKind, StructuralPresetDefinition>
> = {
  'greek-rc-ec8': {
    kind: 'greek-rc-ec8',
    labelKey: 'structural.preset.greekRcEc8.label',
    descriptionKey: 'structural.preset.greekRcEc8.description',
    settings: greekRcSettings('eurocode'),
    buildingCategoryHint: 'residential',
  },
  'greek-rc-legacy': {
    kind: 'greek-rc-legacy',
    labelKey: 'structural.preset.greekRcLegacy.label',
    descriptionKey: 'structural.preset.greekRcLegacy.description',
    settings: greekRcSettings('greek-legacy'),
    buildingCategoryHint: 'residential',
  },
  blank: {
    kind: 'blank',
    labelKey: 'structural.preset.blank.label',
    descriptionKey: 'structural.preset.blank.description',
    settings: DEFAULT_STRUCTURAL_SETTINGS,
  },
};

/** Σειρά εμφάνισης presets στο UI (default «Ελληνικό RC (EC8)» πρώτο). */
export const STRUCTURAL_PRESET_ORDER: readonly StructuralPresetKind[] = [
  'greek-rc-ec8',
  'greek-rc-legacy',
  'blank',
];

/**
 * ADR-479 — pure factory: το πλήρες `StructuralSettings` ενός built-in preset.
 * Mirror του `buildDefaultVariantFor`. Άγνωστο kind ⇒ τα γυμνά defaults (graceful).
 */
export function buildStructuralSettingsForPreset(kind: StructuralPresetKind): StructuralSettings {
  return STRUCTURAL_PRESET_DEFINITIONS[kind]?.settings ?? DEFAULT_STRUCTURAL_SETTINGS;
}

/** Type-guard για persisted/UI τιμές preset kind. */
export function isStructuralPresetKind(v: string | undefined): v is StructuralPresetKind {
  return v === 'greek-rc-ec8' || v === 'greek-rc-legacy' || v === 'blank';
}
