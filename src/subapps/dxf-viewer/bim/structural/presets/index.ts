/**
 * Structural Project Presets — barrel (ADR-479).
 *
 * Revit-grade project templates: named presets που αρχικοποιούν building-level
 * `StructuralSettings` από canonical defaults + πραγματική εγκεκριμένη μελέτη.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-479-structural-project-presets.md
 */

export type {
  StructuralPresetKind,
  StructuralPresetDefinition,
  StructuralPresetScope,
  StructuralPresetDoc,
} from './structural-preset-types';
export {
  STRUCTURAL_PRESET_DEFINITIONS,
  STRUCTURAL_PRESET_ORDER,
  buildStructuralSettingsForPreset,
  isStructuralPresetKind,
} from './structural-preset-defaults';
export {
  THERMI_288_08,
  type StaticReportReference,
  type ReferenceCovers,
  type ReferenceSeismic,
  type ReferenceSoil,
  type ReferenceBuildingDynamics,
} from './reference-static-report';
export { resolveActivePresetKind } from './resolve-active-preset';
