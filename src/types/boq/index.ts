/**
 * BOQ Types — Barrel Exports
 *
 * @module types/boq
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

// Units & enumerations
export type {
  BOQMeasurementUnit,
  IfcQuantityType,
  RoomType,
  BOQItemStatus,
  MeasurementMethod,
  BOQSource,
  QAStatus,
  CategoryLevel,
  WastePolicy,
  SourceAuthority,
} from './units';
export { IFC_UNIT_MAP } from './units';

// Core entities
export type {
  BOQScope,
  CostAllocationMethod,
  BOQItem,
  BOQCategory,
  BOQCategorySummary,
  BOQSummary,
  BOQProjectSummary,
  CreateBOQItemInput,
  UpdateBOQItemInput,
  BOQFilters,
} from './boq';
export { BOQ_ITEM_DEFAULTS } from './boq';

// Governance lifecycle ordering (ADR-734 §6.3 κανόνας 1)
export {
  BOQ_STATUS_RANK,
  BOQ_STATUS_LIFECYCLE_ORDER,
  LOWEST_BOQ_ITEM_STATUS,
  isKnownBoqItemStatus,
  boqStatusRank,
  isSignableBoqItemStatus,
} from './lifecycle';

// Cost types (computed, never stored)
export type {
  CostBreakdown,
  PriceResolution,
  VarianceResult,
  BaselineDriftResult,
  BOQCategoryCost,
} from './cost';
