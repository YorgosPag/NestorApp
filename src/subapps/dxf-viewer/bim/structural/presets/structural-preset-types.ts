/**
 * Structural Project Presets — τύποι (ADR-479).
 *
 * Σαν Revit project template: ένα named preset προ-φορτώνει building-level
 * `StructuralSettings` (κανονισμός, υλικά, σεισμικά, έδαφος, occupancy) ώστε ένα
 * νέο έργο να «γεννιέται» ήδη σωστά αντί ο μηχανικός να ορίζει το κάθε πεδίο.
 *
 * Slice 1 = built-in presets (pure factory). Οι persisted user/company presets
 * (scope/Firestore CRUD) είναι DEFER — οι τύποι δηλώνονται έτοιμοι ώστε ο μελλοντικός
 * service να καθρεφτίσει το `StairPresetsService` pattern χωρίς redesign.
 *
 * @see ./structural-preset-defaults.ts — built-in definitions + factory
 * @see ../structural-settings.ts — το payload (StructuralSettings)
 * @see docs/centralized-systems/reference/adrs/ADR-479-structural-project-presets.md
 */

import type { StructuralSettings } from '../structural-settings';
import type { BuildingCategory } from '../loads/occupancy-loads';

/**
 * Built-in preset kinds. `greek-rc-ec8`/`greek-rc-legacy` παράγονται από την
 * πραγματική μελέτη Θέρμη 288/08 (διαφέρουν μόνο στον κανονισμό)· `blank` = τα
 * γυμνά {@link DEFAULT_STRUCTURAL_SETTINGS}.
 */
export type StructuralPresetKind = 'greek-rc-ec8' | 'greek-rc-legacy' | 'blank';

/** Ορισμός ενός built-in preset — i18n labels + το πλήρες settings payload. */
export interface StructuralPresetDefinition {
  readonly kind: StructuralPresetKind;
  /** i18n key τίτλου (locales· N.11 — μηδέν hardcoded label). */
  readonly labelKey: string;
  /** i18n key περιγραφής. */
  readonly descriptionKey: string;
  /** Το building-level settings payload που εφαρμόζει το preset. */
  readonly settings: StructuralSettings;
  /** Προαιρετική υπόδειξη γενικής κατηγορίας κτιρίου (UI default match). */
  readonly buildingCategoryHint?: BuildingCategory;
}

// ─── DEFER — persisted user/company presets (mirror StairPresetsService) ──────

/** Εμβέλεια persisted preset (DEFER Slice 3 — όπως `StairPresetScope`). */
export type StructuralPresetScope = 'user' | 'company' | 'project';

/** Persisted preset document (DEFER Slice 3 — Firestore `companies/{id}/structural_presets/{id}`). */
export interface StructuralPresetDoc {
  readonly id: string;
  readonly name: string;
  readonly scope: StructuralPresetScope;
  readonly settings: StructuralSettings;
  readonly buildingCategoryHint?: BuildingCategory;
}
