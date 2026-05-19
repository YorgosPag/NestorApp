/**
 * BIM Schedule Export — Public API (ADR-363 §6 Phase 8).
 *
 * Single entry point για external consumers (UI dialog, ribbon hooks,
 * future tests). Internal modules (`filters`, `schedule-presets`,
 * `schedule-builder`, `exporters/`) remain importable for power-use, but
 * preferred surface is through this barrel.
 *
 * SSoT module: declared in `.ssot-registry.json` as `bim-schedule-export`
 * (Tier 3) — forbidden patterns block re-implementation outside this
 * folder.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 8
 */

// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  Schedule,
  ScheduleCellValue,
  ScheduleColumnAlign,
  ScheduleColumnDef,
  ScheduleColumnValueType,
  ScheduleConfig,
  ScheduleEntityType,
  ScheduleExportFormat,
  ScheduleExportOptions,
  ScheduleFilterCriteria,
  ScheduleLookups,
  ScheduleRow,
  FloorLabelLookup,
  MaterialLabelLookup,
} from './types';

// ─── Filters ────────────────────────────────────────────────────────────────
export {
  applyScheduleFilters,
  passesAllFilters,
  passesFloorFilter,
  passesCategoryFilter,
  passesRegionFilter,
  passesSelectionFilter,
  asFilterable,
} from './filters';
export type { FilterableBimEntity } from './filters';

// ─── Presets ────────────────────────────────────────────────────────────────
export {
  getPreset,
  openingKindToScheduleType,
  handingToGreek,
  handingToDIN,
} from './schedule-presets';
export type { AnyBimEntity, SchedulePreset } from './schedule-presets';

// ─── Builder ────────────────────────────────────────────────────────────────
export { buildSchedule, emptySchedule } from './schedule-builder';

// ─── Exporters ──────────────────────────────────────────────────────────────
export {
  downloadSchedule,
  downloadScheduleAsCsv,
  downloadScheduleAsXlsx,
  downloadScheduleAsPdf,
  scheduleToCsv,
  scheduleToXlsxBlob,
  scheduleToPdfBlob,
  formatCellForDisplay,
  formatCellForXlsx,
  xlsxNumFmtFor,
} from './exporters';
export type { HeaderTranslator } from './exporters';
