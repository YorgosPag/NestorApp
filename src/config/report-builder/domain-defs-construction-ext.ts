/**
 * @module config/report-builder/domain-defs-construction-ext
 * @enterprise ADR-268 Phase 6b — Construction Extended Domain Definitions
 *
 * D4: BOQ Items (Bill of Quantities — Quantity Surveying)
 * D5: Building Milestones
 * D6: Construction Baselines
 *
 * Gap analysis enhancements:
 * - G5: Cost per m² (computed on BOQ — total cost / building GFA)
 * - G8: Budget columns deferred (requires cross-document aggregation)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT — match Firestore data & boq.ts / milestone.ts types)
// ============================================================================

// --- D4: BOQ Items ---
const BOQ_MEASUREMENT_UNITS = [
  'm', 'm2', 'm3', 'kg', 'ton', 'pcs', 'lt', 'set', 'hr', 'day', 'lump',
] as const;

const BOQ_ITEM_STATUSES = [
  'draft', 'submitted', 'approved', 'certified', 'locked',
] as const;

const BOQ_SOURCES = [
  'manual', 'template', 'dxf_auto', 'dxf_verified', 'imported', 'duplicate',
] as const;

const MEASUREMENT_METHODS = [
  'manual', 'tape', 'laser', 'dxf_auto', 'dxf_verified', 'bim',
] as const;

const QA_STATUSES = ['pending', 'passed', 'failed', 'na'] as const;

const WASTE_POLICIES = ['inherited', 'overridden'] as const;

const PRICE_AUTHORITIES = ['master', 'project', 'item'] as const;

const BOQ_SCOPES = ['building', 'unit'] as const;

// --- D5: Milestones ---
const MILESTONE_STATUSES = [
  'completed', 'in-progress', 'pending', 'delayed',
] as const;

const MILESTONE_TYPES = [
  'start', 'construction', 'systems', 'finishing', 'delivery',
] as const;

// ============================================================================
// Computed Field Helpers — BOQ
// ============================================================================

/** Gross quantity = net × (1 + wasteFactor) */
function computeGrossQuantity(doc: Record<string, unknown>): number | null {
  const net = doc['estimatedQuantity'] as number | undefined;
  const waste = doc['wasteFactor'] as number | undefined;
  if (net === undefined || waste === undefined) return null;
  return Math.round(net * (1 + waste) * 1000) / 1000;
}

/** Unit cost = material + labor + equipment */
function computeUnitCost(doc: Record<string, unknown>): number | null {
  const material = doc['materialUnitCost'] as number | undefined;
  const labor = doc['laborUnitCost'] as number | undefined;
  const equipment = doc['equipmentUnitCost'] as number | undefined;
  if (material === undefined || labor === undefined || equipment === undefined) return null;
  return Math.round((material + labor + equipment) * 100) / 100;
}

/** Total estimated cost = grossQuantity × unitCost */
function computeEstimatedTotalCost(doc: Record<string, unknown>): number | null {
  const gross = computeGrossQuantity(doc);
  const unitCost = computeUnitCost(doc);
  if (gross === null || unitCost === null) return null;
  return Math.round(gross * unitCost * 100) / 100;
}

/** Total actual cost = actualQuantity × unitCost (if actual exists) */
function computeActualTotalCost(doc: Record<string, unknown>): number | null {
  const actual = doc['actualQuantity'] as number | undefined;
  const unitCost = computeUnitCost(doc);
  if (actual === undefined || actual === null || unitCost === null) return null;
  return Math.round(actual * unitCost * 100) / 100;
}

/** Quantity variance % = (actual - estimated) / estimated × 100 */
function computeQuantityVariance(doc: Record<string, unknown>): number | null {
  const estimated = doc['estimatedQuantity'] as number | undefined;
  const actual = doc['actualQuantity'] as number | undefined;
  if (!estimated || estimated === 0 || actual === undefined || actual === null) return null;
  return Math.round(((actual - estimated) / estimated) * 10000) / 100;
}

/** Material cost breakdown = grossQuantity × materialUnitCost */
function computeMaterialCost(doc: Record<string, unknown>): number | null {
  const gross = computeGrossQuantity(doc);
  const rate = doc['materialUnitCost'] as number | undefined;
  if (gross === null || rate === undefined) return null;
  return Math.round(gross * rate * 100) / 100;
}

/** Labor cost breakdown = grossQuantity × laborUnitCost */
function computeLaborCost(doc: Record<string, unknown>): number | null {
  const gross = computeGrossQuantity(doc);
  const rate = doc['laborUnitCost'] as number | undefined;
  if (gross === null || rate === undefined) return null;
  return Math.round(gross * rate * 100) / 100;
}

/** Equipment cost breakdown = grossQuantity × equipmentUnitCost */
function computeEquipmentCost(doc: Record<string, unknown>): number | null {
  const gross = computeGrossQuantity(doc);
  const rate = doc['equipmentUnitCost'] as number | undefined;
  if (gross === null || rate === undefined) return null;
  return Math.round(gross * rate * 100) / 100;
}

// ============================================================================
// D4: BOQ Items
// ============================================================================

export const BOQ_ITEMS_DEFINITION: DomainDefinition = {
  id: 'boqItems',
  collection: COLLECTIONS.BOQ_ITEMS,
  group: 'construction',
  labelKey: 'domains.boqItems.label',
  descriptionKey: 'domains.boqItems.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/buildings/{buildingId}',
  defaultSortField: 'title',
  defaultSortDirection: 'asc',
  fields: [
    // Identity
    { key: 'title', labelKey: 'domains.boqItems.fields.title', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'categoryCode', labelKey: 'domains.boqItems.fields.categoryCode', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'scope', labelKey: 'domains.boqItems.fields.scope', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: BOQ_SCOPES, enumLabelPrefix: 'domains.boqItems.enums.scope' },
    { key: 'unit', labelKey: 'domains.boqItems.fields.unit', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: BOQ_MEASUREMENT_UNITS, enumLabelPrefix: 'domains.boqItems.enums.unit' },
    // Quantities
    { key: 'estimatedQuantity', labelKey: 'domains.boqItems.fields.estimatedQuantity', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'actualQuantity', labelKey: 'domains.boqItems.fields.actualQuantity', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'wasteFactor', labelKey: 'domains.boqItems.fields.wasteFactor', type: 'percentage', filterable: true, sortable: true, defaultVisible: false, format: 'percentage' },
    { key: 'wastePolicy', labelKey: 'domains.boqItems.fields.wastePolicy', type: 'enum', filterable: true, sortable: false, defaultVisible: false, enumValues: WASTE_POLICIES, enumLabelPrefix: 'domains.boqItems.enums.wastePolicy' },
    // Unit costs
    { key: 'materialUnitCost', labelKey: 'domains.boqItems.fields.materialUnitCost', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'laborUnitCost', labelKey: 'domains.boqItems.fields.laborUnitCost', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'equipmentUnitCost', labelKey: 'domains.boqItems.fields.equipmentUnitCost', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'priceAuthority', labelKey: 'domains.boqItems.fields.priceAuthority', type: 'enum', filterable: true, sortable: false, defaultVisible: false, enumValues: PRICE_AUTHORITIES, enumLabelPrefix: 'domains.boqItems.enums.priceAuthority' },
    // Status & QA
    { key: 'status', labelKey: 'domains.boqItems.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: BOQ_ITEM_STATUSES, enumLabelPrefix: 'domains.boqItems.enums.status' },
    { key: 'qaStatus', labelKey: 'domains.boqItems.fields.qaStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: QA_STATUSES, enumLabelPrefix: 'domains.boqItems.enums.qaStatus' },
    { key: 'source', labelKey: 'domains.boqItems.fields.source', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: BOQ_SOURCES, enumLabelPrefix: 'domains.boqItems.enums.source' },
    { key: 'measurementMethod', labelKey: 'domains.boqItems.fields.measurementMethod', type: 'enum', filterable: true, sortable: false, defaultVisible: false, enumValues: MEASUREMENT_METHODS, enumLabelPrefix: 'domains.boqItems.enums.measurementMethod' },
    // Notes
    { key: 'description', labelKey: 'domains.boqItems.fields.description', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    { key: 'notes', labelKey: 'domains.boqItems.fields.notes', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // References
    { key: 'buildingId', labelKey: 'domains.boqItems.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'buildings', refDisplayField: 'name' },
    { key: 'projectId', labelKey: 'domains.boqItems.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'linkedPhaseId', labelKey: 'domains.boqItems.fields.phase', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'constructionPhases', refDisplayField: 'name' },
    { key: 'linkedTaskId', labelKey: 'domains.boqItems.fields.task', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'constructionTasks', refDisplayField: 'name' },
    { key: 'linkedContractorId', labelKey: 'domains.boqItems.fields.contractor', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'individuals', refDisplayField: 'displayName' },
    // Computed: Cost Breakdown
    { key: 'grossQuantity', labelKey: 'domains.boqItems.fields.grossQuantity', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computeGrossQuantity },
    { key: 'unitCost', labelKey: 'domains.boqItems.fields.unitCost', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency', computed: true, computeFn: computeUnitCost },
    { key: 'estimatedTotalCost', labelKey: 'domains.boqItems.fields.estimatedTotalCost', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency', computed: true, computeFn: computeEstimatedTotalCost },
    { key: 'actualTotalCost', labelKey: 'domains.boqItems.fields.actualTotalCost', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency', computed: true, computeFn: computeActualTotalCost },
    { key: 'materialCost', labelKey: 'domains.boqItems.fields.materialCost', type: 'currency', filterable: false, sortable: true, defaultVisible: false, format: 'currency', computed: true, computeFn: computeMaterialCost },
    { key: 'laborCost', labelKey: 'domains.boqItems.fields.laborCost', type: 'currency', filterable: false, sortable: true, defaultVisible: false, format: 'currency', computed: true, computeFn: computeLaborCost },
    { key: 'equipmentCost', labelKey: 'domains.boqItems.fields.equipmentCost', type: 'currency', filterable: false, sortable: true, defaultVisible: false, format: 'currency', computed: true, computeFn: computeEquipmentCost },
    { key: 'quantityVariance', labelKey: 'domains.boqItems.fields.quantityVariance', type: 'percentage', filterable: true, sortable: true, defaultVisible: false, format: 'percentage', computed: true, computeFn: computeQuantityVariance },
    // Dates
    { key: 'createdAt', labelKey: 'domains.boqItems.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'updatedAt', labelKey: 'domains.boqItems.fields.updatedAt', type: 'date', filterable: false, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

// ============================================================================
// D5: Building Milestones
// ============================================================================

export const BUILDING_MILESTONES_DEFINITION: DomainDefinition = {
  id: 'buildingMilestones',
  collection: COLLECTIONS.BUILDING_MILESTONES,
  group: 'construction',
  labelKey: 'domains.buildingMilestones.label',
  descriptionKey: 'domains.buildingMilestones.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/buildings/{buildingId}',
  defaultSortField: 'date',
  defaultSortDirection: 'asc',
  fields: [
    { key: 'code', labelKey: 'domains.buildingMilestones.fields.code', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'title', labelKey: 'domains.buildingMilestones.fields.title', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'type', labelKey: 'domains.buildingMilestones.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: MILESTONE_TYPES, enumLabelPrefix: 'domains.buildingMilestones.enums.type' },
    { key: 'status', labelKey: 'domains.buildingMilestones.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: MILESTONE_STATUSES, enumLabelPrefix: 'domains.buildingMilestones.enums.status' },
    { key: 'date', labelKey: 'domains.buildingMilestones.fields.date', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'progress', labelKey: 'domains.buildingMilestones.fields.progress', type: 'percentage', filterable: true, sortable: true, defaultVisible: true, format: 'percentage' },
    { key: 'order', labelKey: 'domains.buildingMilestones.fields.order', type: 'number', filterable: false, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'description', labelKey: 'domains.buildingMilestones.fields.description', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // References
    { key: 'buildingId', labelKey: 'domains.buildingMilestones.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'buildings', refDisplayField: 'name' },
    { key: 'phaseId', labelKey: 'domains.buildingMilestones.fields.phase', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'constructionPhases', refDisplayField: 'name' },
    // Computed: days until milestone
    {
      key: 'daysUntil',
      labelKey: 'domains.buildingMilestones.fields.daysUntil',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: (doc) => {
        const date = doc['date'] as string | undefined;
        if (!date) return null;
        const ms = new Date(date).getTime() - Date.now();
        return Math.round(ms / 86_400_000);
      },
    },
    // Dates
    { key: 'createdAt', labelKey: 'domains.buildingMilestones.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

// ============================================================================
// D6: Construction Baselines
// ============================================================================

export const CONSTRUCTION_BASELINES_DEFINITION: DomainDefinition = {
  id: 'constructionBaselines',
  collection: COLLECTIONS.CONSTRUCTION_BASELINES,
  group: 'construction',
  labelKey: 'domains.constructionBaselines.label',
  descriptionKey: 'domains.constructionBaselines.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/buildings/{buildingId}',
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
  fields: [
    { key: 'name', labelKey: 'domains.constructionBaselines.fields.name', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'version', labelKey: 'domains.constructionBaselines.fields.version', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'description', labelKey: 'domains.constructionBaselines.fields.description', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // References
    { key: 'buildingId', labelKey: 'domains.constructionBaselines.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'buildings', refDisplayField: 'name' },
    // Computed: counts from denormalized arrays
    {
      key: 'phaseCount',
      labelKey: 'domains.constructionBaselines.fields.phaseCount',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
      computed: true,
      computeFn: (doc) => {
        const phases = doc['phases'] as unknown[] | undefined;
        return Array.isArray(phases) ? phases.length : 0;
      },
    },
    {
      key: 'taskCount',
      labelKey: 'domains.constructionBaselines.fields.taskCount',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
      computed: true,
      computeFn: (doc) => {
        const tasks = doc['tasks'] as unknown[] | undefined;
        return Array.isArray(tasks) ? tasks.length : 0;
      },
    },
    // Dates
    { key: 'createdAt', labelKey: 'domains.constructionBaselines.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
  ],
};
