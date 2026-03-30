/**
 * @module config/report-builder/domain-defs-crm
 * @enterprise ADR-268 Phase 6c — CRM Domain Definitions
 *
 * E1: Opportunities (Pipeline) — 6 computed fields (G1, G2, G3, G9, G10, G11)
 * E2: CRM Tasks (Εργασίες) — 5 computed fields (G4, G5, G12, G13, G14)
 *
 * CRM Gap Analysis (2026-03-30) — research across:
 * Salesforce, HubSpot, Pipedrive, Zoho CRM, Microsoft Dynamics 365
 *
 * Enterprise computed fields:
 * - G1:  Weighted Value (all platforms)
 * - G2:  Age Days (all platforms)
 * - G3:  Days Since Last Activity / Deal Rotting (Pipedrive-originated)
 * - G9:  Days In Current Stage / Bottleneck Detection (all platforms)
 * - G10: Close Date Push Count (Salesforce, HubSpot, Dynamics)
 * - G11: Deal Velocity Score (Salesforce, HubSpot, Pipedrive)
 * - G4:  Overdue Task indicator (all platforms)
 * - G5:  Days Until Due (Salesforce, HubSpot)
 * - G12: Days Open / Task Aging (all platforms)
 * - G13: Aging Bucket categorization (Salesforce pattern)
 * - G14: Completed On Time rate (Salesforce, Zoho)
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT — match Firestore data & crm.ts types)
// ============================================================================

const OPPORTUNITY_STAGES = [
  'initial_contact', 'qualification', 'viewing', 'proposal',
  'negotiation', 'contract', 'closed_won', 'closed_lost',
] as const;

const OPPORTUNITY_STATUSES = [
  'active', 'on_hold', 'lost', 'won',
] as const;

const OPPORTUNITY_SOURCES = [
  'website', 'referral', 'agent', 'social', 'phone', 'walkin',
] as const;

const PROPERTY_TYPES = [
  'apartment', 'maisonette', 'store', 'office', 'parking', 'storage',
] as const;

const TASK_TYPES = [
  'call', 'email', 'meeting', 'viewing', 'document',
  'follow_up', 'complaint', 'other',
] as const;

const TASK_STATUSES = [
  'pending', 'in_progress', 'completed', 'cancelled',
] as const;

const TASK_PRIORITIES = [
  'low', 'medium', 'high', 'urgent',
] as const;

const AGING_BUCKETS = [
  'today', 'days7', 'weeks2', 'weeks4', 'over30',
] as const;

// ============================================================================
// Computed Field Helpers — Opportunities
// ============================================================================

/** G1: Weighted Value = estimatedValue × probability / 100 */
function computeWeightedValue(doc: Record<string, unknown>): number | null {
  const value = doc['estimatedValue'] as number | undefined;
  const probability = doc['probability'] as number | undefined;
  if (value === undefined || probability === undefined) return null;
  return Math.round(value * probability) / 100;
}

/** G2: Age in calendar days since creation */
function computeAgeDays(doc: Record<string, unknown>): number | null {
  const created = doc['createdAt'] as string | undefined;
  if (!created) return null;
  const ms = Date.now() - new Date(created).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G3: Days since last activity (deal rotting) */
function computeDaysSinceLastActivity(doc: Record<string, unknown>): number | null {
  const lastActivity = doc['lastActivity'] as string | undefined;
  if (!lastActivity) return null;
  const ms = Date.now() - new Date(lastActivity).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G9: Days in current stage (bottleneck detection) */
function computeDaysInCurrentStage(doc: Record<string, unknown>): number | null {
  const updated = doc['updatedAt'] as string | undefined;
  if (!updated) return null;
  const ms = Date.now() - new Date(updated).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G11: Deal Velocity Score = (value × probability) / ageDays */
function computeDealVelocity(doc: Record<string, unknown>): number | null {
  const value = doc['estimatedValue'] as number | undefined;
  const probability = doc['probability'] as number | undefined;
  const created = doc['createdAt'] as string | undefined;
  if (value === undefined || probability === undefined || !created) return null;
  const ageDays = Math.max(1, Math.round(
    (Date.now() - new Date(created).getTime()) / 86_400_000,
  ));
  return Math.round((value * (probability / 100)) / ageDays);
}

// ============================================================================
// Computed Field Helpers — CRM Tasks
// ============================================================================

/** G4: Is task overdue (past due date and not completed/cancelled) */
function computeIsOverdue(doc: Record<string, unknown>): boolean {
  const status = doc['status'] as string | undefined;
  if (status === 'completed' || status === 'cancelled') return false;
  const dueDate = doc['dueDate'] as string | undefined;
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

/** G5: Days until due (negative = overdue) */
function computeDaysUntilDue(doc: Record<string, unknown>): number | null {
  const dueDate = doc['dueDate'] as string | undefined;
  if (!dueDate) return null;
  const ms = new Date(dueDate).getTime() - Date.now();
  return Math.round(ms / 86_400_000);
}

/** G12: Days open (since creation) */
function computeTaskDaysOpen(doc: Record<string, unknown>): number | null {
  const created = doc['createdAt'] as string | undefined;
  if (!created) return null;
  const ms = Date.now() - new Date(created).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** G13: Aging bucket categorization (Salesforce pattern) */
function computeAgingBucket(doc: Record<string, unknown>): string {
  const created = doc['createdAt'] as string | undefined;
  if (!created) return 'today';
  const days = Math.max(0, Math.round(
    (Date.now() - new Date(created).getTime()) / 86_400_000,
  ));
  if (days === 0) return 'today';
  if (days <= 7) return 'days7';
  if (days <= 14) return 'weeks2';
  if (days <= 30) return 'weeks4';
  return 'over30';
}

/** G14: Completed on time (was task done before/on due date) */
function computeCompletedOnTime(doc: Record<string, unknown>): boolean | null {
  const status = doc['status'] as string | undefined;
  if (status !== 'completed') return null;
  const dueDate = doc['dueDate'] as string | undefined;
  const completedAt = doc['completedAt'] as string | undefined;
  if (!dueDate || !completedAt) return null;
  return new Date(completedAt).getTime() <= new Date(dueDate).getTime();
}

// ============================================================================
// E1: Opportunities (Pipeline)
// ============================================================================

export const OPPORTUNITIES_DEFINITION: DomainDefinition = {
  id: 'opportunities',
  collection: COLLECTIONS.OPPORTUNITIES,
  group: 'crm',
  labelKey: 'domains.opportunities.label',
  descriptionKey: 'domains.opportunities.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/crm/opportunities/{id}',
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'title', labelKey: 'domains.opportunities.fields.title', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'stage', labelKey: 'domains.opportunities.fields.stage', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: OPPORTUNITY_STAGES, enumLabelPrefix: 'domains.opportunities.enums.stage' },
    { key: 'status', labelKey: 'domains.opportunities.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: OPPORTUNITY_STATUSES, enumLabelPrefix: 'domains.opportunities.enums.status' },
    // Financial
    { key: 'estimatedValue', labelKey: 'domains.opportunities.fields.estimatedValue', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'probability', labelKey: 'domains.opportunities.fields.probability', type: 'percentage', filterable: true, sortable: true, defaultVisible: true, format: 'percentage' },
    // Source & Campaign
    { key: 'source', labelKey: 'domains.opportunities.fields.source', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: OPPORTUNITY_SOURCES, enumLabelPrefix: 'domains.opportunities.enums.source' },
    { key: 'campaign', labelKey: 'domains.opportunities.fields.campaign', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    // Interested In
    { key: 'interestedIn.propertyType', labelKey: 'domains.opportunities.fields.propertyType', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: PROPERTY_TYPES, enumLabelPrefix: 'domains.opportunities.enums.propertyType' },
    { key: 'interestedIn.budget.min', labelKey: 'domains.opportunities.fields.budgetMin', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'interestedIn.budget.max', labelKey: 'domains.opportunities.fields.budgetMax', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'interestedIn.desiredArea.min', labelKey: 'domains.opportunities.fields.areaMin', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'interestedIn.desiredArea.max', labelKey: 'domains.opportunities.fields.areaMax', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Actions
    { key: 'nextAction', labelKey: 'domains.opportunities.fields.nextAction', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    { key: 'nextActionDate', labelKey: 'domains.opportunities.fields.nextActionDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // Dates
    { key: 'expectedCloseDate', labelKey: 'domains.opportunities.fields.expectedCloseDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'wonDate', labelKey: 'domains.opportunities.fields.wonDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'lastActivity', labelKey: 'domains.opportunities.fields.lastActivity', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'createdAt', labelKey: 'domains.opportunities.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // References
    { key: 'contactId', labelKey: 'domains.opportunities.fields.contact', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'individuals', refDisplayField: 'displayName' },
    { key: 'referredBy', labelKey: 'domains.opportunities.fields.referredBy', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'individuals', refDisplayField: 'displayName' },
    // --- Computed: G1 — Weighted Value (all platforms) ---
    {
      key: 'weightedValue',
      labelKey: 'domains.opportunities.fields.weightedValue',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'currency',
      computed: true,
      computeFn: computeWeightedValue,
    },
    // --- Computed: G2 — Age Days (all platforms) ---
    {
      key: 'ageDays',
      labelKey: 'domains.opportunities.fields.ageDays',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeAgeDays,
    },
    // --- Computed: G3 — Days Since Last Activity / Deal Rotting (Pipedrive) ---
    {
      key: 'daysSinceLastActivity',
      labelKey: 'domains.opportunities.fields.daysSinceLastActivity',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
      computed: true,
      computeFn: computeDaysSinceLastActivity,
    },
    // --- Computed: G9 — Days In Current Stage / Bottleneck (all platforms) ---
    {
      key: 'daysInCurrentStage',
      labelKey: 'domains.opportunities.fields.daysInCurrentStage',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeDaysInCurrentStage,
    },
    // --- G10: Push Count (stored field, not computed) ---
    { key: 'pushCount', labelKey: 'domains.opportunities.fields.pushCount', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // --- Computed: G11 — Deal Velocity Score (Salesforce, HubSpot, Pipedrive) ---
    {
      key: 'dealVelocityScore',
      labelKey: 'domains.opportunities.fields.dealVelocityScore',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'currency',
      computed: true,
      computeFn: computeDealVelocity,
    },
  ],
};

// ============================================================================
// E2: CRM Tasks (Εργασίες)
// ============================================================================

export const CRM_TASKS_DEFINITION: DomainDefinition = {
  id: 'crmTasks',
  collection: COLLECTIONS.TASKS,
  group: 'crm',
  labelKey: 'domains.crmTasks.label',
  descriptionKey: 'domains.crmTasks.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/crm/tasks/{id}',
  defaultSortField: 'dueDate',
  defaultSortDirection: 'asc',
  fields: [
    // Identity
    { key: 'title', labelKey: 'domains.crmTasks.fields.title', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'type', labelKey: 'domains.crmTasks.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: TASK_TYPES, enumLabelPrefix: 'domains.crmTasks.enums.type' },
    { key: 'status', labelKey: 'domains.crmTasks.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: TASK_STATUSES, enumLabelPrefix: 'domains.crmTasks.enums.status' },
    { key: 'priority', labelKey: 'domains.crmTasks.fields.priority', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: TASK_PRIORITIES, enumLabelPrefix: 'domains.crmTasks.enums.priority' },
    // Assignment
    { key: 'assignedTo', labelKey: 'domains.crmTasks.fields.assignedTo', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'assignedBy', labelKey: 'domains.crmTasks.fields.assignedBy', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    // Description
    { key: 'description', labelKey: 'domains.crmTasks.fields.description', type: 'text', filterable: false, sortable: false, defaultVisible: false },
    // Dates
    { key: 'dueDate', labelKey: 'domains.crmTasks.fields.dueDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'completedAt', labelKey: 'domains.crmTasks.fields.completedAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'reminderDate', labelKey: 'domains.crmTasks.fields.reminderDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'createdAt', labelKey: 'domains.crmTasks.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // References
    { key: 'contactId', labelKey: 'domains.crmTasks.fields.contact', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'individuals', refDisplayField: 'displayName' },
    { key: 'opportunityId', labelKey: 'domains.crmTasks.fields.opportunity', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'opportunities', refDisplayField: 'title' },
    { key: 'projectId', labelKey: 'domains.crmTasks.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'unitId', labelKey: 'domains.crmTasks.fields.unit', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'units', refDisplayField: 'name' },
    // --- Computed: G4 — Overdue (all platforms) ---
    {
      key: 'isOverdue',
      labelKey: 'domains.crmTasks.fields.isOverdue',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      computed: true,
      computeFn: computeIsOverdue,
    },
    // --- Computed: G5 — Days Until Due (Salesforce, HubSpot) ---
    {
      key: 'daysUntilDue',
      labelKey: 'domains.crmTasks.fields.daysUntilDue',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
      computed: true,
      computeFn: computeDaysUntilDue,
    },
    // --- Computed: G12 — Days Open / Task Aging (all platforms) ---
    {
      key: 'daysOpen',
      labelKey: 'domains.crmTasks.fields.daysOpen',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      format: 'number',
      computed: true,
      computeFn: computeTaskDaysOpen,
    },
    // --- Computed: G13 — Aging Bucket (Salesforce pattern) ---
    {
      key: 'agingBucket',
      labelKey: 'domains.crmTasks.fields.agingBucket',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      enumValues: AGING_BUCKETS,
      enumLabelPrefix: 'domains.crmTasks.enums.agingBucket',
      computed: true,
      computeFn: computeAgingBucket,
    },
    // --- Computed: G14 — Completed On Time (Salesforce, Zoho) ---
    {
      key: 'completedOnTime',
      labelKey: 'domains.crmTasks.fields.completedOnTime',
      type: 'boolean',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      computed: true,
      computeFn: computeCompletedOnTime,
    },
  ],
};
