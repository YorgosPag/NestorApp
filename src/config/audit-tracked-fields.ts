/**
 * Audit Trail — Tracked Fields Configuration
 *
 * Single source of truth for which fields are tracked per entity type.
 * Shared between client (diff computation) and server (validation).
 *
 * @module config/audit-tracked-fields
 * @enterprise ADR-195 — Entity Audit Trail
 */

import type { AuditFieldChange } from '@/types/audit-trail';
import {
  flattenForTracking as sharedFlattenForTracking,
  diffTrackedFields as sharedDiffTrackedFields,
  type TrackedFieldDef,
  legacyLabelMap,
} from '@/lib/audit/audit-diff';

// Re-export the SSoT type so consumers that already import from this file
// (the historical home of `*_TRACKED_FIELDS`) can keep their imports.
export type { TrackedFieldDef } from '@/lib/audit/audit-diff';

/** Narrow alias for the collection variant — one-liner so the per-entity maps stay readable. */
type CollectionDef = Extract<TrackedFieldDef, { kind: 'collection' }>;

/**
 * Merge a plain `field → label` registry with collection overrides.
 * Fields listed in `collections` are promoted to `{ kind: 'collection', ... }`;
 * the remainder default to `{ kind: 'scalar', label }`. This keeps the raw
 * label maps compact while the collection registries stay colocated with the
 * entity they describe (ADR-195 Phase 11).
 */
function mergeDefs(
  raw: Record<string, string>,
  collections: Record<string, CollectionDef>,
): Record<string, TrackedFieldDef> {
  const out: Record<string, TrackedFieldDef> = {};
  for (const [field, label] of Object.entries(raw)) {
    out[field] = field in collections ? collections[field] : { kind: 'scalar', label };
  }
  for (const [field, def] of Object.entries(collections)) {
    if (!(field in out)) out[field] = def;
  }
  return out;
}

// ============================================================================
// PROPERTY TRACKED FIELDS (Centralized — previously in properties/[id]/route.ts)
// ============================================================================

/** Fields tracked for property audit trail (raw field → Greek label) */
const PROPERTY_TRACKED_FIELDS_RAW: Record<string, string> = {
  // Core fields
  name: 'name',
  type: 'type',
  status: 'status',
  floor: 'floor',
  area: 'area',
  price: 'price',
  description: 'description',
  buildingId: 'buildingId',
  projectId: 'projectId',
  // companyId intentionally omitted — it is the tenant isolation key and
  // never changes after creation. Tracking it produces noise (raw ID) with
  // no informational value for the property audit timeline.
  // Extended fields (from PropertyFieldsBlock)
  layout: 'layout',
  areas: 'areas',
  orientations: 'orientations',
  condition: 'condition',
  energy: 'energy',
  finishes: 'finishes',
  interiorFeatures: 'interiorFeatures',
  securityFeatures: 'securityFeatures',
  systemsOverride: 'systemsOverride',
  // Commercial status (top-level)
  commercialStatus: 'commercialStatus',
  // Commercial sub-fields (dot-notation — human-readable, no internal IDs)
  'commercial.askingPrice': 'commercial.askingPrice',
  'commercial.finalPrice': 'commercial.finalPrice',
  'commercial.reservationDeposit': 'commercial.reservationDeposit',
  'commercial.owners': 'commercialOwners',
  'commercial.reservationDate': 'commercial.reservationDate',
  'commercial.saleDate': 'commercial.saleDate',
};

// ============================================================================
// PROJECT TRACKED FIELDS
// ============================================================================

/**
 * Fields tracked for project audit trail (field → Greek label).
 *
 * Used by `/api/projects/[projectId]` PATCH handler via
 * `EntityAuditService.diffFields()` / `diffFieldsWithResolution()`.
 *
 * Explicit whitelist: internal fields (`updatedAt`, `updatedBy`, `_v`, cache
 * keys, …) are intentionally excluded so they don't produce ghost entries in
 * the per-project History tab.
 */
const PROJECT_TRACKED_FIELDS_RAW: Record<string, string> = {
  // ── Identity ──
  name: 'name',
  title: 'title',
  description: 'description',
  status: 'status',
  type: 'type',

  // ── Company links (ADR-232: linkedCompanyId is business entity, companyId is tenant) ──
  company: 'company',
  linkedCompanyId: 'linkedCompanyId',
  linkedCompanyName: 'linkedCompanyName',

  // ── Location ──
  // NOTE: `address` and `city` are legacy fields auto-derived from addresses[].isPrimary.
  // They are intentionally excluded from tracking to avoid duplicate audit entries
  // whenever an address is added/edited (the `addresses` collection field already
  // captures all changes with full sub-field detail).
  addresses: 'addresses',
  location: 'location',

  // ── Progress / financials ──
  progress: 'progress',
  totalValue: 'totalValue',
  totalArea: 'totalArea',
  budget: 'budget',

  // ── Timeline ──
  startDate: 'startDate',
  completionDate: 'completionDate',
  endDate: 'endDate',
  duration: 'duration',
  startYear: 'startYear',

  // ── Classification ──
  priority: 'priority',
  riskLevel: 'riskLevel',
  complexity: 'complexity',

  // ── Permits / legal ──
  buildingBlock: 'buildingBlock',
  protocolNumber: 'protocolNumber',
  licenseNumber: 'licenseNumber',
  issuingAuthority: 'issuingAuthority',
  issueDate: 'issueDate',

  // ── Feature flags ──
  hasPermits: 'hasPermits',
  hasFinancing: 'hasFinancing',
  isEcological: 'isEcological',
  hasSubcontractors: 'hasSubcontractors',
  isActive: 'isActive',
  hasIssues: 'hasIssues',

  // ── ADR-244: Landowners / bartex ──
  landowners: 'landowners',
  bartexPercentage: 'bartexPercentage',

  // ── ADR-186 §8b: Building Code (ΝΟΚ Phase 2) ──
  // Object-typed field; per-subkey changes surface as `buildingCode → JSON diff`.
  // Sub-field expansion can be added later via a TrackedFieldDef collection definition.
  buildingCode: 'buildingCode',
};

// ============================================================================
// CONTACT TRACKED FIELDS
// ============================================================================

/** Fields tracked for contact audit trail (raw field → field identifier) */
const CONTACT_TRACKED_FIELDS_RAW: Record<string, string> = {
  // ── Identity (shared) ──
  firstName: 'firstName',
  lastName: 'lastName',
  fatherName: 'fatherName',
  motherName: 'motherName',
  middleName: 'middleName',
  nickname: 'nickname',
  companyName: 'companyName',
  serviceName: 'serviceName',
  type: 'type',
  status: 'status',

  // ── Individual — Personal ──
  birthDate: 'birthDate',
  birthCountry: 'birthCountry',
  gender: 'gender',
  amka: 'amka',

  // ── Individual — Identity Documents ──
  documentType: 'documentType',
  documentIssuer: 'documentIssuer',
  documentNumber: 'documentNumber',
  documentIssueDate: 'documentIssueDate',
  documentExpiryDate: 'documentExpiryDate',

  // ── Tax / Legal ──
  vatNumber: 'vatNumber',
  taxOffice: 'taxOffice',
  idNumber: 'idNumber',
  profession: 'profession',

  // ── Individual — Professional ──
  specialty: 'specialty',
  employer: 'employer',
  employerId: 'employerId',
  position: 'position',
  department: 'department',
  workAddress: 'workAddress',
  workWebsite: 'workWebsite',
  escoLabel: 'escoLabel',
  iscoCode: 'iscoCode',
  escoSkills: 'escoSkills',

  // ── Individual — Family ──
  maritalStatus: 'maritalStatus',
  spouse: 'spouse',
  children: 'children',

  // ── Contact info (arrays — serialized to JSON for diff) ──
  emails: 'emails',
  phones: 'phones',
  websites: 'websites',
  socialMedia: 'socialMedia',

  // ── Address fields ──
  addresses: 'addresses',

  // ── Categorization ──
  tags: 'tags',
  isFavorite: 'isFavorite',
  category: 'category',

  // ── Notes ──
  notes: 'notes',

  // ── Photos / Media ──
  // photoURL: excluded — derived from multiplePhotoURLs[0], not independent data
  multiplePhotoURLs: 'multiplePhotoURLs',
  logoURL: 'logoURL',
  representativePhotoURL: 'representativePhotoURL',

  // ── Company-specific ──
  legalForm: 'legalForm',
  companyType: 'companyType',
  legalName: 'legalName',
  tradeName: 'tradeName',
  gemiNumber: 'gemiNumber',
  registrationNumber: 'registrationNumber',
  industry: 'industry',
  sector: 'sector',
  numberOfEmployees: 'numberOfEmployees',
  annualRevenue: 'annualRevenue',
  contactPersons: 'contactPersons',
  'customFields.activities': 'customFields.activities',
  'customFields.chamber': 'customFields.chamber',
  'customFields.activityCodeKAD': 'customFields.activityCodeKAD',
  'customFields.activityDescription': 'customFields.activityDescription',
  'customFields.activityType': 'customFields.activityType',
  'customFields.gemiStatus': 'customFields.gemiStatus',
  'customFields.gemiStatusDate': 'customFields.gemiStatusDate',
  'customFields.capitalAmount': 'customFields.capitalAmount',
  'customFields.currency': 'customFields.currency',
  'customFields.registrationDate': 'customFields.registrationDate',
  'customFields.lastUpdateDate': 'customFields.lastUpdateDate',
  'customFields.gemiDepartment': 'customFields.gemiDepartment',
  'customFields.prefecture': 'customFields.prefecture',
  'customFields.municipality': 'customFields.municipality',

  // ── Service-specific ──
  name: 'name',
  shortName: 'shortName',
  supervisionMinistry: 'supervisionMinistry',
  serviceType: 'serviceType',
  parentOrganization: 'parentOrganization',
  serviceCode: 'serviceCode',
  registryNumber: 'registryNumber',
  responsibleMinistry: 'responsibleMinistry',
  division: 'division',
  operatingHours: 'operatingHours',
  responsiblePersons: 'responsiblePersons',
  servicesProvided: 'servicesProvided',

  // ── Personas (ADR-121) ──
  personas: 'personas',
  personaTypes: 'personaTypes',
};

// Fields exclusive to a specific contact type — excluded from audit diffs
// for other types to prevent noise from form defaults (e.g. serviceType on individual).
const SERVICE_EXCLUSIVE: ReadonlySet<string> = new Set([
  'name', 'shortName', 'supervisionMinistry',
  'serviceType', 'serviceName', 'parentOrganization', 'serviceCode',
  'registryNumber', 'responsibleMinistry', 'division', 'operatingHours',
  'responsiblePersons', 'servicesProvided',
]);
// Note: 'name', 'shortName', 'supervisionMinistry' are already in SERVICE_EXCLUSIVE,
// so they're excluded from individual/company diffs via that set. They must NOT
// be added to COMPANY/INDIVIDUAL exclusives, otherwise they get excluded from
// service diffs as well (excludeSet for 'service' = COMPANY ∪ INDIVIDUAL).
const COMPANY_EXCLUSIVE: ReadonlySet<string> = new Set([
  'companyName', 'legalForm', 'companyType', 'legalName', 'tradeName',
  'gemiNumber', 'registrationNumber', 'industry', 'sector', 'numberOfEmployees',
  'annualRevenue', 'contactPersons',
  'customFields.activities', 'customFields.chamber',
  'customFields.activityCodeKAD', 'customFields.activityDescription',
  'customFields.activityType', 'customFields.gemiStatus', 'customFields.gemiStatusDate',
  'customFields.capitalAmount', 'customFields.currency', 'customFields.registrationDate',
  'customFields.lastUpdateDate', 'customFields.gemiDepartment',
  'customFields.prefecture', 'customFields.municipality',
]);
const INDIVIDUAL_EXCLUSIVE: ReadonlySet<string> = new Set([
  'firstName', 'lastName', 'fatherName', 'motherName', 'middleName',
  'birthDate', 'birthCountry', 'gender', 'amka',
  'documentType', 'documentIssuer', 'documentNumber',
  'documentIssueDate', 'documentExpiryDate',
  'specialty', 'employer', 'employerId', 'position', 'department',
  'workAddress', 'workWebsite', 'escoLabel', 'iscoCode', 'escoSkills',
  'maritalStatus', 'spouse', 'children',
]);

// ============================================================================
// COLLECTION REGISTRIES (ADR-195 Phase 11 — key-based reconciliation)
// ============================================================================
//
// Any tracked field whose value is an array lives here. The audit diff
// engine reconciles by `keyBy` and emits per-item entries. Everything else
// falls through as scalar via `mergeDefs`.

const ADDRESS_SUB_FIELD_LABELS: Readonly<Record<string, string>> = {
  type: 'type',
  isPrimary: 'isPrimary',
  label: 'label',
  street: 'street',
  number: 'number',
  city: 'city',
  postalCode: 'postalCode',
  region: 'region',
  regionalUnit: 'regionalUnit',
  country: 'country',
  municipality: 'municipality',
  neighborhood: 'neighborhood',
  blockSide: 'blockSide',
  floor: 'floor',
};

const ADDRESS_TRACK_SUB_FIELDS: readonly string[] = [
  'type', 'isPrimary', 'label',
  'street', 'number', 'city', 'postalCode',
  'region', 'regionalUnit', 'country',
  'municipality', 'neighborhood',
  'blockSide', 'floor',
];

const PROJECT_COLLECTION_DEFS: Record<string, CollectionDef> = {
  addresses: {
    kind: 'collection',
    label: 'addresses',
    keyBy: 'id',
    labelFields: ['type', 'street', 'number'],
    trackSubFields: ADDRESS_TRACK_SUB_FIELDS,
    subFieldLabels: ADDRESS_SUB_FIELD_LABELS,
  },
  landowners: {
    kind: 'collection',
    label: 'landowners',
    keyBy: 'contactId',
    labelFields: ['name'],
    trackSubFields: ['name', 'landOwnershipPct', 'allocatedShares'],
  },
};

const CONTACT_COLLECTION_DEFS: Record<string, CollectionDef> = {
  emails: {
    kind: 'collection',
    label: 'emails',
    keyBy: 'email',
    labelFields: ['email'],
    trackSubFields: ['email', 'type', 'isPrimary', 'label'],
  },
  phones: {
    kind: 'collection',
    label: 'phones',
    keyBy: 'number',
    labelFields: ['number'],
    trackSubFields: ['number', 'type', 'isPrimary', 'label', 'countryCode'],
  },
  websites: {
    kind: 'collection',
    label: 'websites',
    keyBy: 'url',
    labelFields: ['url'],
    trackSubFields: ['url', 'type', 'label'],
  },
  socialMedia: {
    kind: 'collection',
    label: 'socialMedia',
    keyBy: ['platform', 'username'],
    labelFields: ['platform', 'username'],
    trackSubFields: ['platform', 'username', 'url', 'type', 'label'],
  },
  addresses: {
    kind: 'collection',
    label: 'addresses',
    keyBy: ['type', 'street', 'city', 'postalCode'],
    labelFields: ['type', 'street', 'city'],
    trackSubFields: [
      'type', 'isPrimary', 'label',
      'street', 'number', 'city', 'postalCode',
      'region', 'country',
      'municipality', 'municipalityId', 'regionalUnit',
      'decentAdmin', 'majorGeo', 'settlement', 'settlementId',
      'community', 'municipalUnit',
    ],
  },
  children: {
    kind: 'collection',
    label: 'children',
    keyBy: 'value',
  },
  contactPersons: {
    kind: 'collection',
    label: 'contactPersons',
    keyBy: ['name', 'position'],
    labelFields: ['name', 'position'],
    trackSubFields: ['name', 'position', 'department', 'email', 'phone', 'isPrimary'],
  },
  tags: {
    kind: 'collection',
    label: 'tags',
    keyBy: 'value',
  },
  multiplePhotoURLs: {
    kind: 'collection',
    label: 'multiplePhotoURLs',
    keyBy: 'value',
  },
  responsiblePersons: {
    kind: 'collection',
    label: 'responsiblePersons',
    keyBy: ['name', 'position'],
    labelFields: ['name', 'position'],
    trackSubFields: [
      'name', 'position', 'department', 'email', 'phone',
      'isPrimary', 'responsibilities', 'availableHours',
    ],
  },
  servicesProvided: {
    kind: 'collection',
    label: 'servicesProvided',
    keyBy: 'value',
  },
  personas: {
    kind: 'collection',
    label: 'personas',
    keyBy: ['type'],
    labelFields: ['type'],
  },
  personaTypes: {
    kind: 'collection',
    label: 'personaTypes',
    keyBy: 'value',
  },
  escoSkills: {
    kind: 'collection',
    label: 'escoSkills',
    keyBy: ['code'],
    labelFields: ['label', 'code'],
  },
};

const PROPERTY_COLLECTION_DEFS: Record<string, CollectionDef> = {
  orientations: {
    kind: 'collection',
    label: 'orientations',
    keyBy: 'value',
  },
  interiorFeatures: {
    kind: 'collection',
    label: 'interiorFeatures',
    keyBy: 'value',
  },
  securityFeatures: {
    kind: 'collection',
    label: 'securityFeatures',
    keyBy: 'value',
  },
  'commercial.owners': {
    kind: 'collection',
    label: 'commercialOwners',
    keyBy: 'contactId',
    labelFields: ['name'],
    trackSubFields: ['name', 'ownershipPct', 'role', 'paymentPlanId'],
  },
};

// ============================================================================
// EXPORTED REGISTRIES (TrackedFieldDef discriminated union)
// ============================================================================

/** Property audit registry — `field → TrackedFieldDef`. */
export const PROPERTY_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(PROPERTY_TRACKED_FIELDS_RAW, PROPERTY_COLLECTION_DEFS);

// ============================================================================
// BUILDING TRACKED FIELDS (ADR-195 — creation diff for service-layer writes)
// ============================================================================

/** Fields tracked for building audit trail (raw field → field identifier) */
const BUILDING_TRACKED_FIELDS_RAW: Record<string, string> = {
  // Identity
  name: 'name',
  code: 'code',
  description: 'description',
  status: 'status',
  category: 'category',
  projectId: 'projectId',
  // Location — `address`/`city` excluded (legacy derived fields, tracked via `addresses` collection)
  addresses: 'addresses',
  // Metrics
  totalArea: 'totalArea',
  builtArea: 'builtArea',
  floors: 'floors',
  units: 'units',
  totalValue: 'totalValue',
  progress: 'progress',
  // Timeline
  startDate: 'startDate',
  completionDate: 'completionDate',
  // Company links
  company: 'company',
  linkedCompanyId: 'linkedCompanyId',
};

const BUILDING_COLLECTION_DEFS: Record<string, CollectionDef> = {
  addresses: {
    kind: 'collection',
    label: 'addresses',
    keyBy: 'id',
    labelFields: ['type', 'street', 'number'],
    trackSubFields: ADDRESS_TRACK_SUB_FIELDS,
    subFieldLabels: ADDRESS_SUB_FIELD_LABELS,
  },
};

/** Building audit registry — `field → TrackedFieldDef`. */
export const BUILDING_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(BUILDING_TRACKED_FIELDS_RAW, BUILDING_COLLECTION_DEFS);

// ============================================================================
// FLOOR TRACKED FIELDS
// ============================================================================

const FLOOR_TRACKED_FIELDS_RAW: Record<string, string> = {
  name: 'name',
  number: 'number',
  buildingId: 'buildingId',
  projectId: 'projectId',
  units: 'units',
  elevation: 'elevation',
};

/** Floor audit registry — `field → TrackedFieldDef`. */
export const FLOOR_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(FLOOR_TRACKED_FIELDS_RAW, {});

// ============================================================================
// STORAGE TRACKED FIELDS
// ============================================================================

const STORAGE_TRACKED_FIELDS_RAW: Record<string, string> = {
  name: 'name',
  type: 'type',
  status: 'status',
  buildingId: 'buildingId',
  floor: 'floor',
  area: 'area',
  code: 'code',
  projectId: 'projectId',
};

/** Storage audit registry — `field → TrackedFieldDef`. */
export const STORAGE_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(STORAGE_TRACKED_FIELDS_RAW, {});

// ============================================================================
// PARKING TRACKED FIELDS
// ============================================================================

const PARKING_TRACKED_FIELDS_RAW: Record<string, string> = {
  number: 'number',
  type: 'type',
  status: 'status',
  buildingId: 'buildingId',
  floor: 'floor',
  code: 'code',
  projectId: 'projectId',
  area: 'area',
  monthlyRent: 'monthlyRent',
};

/** Parking audit registry — `field → TrackedFieldDef`. */
export const PARKING_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(PARKING_TRACKED_FIELDS_RAW, {});

/** Project audit registry — `field → TrackedFieldDef`. */
export const PROJECT_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(PROJECT_TRACKED_FIELDS_RAW, PROJECT_COLLECTION_DEFS);

/** Contact audit registry — `field → TrackedFieldDef`. */
export const CONTACT_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(CONTACT_TRACKED_FIELDS_RAW, CONTACT_COLLECTION_DEFS);

/**
 * Return the tracked-fields registry for a given `AuditEntityType`, or `null`
 * if no registry exists.
 *
 * Used by `createEntity()` (`entity-creation.service.ts`) to populate the
 * `changes` array on `action: 'created'` audit entries, so the History tab
 * shows the initial values of tracked fields.
 */
export function getTrackedFieldsForEntityAuditType(
  type: string | null,
): Record<string, TrackedFieldDef> | null {
  switch (type) {
    case 'building':
      return BUILDING_TRACKED_FIELDS;
    case 'floor':
      return FLOOR_TRACKED_FIELDS;
    case 'property':
      return PROPERTY_TRACKED_FIELDS;
    case 'project':
      return PROJECT_TRACKED_FIELDS;
    case 'contact':
      return CONTACT_TRACKED_FIELDS;
    case 'storage':
      return STORAGE_TRACKED_FIELDS;
    case 'parking':
      return PARKING_TRACKED_FIELDS;
    default:
      return null;
  }
}


// ============================================================================
// SHARED DIFF HELPERS — Wrappers over `@/lib/audit/audit-diff`
// ============================================================================

/**
 * Flatten a document using TrackedFieldDef map format (wraps audit-diff SSoT via legacyLabelMap adapter).
 */
export function flattenForTrackingDef(
  doc: Record<string, unknown>,
  trackedFields: Record<string, TrackedFieldDef>,
): Record<string, unknown> {
  return sharedFlattenForTracking(doc, legacyLabelMap(trackedFields));
}

/**
 * Compute field-level diffs between old and new document states.
 * Client-safe wrapper over the shared diff engine.
 */
export function computeEntityDiff(
  oldDoc: Record<string, unknown>,
  newDoc: Record<string, unknown>,
  trackedFields: Record<string, TrackedFieldDef>,
): AuditFieldChange[] {
  return sharedDiffTrackedFields(oldDoc, newDoc, trackedFields);
}
