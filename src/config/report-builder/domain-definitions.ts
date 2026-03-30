/**
 * @module config/report-builder/domain-definitions
 * @enterprise ADR-268 — Domain Definitions for Dynamic Report Builder (Phase 1 + 4a)
 *
 * Static field schemas for 8 domains: Projects, Buildings, Floors, Units,
 * Parking, Storage, Individuals, Companies & Services.
 * Each domain defines its Firestore collection, fields, types, and refs.
 * These definitions drive the UI (filter panel, column selector) and
 * the query engine (Firestore WHERE clauses, ref resolution).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
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

// ============================================================================
// Enum Value Constants (SSoT — match actual Firestore data)
// ============================================================================

const PROJECT_STATUSES = [
  'planning', 'in_progress', 'completed', 'on_hold', 'cancelled',
] as const;

const PROJECT_TYPES = [
  'residential', 'commercial', 'industrial', 'mixed', 'infrastructure', 'renovation',
] as const;

const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

const BUILDING_STATUSES = [
  'planning', 'construction', 'completed', 'active',
] as const;

const BUILDING_TYPES = [
  'residential', 'commercial', 'industrial', 'mixed', 'office', 'warehouse',
] as const;

const ENERGY_CLASSES = ['A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

const UNIT_TYPES = [
  'studio', 'apartment_1br', 'apartment', 'apartment_2br', 'apartment_3br',
  'maisonette', 'penthouse', 'loft', 'detached_house', 'villa',
  'shop', 'office', 'hall', 'storage',
] as const;

const COMMERCIAL_STATUSES = [
  'unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent',
  'reserved', 'sold', 'rented',
] as const;

const OPERATIONAL_STATUSES = [
  'ready', 'under-construction', 'inspection', 'maintenance', 'draft',
] as const;

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
    { key: 'totalUnits', labelKey: 'domains.buildings.fields.totalUnits', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
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

const UNITS_DEFINITION: DomainDefinition = {
  id: 'units',
  collection: COLLECTIONS.UNITS,
  group: 'realestate',
  labelKey: 'domains.units.label',
  descriptionKey: 'domains.units.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template, not user-facing
  entityLinkPath: '/units/{id}',
  defaultSortField: 'name',
  defaultSortDirection: 'asc',
  fields: [
    // Identity
    { key: 'name', labelKey: 'domains.units.fields.name', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'code', labelKey: 'domains.units.fields.code', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'type', labelKey: 'domains.units.fields.type', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: UNIT_TYPES, enumLabelPrefix: 'domains.units.enums.type' },
    // Hierarchy refs
    { key: 'buildingId', labelKey: 'domains.units.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'buildings', refDisplayField: 'name' },
    { key: 'project', labelKey: 'domains.units.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'floor', labelKey: 'domains.units.fields.floor', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Status
    { key: 'commercialStatus', labelKey: 'domains.units.fields.commercialStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: COMMERCIAL_STATUSES, enumLabelPrefix: 'domains.units.enums.commercialStatus' },
    { key: 'operationalStatus', labelKey: 'domains.units.fields.operationalStatus', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: OPERATIONAL_STATUSES, enumLabelPrefix: 'domains.units.enums.operationalStatus' },
    // Areas
    { key: 'areas.gross', labelKey: 'domains.units.fields.grossArea', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number' },
    { key: 'areas.net', labelKey: 'domains.units.fields.netArea', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Energy
    { key: 'energy.class', labelKey: 'domains.units.fields.energyClass', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: ENERGY_CLASSES, enumLabelPrefix: 'domains.units.enums.energyClass' },
    // Commercial
    { key: 'commercial.askingPrice', labelKey: 'domains.units.fields.askingPrice', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'commercial.finalPrice', labelKey: 'domains.units.fields.finalPrice', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'commercial.buyerName', labelKey: 'domains.units.fields.buyerName', type: 'text', filterable: true, sortable: true, defaultVisible: false },
    { key: 'commercial.legalPhase', labelKey: 'domains.units.fields.legalPhase', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: LEGAL_PHASES, enumLabelPrefix: 'domains.units.enums.legalPhase' },
    // Payment summary (denormalized)
    { key: 'commercial.paymentSummary.totalAmount', labelKey: 'domains.units.fields.paymentTotal', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'commercial.paymentSummary.paidAmount', labelKey: 'domains.units.fields.paymentPaid', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'commercial.paymentSummary.paidPercentage', labelKey: 'domains.units.fields.paymentPaidPct', type: 'percentage', filterable: true, sortable: true, defaultVisible: false, format: 'percentage' },
    { key: 'commercial.paymentSummary.overdueInstallments', labelKey: 'domains.units.fields.overdueInstallments', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Layout
    { key: 'layout.bedrooms', labelKey: 'domains.units.fields.bedrooms', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    { key: 'layout.bathrooms', labelKey: 'domains.units.fields.bathrooms', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number' },
    // Dates
    { key: 'createdAt', labelKey: 'domains.units.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
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
  units: UNITS_DEFINITION,
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
