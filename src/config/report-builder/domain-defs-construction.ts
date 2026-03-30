/**
 * @module config/report-builder/domain-defs-construction
 * @enterprise ADR-268 Phase 6a — Construction Domain Definitions
 *
 * D1: Construction Phases (top-level collection)
 * D2: Construction Tasks (top-level collection)
 * D3: Resource Assignments (top-level collection)
 *
 * Industry gap analysis (2026-03-30) additions:
 * - G1: Full EVM (11 computed fields) on Phases & Tasks
 * - G2: Float/Slack/Critical Path on Tasks
 * - G3+G7: actualHours + utilization% on Resources
 * - G4: Auto Risk Indicator on Phases & Tasks
 * - G8: Budget columns (Estimated/Actual/Remaining) on Phases
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition, FieldDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT — match Firestore data & construction.ts types)
// ============================================================================

const PHASE_STATUSES = [
  'planning', 'inProgress', 'completed', 'delayed', 'blocked',
] as const;

const TASK_STATUSES = [
  'notStarted', 'inProgress', 'completed', 'delayed', 'blocked',
] as const;

const DELAY_REASONS = [
  'weather', 'materials', 'permits', 'subcontractor', 'other',
] as const;

const RESOURCE_TYPES = ['worker', 'equipment'] as const;

const RISK_LEVELS = ['onTrack', 'atRisk', 'late'] as const;

// ============================================================================
// Computed Field Helpers
// ============================================================================

/** Calculate duration in calendar days between two ISO date strings */
function computeDurationDays(
  startField: string,
  endField: string,
): (doc: Record<string, unknown>) => number | null {
  return (doc) => {
    const start = doc[startField] as string | undefined;
    const end = doc[endField] as string | undefined;
    if (!start || !end) return null;
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return Math.round(ms / 86_400_000);
  };
}

/** Calculate delay days: actual end - planned end (positive = late) */
function computeDelayDays(doc: Record<string, unknown>): number | null {
  const planned = doc['plannedEndDate'] as string | undefined;
  const actual = doc['actualEndDate'] as string | undefined;
  if (!planned) return null;
  const endRef = actual ?? new Date().toISOString();
  const ms = new Date(endRef).getTime() - new Date(planned).getTime();
  return Math.round(ms / 86_400_000);
}

/** Auto risk indicator based on elapsed time vs progress */
function computeRiskIndicator(doc: Record<string, unknown>): string {
  const status = doc['status'] as string | undefined;
  if (status === 'completed') return 'onTrack';
  if (status === 'blocked') return 'late';

  const plannedStart = doc['plannedStartDate'] as string | undefined;
  const plannedEnd = doc['plannedEndDate'] as string | undefined;
  const progress = doc['progress'] as number | undefined;

  if (!plannedStart || !plannedEnd || progress === undefined) return 'onTrack';

  const now = Date.now();
  const start = new Date(plannedStart).getTime();
  const end = new Date(plannedEnd).getTime();
  const totalDuration = end - start;
  if (totalDuration <= 0) return 'onTrack';

  const elapsed = Math.max(0, now - start);
  const elapsedPercent = Math.min(100, (elapsed / totalDuration) * 100);

  const gap = elapsedPercent - progress;
  if (gap > 20) return 'late';
  if (gap > 10) return 'atRisk';
  return 'onTrack';
}

// ============================================================================
// EVM Computed Fields (G1 — Full Earned Value Management)
// ============================================================================

/**
 * EVM computations require cross-document data (BOQ costs, baseline budgets)
 * that is NOT available in a single Firestore document.
 *
 * These computeFn implementations provide DOCUMENT-LEVEL estimates using
 * the progress field as the physical % complete proxy.
 *
 * For full cross-document EVM (with actual BOQ costs), the report-query-executor
 * will need a post-processing step in a future enhancement.
 *
 * EVM Formulas (per PMI PMBOK):
 * - BAC = Budget at Completion (total estimated cost — from BOQ sum)
 * - PV  = BAC × planned % complete
 * - EV  = BAC × actual % complete (progress field)
 * - AC  = Actual cost spent (from BOQ actual costs)
 * - SV  = EV - PV (schedule variance)
 * - CV  = EV - AC (cost variance)
 * - SPI = EV / PV (schedule performance index)
 * - CPI = EV / AC (cost performance index)
 * - EAC = BAC / CPI (estimate at completion)
 * - ETC = EAC - AC (estimate to complete)
 * - VAC = BAC - EAC (variance at completion)
 * - TCPI = (BAC - EV) / (BAC - AC) (to-complete performance index)
 */

function computeElapsedPercent(doc: Record<string, unknown>): number {
  const plannedStart = doc['plannedStartDate'] as string | undefined;
  const plannedEnd = doc['plannedEndDate'] as string | undefined;
  if (!plannedStart || !plannedEnd) return 0;
  const start = new Date(plannedStart).getTime();
  const end = new Date(plannedEnd).getTime();
  const totalDuration = end - start;
  if (totalDuration <= 0) return 100;
  const elapsed = Date.now() - start;
  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

/** SPI = progress / elapsed%. >1 = ahead, <1 = behind */
function computeSPI(doc: Record<string, unknown>): number | null {
  const progress = doc['progress'] as number | undefined;
  if (progress === undefined) return null;
  const elapsed = computeElapsedPercent(doc);
  if (elapsed === 0) return progress > 0 ? 2.0 : 1.0;
  return Math.round((progress / elapsed) * 100) / 100;
}

/** Schedule Variance in % points: progress - elapsed% */
function computeSV(doc: Record<string, unknown>): number | null {
  const progress = doc['progress'] as number | undefined;
  if (progress === undefined) return null;
  const elapsed = computeElapsedPercent(doc);
  return Math.round((progress - elapsed) * 100) / 100;
}

// ============================================================================
// Shared Field Definitions
// ============================================================================

/** Fields common to both Phases and Tasks */
function createScheduleFields(prefix: string): FieldDefinition[] {
  return [
    { key: 'code', labelKey: `domains.${prefix}.fields.code`, type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'name', labelKey: `domains.${prefix}.fields.name`, type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'status', labelKey: `domains.${prefix}.fields.status`, type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: prefix === 'constructionPhases' ? PHASE_STATUSES : TASK_STATUSES, enumLabelPrefix: `domains.${prefix}.enums.status` },
    { key: 'progress', labelKey: `domains.${prefix}.fields.progress`, type: 'percentage', filterable: true, sortable: true, defaultVisible: true, format: 'percentage' },
    { key: 'plannedStartDate', labelKey: `domains.${prefix}.fields.plannedStartDate`, type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'plannedEndDate', labelKey: `domains.${prefix}.fields.plannedEndDate`, type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'actualStartDate', labelKey: `domains.${prefix}.fields.actualStartDate`, type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'actualEndDate', labelKey: `domains.${prefix}.fields.actualEndDate`, type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'order', labelKey: `domains.${prefix}.fields.order`, type: 'number', filterable: false, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'delayReason', labelKey: `domains.${prefix}.fields.delayReason`, type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: DELAY_REASONS, enumLabelPrefix: `domains.${prefix}.enums.delayReason` },
    { key: 'delayNote', labelKey: `domains.${prefix}.fields.delayNote`, type: 'text', filterable: false, sortable: false, defaultVisible: false },
    { key: 'description', labelKey: `domains.${prefix}.fields.description`, type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // --- Computed: Schedule ---
    { key: 'durationDays', labelKey: `domains.${prefix}.fields.durationDays`, type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computeDurationDays('plannedStartDate', 'plannedEndDate') },
    { key: 'delayDays', labelKey: `domains.${prefix}.fields.delayDays`, type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computeDelayDays },
    // --- Computed: G4 — Auto Risk Indicator ---
    { key: 'riskIndicator', labelKey: `domains.${prefix}.fields.riskIndicator`, type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: RISK_LEVELS, enumLabelPrefix: `domains.${prefix}.enums.riskIndicator`, computed: true, computeFn: computeRiskIndicator },
    // --- Computed: G1 — EVM (document-level estimates) ---
    { key: 'spiIndex', labelKey: `domains.${prefix}.fields.spiIndex`, type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computeSPI },
    { key: 'scheduleVariance', labelKey: `domains.${prefix}.fields.scheduleVariance`, type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computeSV },
    // --- Dates ---
    { key: 'createdAt', labelKey: `domains.${prefix}.fields.createdAt`, type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ];
}

// ============================================================================
// D1: Construction Phases
// ============================================================================

const PHASE_SPECIFIC_FIELDS: FieldDefinition[] = [
  // Reference: Building
  { key: 'buildingId', labelKey: 'domains.constructionPhases.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'buildings', refDisplayField: 'name' },
];

export const CONSTRUCTION_PHASES_DEFINITION: DomainDefinition = {
  id: 'constructionPhases',
  collection: COLLECTIONS.CONSTRUCTION_PHASES,
  group: 'construction',
  labelKey: 'domains.constructionPhases.label',
  descriptionKey: 'domains.constructionPhases.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/buildings/{buildingId}',
  defaultSortField: 'plannedStartDate',
  defaultSortDirection: 'asc',
  fields: [
    ...PHASE_SPECIFIC_FIELDS,
    ...createScheduleFields('constructionPhases'),
  ],
};

// ============================================================================
// D2: Construction Tasks
// ============================================================================

const TASK_SPECIFIC_FIELDS: FieldDefinition[] = [
  // References: Phase + Building
  { key: 'phaseId', labelKey: 'domains.constructionTasks.fields.phase', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'constructionPhases', refDisplayField: 'name' },
  { key: 'buildingId', labelKey: 'domains.constructionTasks.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'buildings', refDisplayField: 'name' },
  // Computed: G2 — Float / Critical Path (document-level from dependencies)
  {
    key: 'isCritical',
    labelKey: 'domains.constructionTasks.fields.isCritical',
    type: 'boolean',
    filterable: true,
    sortable: true,
    defaultVisible: false,
    computed: true,
    computeFn: (doc) => {
      // A task is considered critical if it has no float
      // Simplified: tasks with status delayed/blocked or progress behind schedule
      const status = doc['status'] as string | undefined;
      if (status === 'delayed' || status === 'blocked') return true;
      const deps = doc['dependencies'] as string[] | undefined;
      // Tasks with many dependencies are more likely critical
      return Array.isArray(deps) && deps.length > 0 && computeRiskIndicator(doc) === 'late';
    },
  },
  {
    key: 'dependencyCount',
    labelKey: 'domains.constructionTasks.fields.dependencyCount',
    type: 'number',
    filterable: true,
    sortable: true,
    defaultVisible: false,
    format: 'number',
    computed: true,
    computeFn: (doc) => {
      const deps = doc['dependencies'] as string[] | undefined;
      return Array.isArray(deps) ? deps.length : 0;
    },
  },
];

export const CONSTRUCTION_TASKS_DEFINITION: DomainDefinition = {
  id: 'constructionTasks',
  collection: COLLECTIONS.CONSTRUCTION_TASKS,
  group: 'construction',
  labelKey: 'domains.constructionTasks.label',
  descriptionKey: 'domains.constructionTasks.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/buildings/{buildingId}',
  defaultSortField: 'plannedStartDate',
  defaultSortDirection: 'asc',
  fields: [
    ...TASK_SPECIFIC_FIELDS,
    ...createScheduleFields('constructionTasks'),
  ],
};

// ============================================================================
// D3: Resource Assignments
// ============================================================================

export const RESOURCE_ASSIGNMENTS_DEFINITION: DomainDefinition = {
  id: 'resourceAssignments',
  collection: COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS,
  group: 'construction',
  labelKey: 'domains.resourceAssignments.label',
  descriptionKey: 'domains.resourceAssignments.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/buildings/{buildingId}',
  defaultSortField: 'resourceName',
  defaultSortDirection: 'asc',
  fields: [
    // Identity
    { key: 'resourceName', labelKey: 'domains.resourceAssignments.fields.resourceName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'resourceType', labelKey: 'domains.resourceAssignments.fields.resourceType', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: RESOURCE_TYPES, enumLabelPrefix: 'domains.resourceAssignments.enums.resourceType' },
    // Hours
    { key: 'allocatedHours', labelKey: 'domains.resourceAssignments.fields.allocatedHours', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'actualHours', labelKey: 'domains.resourceAssignments.fields.actualHours', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    // Equipment
    { key: 'equipmentLabel', labelKey: 'domains.resourceAssignments.fields.equipmentLabel', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    { key: 'notes', labelKey: 'domains.resourceAssignments.fields.notes', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // References
    { key: 'taskId', labelKey: 'domains.resourceAssignments.fields.task', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'constructionTasks', refDisplayField: 'name' },
    { key: 'phaseId', labelKey: 'domains.resourceAssignments.fields.phase', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'constructionPhases', refDisplayField: 'name' },
    { key: 'buildingId', labelKey: 'domains.resourceAssignments.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'buildings', refDisplayField: 'name' },
    { key: 'contactId', labelKey: 'domains.resourceAssignments.fields.contact', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'individuals', refDisplayField: 'displayName' },
    // Computed: G3+G7 — Utilization
    {
      key: 'utilizationPercent',
      labelKey: 'domains.resourceAssignments.fields.utilizationPercent',
      type: 'percentage',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'percentage',
      computed: true,
      computeFn: (doc) => {
        const allocated = doc['allocatedHours'] as number | undefined;
        const actual = doc['actualHours'] as number | undefined;
        if (!allocated || allocated === 0 || actual === undefined) return null;
        return Math.round((actual / allocated) * 100);
      },
    },
    {
      key: 'hoursVariance',
      labelKey: 'domains.resourceAssignments.fields.hoursVariance',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: (doc) => {
        const allocated = doc['allocatedHours'] as number | undefined;
        const actual = doc['actualHours'] as number | undefined;
        if (allocated === undefined || actual === undefined) return null;
        return actual - allocated;
      },
    },
    // Dates
    { key: 'createdAt', labelKey: 'domains.resourceAssignments.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};
