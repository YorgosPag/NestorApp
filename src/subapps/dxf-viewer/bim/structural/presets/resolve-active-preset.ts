/**
 * Structural Project Presets — active-preset detection (ADR-479 Slice 2).
 *
 * Revit-grade: ο preset selector ΔΕΝ είναι fire-and-forget. Δείχνει **ποιο** built-in
 * preset ταυτίζεται με τα τρέχοντα building-level `StructuralSettings`. Αν ο μηχανικός
 * άλλαξε έστω ένα πεδίο (κανονισμό/υλικό/έδαφος/σεισμικά/occupancy), κανένα preset δεν
 * ταιριάζει → `null` → το UI δείχνει «Προσαρμοσμένο» (όπως το Revit όταν αποκλίνεις από
 * το template). Pure (zero React/store deps) → unit-testable.
 *
 * @see ./structural-preset-defaults.ts — οι ορισμοί + factory
 * @see ../structural-settings.ts — `resolveStructuralSettings` (κανονικοποίηση)
 * @see docs/centralized-systems/reference/adrs/ADR-479-structural-project-presets.md
 */

import { resolveStructuralSettings, type StructuralSettings } from '../structural-settings';
import {
  STRUCTURAL_PRESET_ORDER,
  buildStructuralSettingsForPreset,
} from './structural-preset-defaults';
import type { StructuralPresetKind } from './structural-preset-types';

/**
 * Ισότητα δύο **κανονικοποιημένων** settings. Τα optional πεδία είτε υπάρχουν με ίδια
 * τιμή είτε λείπουν και στα δύο (το `resolveStructuralSettings` αφαιρεί τα absent →
 * `undefined === undefined`). Πλήρης σύγκριση όλων των building-level πεδίων.
 */
function structuralSettingsEqual(a: StructuralSettings, b: StructuralSettings): boolean {
  return (
    a.codeId === b.codeId &&
    a.defaultConcreteGrade === b.defaultConcreteGrade &&
    a.soilBearingCapacityKpa === b.soilBearingCapacityKpa &&
    a.deadAreaLoadKpa === b.deadAreaLoadKpa &&
    a.liveAreaLoadKpa === b.liveAreaLoadKpa &&
    a.occupancy === b.occupancy &&
    a.seismicGroundType === b.seismicGroundType &&
    a.seismicGroundAccelRatio === b.seismicGroundAccelRatio
  );
}

/**
 * ADR-479 — Ποιο built-in preset ταυτίζεται με τα δοσμένα settings; `null` =
 * προσαρμοσμένα (καμία ταύτιση). Συγκρίνει κανονικοποιημένα (resolve) ώστε legacy/
 * μερικά settings να ταιριάζουν σωστά. Σειρά = `STRUCTURAL_PRESET_ORDER` (πρώτη ταύτιση).
 */
export function resolveActivePresetKind(
  settings: Partial<StructuralSettings> | null | undefined,
): StructuralPresetKind | null {
  const current = resolveStructuralSettings(settings);
  for (const kind of STRUCTURAL_PRESET_ORDER) {
    const presetResolved = resolveStructuralSettings(buildStructuralSettingsForPreset(kind));
    if (structuralSettingsEqual(current, presetResolved)) return kind;
  }
  return null;
}
