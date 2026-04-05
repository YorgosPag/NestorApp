/**
 * @module config/report-builder/domain-definitions
 * @enterprise ADR-268 — Domain Definitions for Dynamic Report Builder (Phase 1 + 4a)
 *
 * Static field schemas for 8 domains: Projects, Buildings, Floors, Properties,
 * Parking, Storage, Individuals, Companies & Services.
 * Each domain defines its Firestore collection, fields, types, and refs.
 * These definitions drive the UI (filter panel, column selector) and
 * the query engine (Firestore WHERE clauses, ref resolution).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { ALL_PROPERTY_TYPES_WITH_DEPRECATED } from '@/constants/property-types';
import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import { OPERATIONAL_STATUSES } from '@/constants/operational-statuses';
import { ENERGY_CLASSES } from '@/constants/energy-classes';
import { BUILDING_TYPES } from '@/constants/building-types';
import { PRIORITY_LEVELS } from '@/constants/priority-levels';
import { ACTIVE_PROJECT_STATUSES } from '@/constants/project-statuses';
import { PROJECT_TYPES as PROJECT_TYPES_SSOT } from '@/constants/project-types';
import type {
  BuilderDomainId,
  DomainDefinition,
  FieldDefinition,
} from './report-builder-types';
import { PARKING_DEFINITION, STORAGE_DEFINITION } from './domain-defs-spaces';
import { INDIVIDUALS_DEFINITION, COMPANIES_DEFINITION } from './domain-defs-contacts';
import { BUYERS_DEFINITION } from './domain-defs-buyers';
import {
  SUPPLIERS_DEFINITION,
  ENGINEERS_DEFINITION,
  WORKERS_DEFINITION,
  LEGAL_DEFINITION,
  AGENTS_DEFINITION,
} from './domain-defs-persona';
import {
  PAYMENT_PLANS_DEFINITION,
  CHEQUES_DEFINITION,
  LEGAL_CONTRACTS_DEFINITION,
} from './domain-defs-financials';
import { PURCHASE_ORDERS_DEFINITION } from './domain-defs-procurement';
import { BROKERAGE_DEFINITION, COMMISSIONS_DEFINITION } from './domain-defs-brokerage';
import { OWNERSHIP_SUMMARY_DEFINITION, OWNERSHIP_DETAIL_DEFINITION } from './domain-defs-ownership';
import {
  CONSTRUCTION_PHASES_DEFINITION,
  CONSTRUCTION_TASKS_DEFINITION,
  RESOURCE_ASSIGNMENTS_DEFINITION,
} from './domain-defs-construction';
import {
  BOQ_ITEMS_DEFINITION,
  BUILDING_MILESTONES_DEFINITION,
  CONSTRUCTION_BASELINES_DEFINITION,
} from './domain-defs-construction-ext';
import {
  OPPORTUNITIES_DEFINITION,
  CRM_TASKS_DEFINITION,
} from './domain-defs-crm';
import {
  COMMUNICATIONS_DEFINITION,
  APPOINTMENTS_DEFINITION,
} from './domain-defs-crm-ext';
import {
  INVOICES_DEFINITION,
  JOURNAL_ENTRIES_DEFINITION,
} from './domain-defs-accounting';
import {
  BANK_TRANSACTIONS_DEFINITION,
  EXPENSE_DOCUMENTS_DEFINITION,
  EFKA_PAYMENTS_DEFINITION,
} from './domain-defs-accounting-ext';

// ============================================================================
// Enum Value Constants (SSoT — match actual Firestore data)
// ============================================================================

// ADR-287 — ProjectStatus SSoT lives στο `@/constants/project-statuses`.
// Χρησιμοποιείται το `ACTIVE_PROJECT_STATUSES` subset (5 values) ώστε το
// soft-deleted `deleted` να μην εμφανίζεται στα report-builder dropdowns.
const PROJECT_STATUSES = ACTIVE_PROJECT_STATUSES;

// ADR-287 — ProjectType SSoT lives στο `@/constants/project-types`.
// Το local const αφαιρέθηκε · γίνεται re-use απευθείας το imported array.
const PROJECT_TYPES = PROJECT_TYPES_SSOT;

// ADR-287 — PriorityLevel SSoT lives στο `@/constants/priority-levels`.
// Το local `PROJECT_PRIORITIES` αντικαταστάθηκε με alias στο imported array
// ώστε να διατηρηθεί το semantic naming στα downstream field definitions.
const PROJECT_PRIORITIES = PRIORITY_LEVELS;

const BUILDING_STATUSES = [
  'planning', 'construction', 'completed', 'active',
] as const;

// ADR-287 — BuildingType SSoT lives στο `@/constants/building-types`.
// Το local const αφαιρέθηκε · γίνεται re-use απευθείας το imported array.

// ADR-287 — EnergyClass SSoT lives στο `@/constants/energy-classes`.
// Το local const αφαιρέθηκε · γίνεται re-use απευθείας το imported array.

// ADR-145 SSoT — 12 canonical + 2 deprecated (apartment_2br/3br for legacy data)
const UNIT_TYPES = ALL_PROPERTY_TYPES_WITH_DEPRECATED;

// ADR-287 — CommercialStatus SSoT lives στο `@/constants/commercial-statuses`.
// Το local const αφαιρέθηκε · γίνεται re-use απευθείας το imported array.

// ADR-287 — OperationalStatus SSoT lives στο `@/constants/operational-statuses`.
// Το local const αφαιρέθηκε · γίνεται re-use απευθείας το imported array.

const LEGAL_PHASES = [
  'initial', 'deedPrep', 'documentReview', 'signaturePending', 'completed', 'cancelled',
] as const;

// ============================================================================
// Domain Definitions
// ============================================================================

const PROJECTS_DEFINITION: DomainDefinition = {
  id: 'projects',
  collection: COLLECTIONS.PROJECTS,
  group: 'realestate',
  labelKey: 'domains.projects.label',
  descriptionKey: 'domains.projects.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/projects/{id}',
  defaultSortField: 'name',
  defaultSortDirection: 'asc',
  fields: [
    { key: 'name', labelKey: 'domains.projects.fields.name', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'projectCode', labelKey: 'domains.projects.fields.projectCode', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'status', labelKey: 'domains.projects.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: PROJECT_STATUSES, enumLabelPrefix: 'domains.projects.enums.status' },
    { key: 'type', labelKey: 'domains.projects.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: PROJECT_TYPES, enumLabelPrefix: 'domains.projects.enums.type' },
    { key: 'progress', labelKey: 'domains.projects.fields.progress', type: 'percentage', filterable: true, sortable: true, defaultVisible: true, format: 'percentage' },
    { key: 'totalValue', labelKey: 'domains.projects.fields.totalValue', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'budget', labelKey: 'domains.projects.fields.budget', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'totalArea', labelKey: 'domains.projects.fields.totalArea', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'priority', labelKey: 'domains.projects.fields.priority', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: PROJECT_PRIORITIES, enumLabelPrefix: 'domains.projects.enums.priority' },
    { key: 'city', labelKey: 'domains.projects.fields.city', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    { key: 'startDate', labelKey: 'domains.projects.fields.startDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'completionDate', labelKey: 'domains.projects.fields.completionDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'createdAt', labelKey: 'domains.projects.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

const BUILDINGS_DEFINITION: DomainDefinition = {
  id: 'buildings',
  collection: COLLECTIONS.BUILDINGS,
  group: 'realestate',
  labelKey: 'domains.buildings.label',
  descriptionKey: 'domains.buildings.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/buildings/{id}',
  defaultSortField: 'name',
  defaultSortDirection: 'asc',
  fields: [
    { key: 'name', labelKey: 'domains.buildings.fields.name', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'projectId', labelKey: 'domains.buildings.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'status', labelKey: 'domains.buildings.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: BUILDING_STATUSES, enumLabelPrefix: 'domains.buildings.enums.status' },
    { key: 'type', labelKey: 'domains.buildings.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: BUILDING_TYPES, enumLabelPrefix: 'domains.buildings.enums.type' },
    { key: 'progress', labelKey: 'domains.buildings.fields.progress', type: 'percentage', filterable: true, sortable: true, defaultVisible: true, format: 'percentage' },
    { key: 'totalArea', labelKey: 'domains.buildings.fields.totalArea', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'totalValue', labelKey: 'domains.buildings.fields.totalValue', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'floors', labelKey: 'domains.buildings.fields.floorCount', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'totalProperties', labelKey: 'domains.buildings.fields.totalProperties', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'energyClass', labelKey: 'domains.buildings.fields.energyClass', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: ENERGY_CLASSES, enumLabelPrefix: 'domains.buildings.enums.energyClass' },
    { key: 'city', labelKey: 'domains.buildings.fields.city', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    { key: 'createdAt', labelKey: 'domains.buildings.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

const FLOORS_DEFINITION: DomainDefinition = {
  id: 'floors',
  collection: COLLECTIONS.FLOORS,
  group: 'realestate',
  labelKey: 'domains.floors.label',
  descriptionKey: 'domains.floors.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/buildings/{buildingId}',
  defaultSortField: 'number',
  defaultSortDirection: 'asc',
  fields: [
    { key: 'name', labelKey: 'domains.floors.fields.name', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'number', labelKey: 'domains.floors.fields.number', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'buildingId', labelKey: 'domains.floors.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'buildings', refDisplayField: 'name' },
    { key: 'area', labelKey: 'domains.floors.fields.area', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'elevation', labelKey: 'domains.floors.fields.elevation', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'createdAt', labelKey: 'domains.floors.fields.createdAt', type: 'date', filterable: false, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

const PROPERTIES_DEFINITION: DomainDefinition = {
  id: 'properties',
  collection: COLLECTIONS.PROPERTIES,
  group: 'realestate',
  labelKey: 'domains.properties.label',
  descriptionKey: 'domains.properties.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/properties/{id}',
  defaultSortField: 'name',
  defaultSortDirection: 'asc',
  fields: [
    // Identity
    { key: 'name', labelKey: 'domains.properties.fields.name', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'code', labelKey: 'domains.properties.fields.code', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'type', labelKey: 'domains.properties.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: UNIT_TYPES, enumLabelPrefix: 'domains.properties.enums.type' },
    // Hierarchy refs
    { key: 'buildingId', labelKey: 'domains.properties.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'buildings', refDisplayField: 'name' },
    { key: 'project', labelKey: 'domains.properties.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'floor', labelKey: 'domains.properties.fields.floor', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Status
    { key: 'commercialStatus', labelKey: 'domains.properties.fields.commercialStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: COMMERCIAL_STATUSES, enumLabelPrefix: 'domains.properties.enums.commercialStatus' },
    { key: 'operationalStatus', labelKey: 'domains.properties.fields.operationalStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: OPERATIONAL_STATUSES, enumLabelPrefix: 'domains.properties.enums.operationalStatus' },
    // Areas
    { key: 'areas.gross', labelKey: 'domains.properties.fields.grossArea', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'areas.net', labelKey: 'domains.properties.fields.netArea', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Energy
    { key: 'energy.class', labelKey: 'domains.properties.fields.energyClass', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: ENERGY_CLASSES, enumLabelPrefix: 'domains.properties.enums.energyClass' },
    // Commercial
    { key: 'commercial.askingPrice', labelKey: 'domains.properties.fields.askingPrice', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'commercial.finalPrice', labelKey: 'domains.properties.fields.finalPrice', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'commercial.ownerContactIds', labelKey: 'domains.properties.fields.ownerContactIds', type: 'text', filterable: true, sortable: false, defaultVisible: false },
    { key: 'commercial.legalPhase', labelKey: 'domains.properties.fields.legalPhase', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: LEGAL_PHASES, enumLabelPrefix: 'domains.properties.enums.legalPhase' },
    // Payment summary (denormalized)
    { key: 'commercial.paymentSummary.totalAmount', labelKey: 'domains.properties.fields.paymentTotal', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'commercial.paymentSummary.paidAmount', labelKey: 'domains.properties.fields.paymentPaid', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'commercial.paymentSummary.paidPercentage', labelKey: 'domains.properties.fields.paymentPaidPct', type: 'percentage', filterable: true, sortable: true, defaultVisible: false, format: 'percentage' },
    { key: 'commercial.paymentSummary.overdueInstallments', labelKey: 'domains.properties.fields.overdueInstallments', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Layout
    { key: 'layout.bedrooms', labelKey: 'domains.properties.fields.bedrooms', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'layout.bathrooms', labelKey: 'domains.properties.fields.bathrooms', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Dates
    { key: 'createdAt', labelKey: 'domains.properties.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

// ============================================================================
// Domain Registry
// ============================================================================

export const DOMAIN_DEFINITIONS: Record<BuilderDomainId, DomainDefinition> = {
  // Phase 1 — Real Estate
  projects: PROJECTS_DEFINITION,
  buildings: BUILDINGS_DEFINITION,
  floors: FLOORS_DEFINITION,
  properties: PROPERTIES_DEFINITION,
  // Phase 4a — Spaces
  parking: PARKING_DEFINITION,
  storage: STORAGE_DEFINITION,
  // Phase 4a — Contacts
  individuals: INDIVIDUALS_DEFINITION,
  companies: COMPANIES_DEFINITION,
  // Phase 4b — Buyers (transaction-based)
  buyers: BUYERS_DEFINITION,
  // Phase 4b — Persona-based specialists
  suppliers: SUPPLIERS_DEFINITION,
  engineers: ENGINEERS_DEFINITION,
  workers: WORKERS_DEFINITION,
  legal: LEGAL_DEFINITION,
  agents: AGENTS_DEFINITION,
  // Phase 5 — Financial domains
  paymentPlans: PAYMENT_PLANS_DEFINITION,
  cheques: CHEQUES_DEFINITION,
  legalContracts: LEGAL_CONTRACTS_DEFINITION,
  purchaseOrders: PURCHASE_ORDERS_DEFINITION,
  brokerageAgreements: BROKERAGE_DEFINITION,
  commissionRecords: COMMISSIONS_DEFINITION,
  ownershipSummary: OWNERSHIP_SUMMARY_DEFINITION,
  ownershipDetail: OWNERSHIP_DETAIL_DEFINITION,
  // Phase 6a — Construction domains
  constructionPhases: CONSTRUCTION_PHASES_DEFINITION,
  constructionTasks: CONSTRUCTION_TASKS_DEFINITION,
  resourceAssignments: RESOURCE_ASSIGNMENTS_DEFINITION,
  // Phase 6b — Construction extended domains
  boqItems: BOQ_ITEMS_DEFINITION,
  buildingMilestones: BUILDING_MILESTONES_DEFINITION,
  constructionBaselines: CONSTRUCTION_BASELINES_DEFINITION,
  // Phase 6c — CRM domains
  opportunities: OPPORTUNITIES_DEFINITION,
  crmTasks: CRM_TASKS_DEFINITION,
  // Phase 6d — CRM extended domains
  communications: COMMUNICATIONS_DEFINITION,
  appointments: APPOINTMENTS_DEFINITION,
  // Phase 6e — Accounting domains
  invoices: INVOICES_DEFINITION,
  journalEntries: JOURNAL_ENTRIES_DEFINITION,
  // Phase 6f — Accounting extended domains
  bankTransactions: BANK_TRANSACTIONS_DEFINITION,
  expenseDocuments: EXPENSE_DOCUMENTS_DEFINITION,
  efkaPayments: EFKA_PAYMENTS_DEFINITION,
};

// ============================================================================
// Accessor Functions
// ============================================================================

/** Get domain definition by ID — throws if not found */
export function getDomainDefinition(id: BuilderDomainId): DomainDefinition {
  const def = DOMAIN_DEFINITIONS[id];
  if (!def) {
    throw new Error(`Unknown domain: ${id}`);
  }
  return def;
}

/** Get a specific field definition from a domain */
export function getFieldDefinition(
  domainId: BuilderDomainId,
  fieldKey: string,
): FieldDefinition | undefined {
  return getDomainDefinition(domainId).fields.find((f) => f.key === fieldKey);
}

/** Get all filterable fields for a domain */
export function getFilterableFields(domainId: BuilderDomainId): FieldDefinition[] {
  return getDomainDefinition(domainId).fields.filter((f) => f.filterable);
}

/** Get default visible columns for a domain */
export function getDefaultColumns(domainId: BuilderDomainId): string[] {
  return getDomainDefinition(domainId)
    .fields.filter((f) => f.defaultVisible)
    .map((f) => f.key);
}

/** Get all sortable fields for a domain */
export function getSortableFields(domainId: BuilderDomainId): FieldDefinition[] {
  return getDomainDefinition(domainId).fields.filter((f) => f.sortable);
}
