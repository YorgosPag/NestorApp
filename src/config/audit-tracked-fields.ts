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

// ============================================================================
// BIM TRACKED FIELDS — wall / column / slab / beam / opening (ADR-363 §5.17)
// ============================================================================
//
// Coordinate-heavy fields (start/end/position/outline/polylineVertices/...)
// are intentionally OUT. They produce noise (xyz triples) every grip drag,
// and the entity_audit_trail is a human-readable history — not a geometry log.
// The dimensional intent lives in width/depth/height/thickness/etc., which
// IS tracked.

const WALL_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  category: 'category',
  height: 'height',
  thickness: 'thickness',
  flip: 'flip',
  material: 'material',
  measurementLength: 'measurementLength',
  startBevel: 'startBevel',
  endBevel: 'endBevel',
  storeyId: 'storeyId',
  offsetFromStorey: 'offsetFromStorey',
  baseBinding: 'baseBinding',
  topBinding: 'topBinding',
  baseOffset: 'baseOffset',
  topOffset: 'topOffset',
  unconnectedHeight: 'unconnectedHeight',
  // `dna` is an object (totalThickness + layers[]) — serialized as JSON scalar.
  // Per-layer diffing would need a collection def; deferred until BIM history
  // surfaces require it.
  dna: 'dna',
  // ADR-396 v2 Φάση 4 — ETICS classification override (Στρ.3). Scalar string
  // 'exterior'|'interior' (undefined=auto).
  envelopeFunction: 'envelopeFunction',
};

export const WALL_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(WALL_TRACKED_FIELDS_RAW, {});

const COLUMN_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  anchor: 'anchor',
  width: 'width',
  depth: 'depth',
  height: 'height',
  rotation: 'rotation',
  material: 'material',
  catalogProfile: 'catalogProfile',
  storeyId: 'storeyId',
  offsetFromStorey: 'offsetFromStorey',
  baseBinding: 'baseBinding',
  topBinding: 'topBinding',
  baseOffset: 'baseOffset',
  topOffset: 'topOffset',
  unconnectedHeight: 'unconnectedHeight',
  // Variant overrides serialized as JSON scalars.
  lshape: 'lshape',
  tshape: 'tshape',
  polygon: 'polygon',
  ishape: 'ishape',
  // ADR-396 P7 Part B — ETICS exterior insulation layer (Z1). Object
  // (materialId+thickness_m+zone) serialized as JSON scalar, mirror wall `dna`.
  envelopeLayer: 'envelopeLayer',
  // ADR-396 v2 Φάση 4 — ETICS classification override (Στρ.3). Scalar string.
  envelopeFunction: 'envelopeFunction',
};

export const COLUMN_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(COLUMN_TRACKED_FIELDS_RAW, {});

// ADR-406 — point-based MEP fixture (light fixture first).
const MEP_FIXTURE_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  shape: 'shape',
  width: 'width',
  length: 'length',
  bodyHeightMm: 'bodyHeightMm',
  mountingElevationMm: 'mountingElevationMm',
  rotation: 'rotation',
  material: 'material',
  storeyId: 'storeyId',
  hostId: 'hostId',
};

export const MEP_FIXTURE_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(MEP_FIXTURE_TRACKED_FIELDS_RAW, {});

// ADR-410 — mesh-based CC0 furniture (chair first).
const FURNITURE_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  assetId: 'assetId',
  widthMm: 'widthMm',
  depthMm: 'depthMm',
  heightMm: 'heightMm',
  mountingElevationMm: 'mountingElevationMm',
  rotationDeg: 'rotationDeg',
  scaleOverride: 'scaleOverride',
  material: 'material',
  storeyId: 'storeyId',
  hostId: 'hostId',
};

export const FURNITURE_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(FURNITURE_TRACKED_FIELDS_RAW, {});

// ADR-415 — pure-vector 2D floorplan symbol (WC/sanitary first).
const FLOORPLAN_SYMBOL_TRACKED_FIELDS_RAW: Record<string, string> = {
  category: 'category',
  kind: 'kind',
  layerId: 'layerId',
  assetId: 'assetId',
  widthMm: 'widthMm',
  depthMm: 'depthMm',
  rotationDeg: 'rotationDeg',
  storeyId: 'storeyId',
  hostId: 'hostId',
};

export const FLOORPLAN_SYMBOL_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(FLOORPLAN_SYMBOL_TRACKED_FIELDS_RAW, {});

// ADR-408 — logical MEP system (electrical circuit first; geometry-less). The
// `members` array serializes as a JSON scalar (mirror slab `slope`).
const MEP_SYSTEM_TRACKED_FIELDS_RAW: Record<string, string> = {
  systemType: 'systemType',
  name: 'name',
  systemClassification: 'systemClassification',
  sourceEntityId: 'sourceEntityId',
  sourceConnectorId: 'sourceConnectorId',
  members: 'members',
  ratedVoltage: 'ratedVoltage',
  poles: 'poles',
};

export const MEP_SYSTEM_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(MEP_SYSTEM_TRACKED_FIELDS_RAW, {});

// ADR-408 Φ3 — point-based electrical panel (circuit source).
const ELECTRICAL_PANEL_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  shape: 'shape',
  width: 'width',
  length: 'length',
  bodyHeightMm: 'bodyHeightMm',
  mountingElevationMm: 'mountingElevationMm',
  rotation: 'rotation',
  material: 'material',
  storeyId: 'storeyId',
  hostId: 'hostId',
};

export const ELECTRICAL_PANEL_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(ELECTRICAL_PANEL_TRACKED_FIELDS_RAW, {});

// ADR-408 Φ12 — point-based plumbing manifold (συλλέκτης, pipe-network source).
const MEP_MANIFOLD_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  shape: 'shape',
  width: 'width',
  length: 'length',
  bodyHeightMm: 'bodyHeightMm',
  mountingElevationMm: 'mountingElevationMm',
  outletCount: 'outletCount',
  inletDiameterMm: 'inletDiameterMm',
  outletDiameterMm: 'outletDiameterMm',
  rotation: 'rotation',
  material: 'material',
  storeyId: 'storeyId',
  hostId: 'hostId',
};

export const MEP_MANIFOLD_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(MEP_MANIFOLD_TRACKED_FIELDS_RAW, {});

// ADR-408 Εύρος Β — heating radiator audited fields.
const MEP_RADIATOR_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  shape: 'shape',
  width: 'width',
  length: 'length',
  bodyHeightMm: 'bodyHeightMm',
  mountingElevationMm: 'mountingElevationMm',
  connectorDiameterMm: 'connectorDiameterMm',
  thermalOutputW: 'thermalOutputW',
  rotation: 'rotation',
  material: 'material',
  storeyId: 'storeyId',
  hostId: 'hostId',
};

export const MEP_RADIATOR_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(MEP_RADIATOR_TRACKED_FIELDS_RAW, {});

// ADR-408 Εύρος Β #2 — heating boiler audited fields.
const MEP_BOILER_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  shape: 'shape',
  width: 'width',
  length: 'length',
  bodyHeightMm: 'bodyHeightMm',
  mountingElevationMm: 'mountingElevationMm',
  connectorDiameterMm: 'connectorDiameterMm',
  thermalOutputW: 'thermalOutputW',
  rotation: 'rotation',
  material: 'material',
  storeyId: 'storeyId',
  hostId: 'hostId',
  systemClassification: 'systemClassification',
};

export const MEP_BOILER_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(MEP_BOILER_TRACKED_FIELDS_RAW, {});

// ADR-408 Εύρος Β #3 — underfloor radiant heating loop (area-based hydronic terminal).
const MEP_UNDERFLOOR_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  pipeSpacingMm: 'pipeSpacingMm',
  edgeClearanceMm: 'edgeClearanceMm',
  patternType: 'patternType',
  entrySide: 'entrySide',
  screedOffsetMm: 'screedOffsetMm',
  connectorDiameterMm: 'connectorDiameterMm',
  thermalOutputW: 'thermalOutputW',
  name: 'name',
  floorId: 'floorId',
};

export const MEP_UNDERFLOOR_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(MEP_UNDERFLOOR_TRACKED_FIELDS_RAW, {});

// ADR-408 Φ8 — unified linear MEP segment (duct + pipe).
const MEP_SEGMENT_TRACKED_FIELDS_RAW: Record<string, string> = {
  domain: 'domain',
  sectionKind: 'sectionKind',
  layerId: 'layerId',
  width: 'width',
  height: 'height',
  diameter: 'diameter',
  wallThickness: 'wallThickness',
  centerlineElevationMm: 'centerlineElevationMm',
  material: 'material',
  storeyId: 'storeyId',
};

export const MEP_SEGMENT_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(MEP_SEGMENT_TRACKED_FIELDS_RAW, {});

// ADR-408 Φ11 — auto pipe fitting (junction element).
const MEP_FITTING_TRACKED_FIELDS_RAW: Record<string, string> = {
  domain: 'domain',
  kind: 'kind',
  junctionKey: 'junctionKey',
  centerlineElevationMm: 'centerlineElevationMm',
  primaryDiameterMm: 'primaryDiameterMm',
  secondaryDiameterMm: 'secondaryDiameterMm',
  elbowStyle: 'elbowStyle',
  storeyId: 'storeyId',
};

export const MEP_FITTING_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(MEP_FITTING_TRACKED_FIELDS_RAW, {});

// ADR-407 — standalone path-based railing.
const RAILING_TRACKED_FIELDS_RAW: Record<string, string> = {
  layerId: 'layerId',
  totalHeightMm: 'totalHeightMm',
  baseElevationMm: 'baseElevationMm',
  storeyId: 'storeyId',
};

export const RAILING_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(RAILING_TRACKED_FIELDS_RAW, {});

// ADR-417 — parametric pitched roof (footprint ⊥ type). Coordinate-heavy
// `outline`/`edges` are intentionally OUT (per-vertex/per-edge slope triples
// produce noise every grip drag). `dna` is the layered build-up object — JSON
// scalar, mirror wall/slab `dna`.
const ROOF_TRACKED_FIELDS_RAW: Record<string, string> = {
  layerId: 'layerId',
  thickness: 'thickness',
  basePivotZ: 'basePivotZ',
  slopeUnit: 'slopeUnit',
  material: 'material',
  dna: 'dna',
  storeyId: 'storeyId',
  offsetFromStorey: 'offsetFromStorey',
  // ADR-417 Φ2b — eave detailing (type-level scalars). `overhangMm` lives per-edge
  // inside `edges` (untracked, parity with `slope` — noise every grip drag).
  fasciaMaterial: 'fasciaMaterial',
  soffitMaterial: 'soffitMaterial',
  fasciaHeightMm: 'fasciaHeightMm',
  soffitMode: 'soffitMode',
};

export const ROOF_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(ROOF_TRACKED_FIELDS_RAW, {});

const SLAB_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  levelElevation: 'levelElevation',
  heightOffsetFromLevel: 'heightOffsetFromLevel',
  thickness: 'thickness',
  geometryType: 'geometryType',
  reinforcement: 'reinforcement',
  material: 'material',
  storeyId: 'storeyId',
  offsetFromStorey: 'offsetFromStorey',
  // `slope` is a nested object (direction/angle/pivotEdge) — JSON scalar.
  slope: 'slope',
  // ADR-396 P7 Part B — ETICS exterior insulation layer (Z2 πιλοτή / Z3 δώμα).
  // Object serialized as JSON scalar, mirror wall `dna`.
  envelopeLayer: 'envelopeLayer',
};

export const SLAB_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(SLAB_TRACKED_FIELDS_RAW, {});

const BEAM_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  width: 'width',
  depth: 'depth',
  topElevation: 'topElevation',
  zOffset: 'zOffset',
  material: 'material',
  supportType: 'supportType',
  sectionType: 'sectionType',
  profileDesignation: 'profileDesignation',
  storeyId: 'storeyId',
  offsetFromStorey: 'offsetFromStorey',
  // ADR-396 P7 Part B — ETICS exterior insulation layer (Z1). JSON scalar.
  envelopeLayer: 'envelopeLayer',
  // ADR-396 v2 Φάση 4 — ETICS classification override (Στρ.3). Scalar string.
  envelopeFunction: 'envelopeFunction',
};

export const BEAM_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(BEAM_TRACKED_FIELDS_RAW, {});

const OPENING_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  wallId: 'wallId',
  offsetFromStart: 'offsetFromStart',
  width: 'width',
  height: 'height',
  sillHeight: 'sillHeight',
  frameWidth: 'frameWidth',
  handing: 'handing',
  openDirection: 'openDirection',
  material: 'material',
  glazingPanes: 'glazingPanes',
  mark: 'mark',
  markIsManual: 'markIsManual',
  tagVisible: 'tagVisible',
  // ADR-396 P7 Part B — ETICS reveal insulation (Z4 περβάζια). JSON scalar.
  revealInsulation: 'revealInsulation',
};

export const OPENING_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(OPENING_TRACKED_FIELDS_RAW, {});

const SLAB_OPENING_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  slabId: 'slabId',
  elevationOverride: 'elevationOverride',
  multiStoreyStackGroupId: 'multiStoreyStackGroupId',
  fireRating: 'fireRating',
  material: 'material',
  sceneUnits: 'sceneUnits',
  // `outline` (Polygon3D coords) is intentionally OUT — coord triples
  // produce noise every grip drag.
};

export const SLAB_OPENING_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(SLAB_OPENING_TRACKED_FIELDS_RAW, {});

const STAIR_TRACKED_FIELDS_RAW: Record<string, string> = {
  kind: 'kind',
  layerId: 'layerId',
  // Dimensional intent (scalar)
  rise: 'rise',
  tread: 'tread',
  nosing: 'nosing',
  nosingSide: 'nosingSide',
  width: 'width',
  stepCount: 'stepCount',
  totalRise: 'totalRise',
  totalRun: 'totalRun',
  pitch: 'pitch',
  // Structure / code semantics
  structureType: 'structureType',
  riserType: 'riserType',
  codeProfile: 'codeProfile',
  nokSubType: 'nokSubType',
  antiskidNosing: 'antiskidNosing',
  adaContrastStrip: 'adaContrastStrip',
  cutPlaneHeight: 'cutPlaneHeight',
  occupancyLoad: 'occupancyLoad',
  // Walkline / direction
  walklineOffset: 'walklineOffset',
  upDirection: 'upDirection',
  // Tread labelling
  treadNumberStart: 'treadNumberStart',
  treadLabelDisplay: 'treadLabelDisplay',
  treadLabelEveryN: 'treadLabelEveryN',
  treadLabelRestartPerFlight: 'treadLabelRestartPerFlight',
  treadLabelHeight: 'treadLabelHeight',
  // Storey FK
  storeyId: 'storeyId',
  offsetFromStorey: 'offsetFromStorey',
  // Nested objects serialized as JSON scalars (per wall.dna / column.lshape pattern).
  variant: 'variant',
  multiStoryConfig: 'multiStoryConfig',
  stringerParams: 'stringerParams',
  materials: 'materials',
  handrails: 'handrails',
  // `basePoint` / `direction` / `perTreadOverrides` intentionally OUT
  // (coord triples + would explode payload per-tread).
};

export const STAIR_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(STAIR_TRACKED_FIELDS_RAW, {});

/**
 * ADR-412 Φ5 — BIM family type (Revit Type) tracked fields. The audit snapshot
 * flattens `{ name, ...typeParams }`, so `name` + the wall type-level params
 * (`category`/`thickness`/`material`/`dna`) are tracked. `dna` is an object
 * (totalThickness + layers[]) serialized as a JSON scalar — same pattern as
 * `WALL_TRACKED_FIELDS.dna`.
 */
const BIM_FAMILY_TYPE_TRACKED_FIELDS_RAW: Record<string, string> = {
  name: 'name',
  category: 'category',
  // ADR-412 — slab family types discriminate the build-up by `kind` (the slab
  // analogue of wall `category`); track it so slab-type edits diff meaningfully.
  kind: 'kind',
  thickness: 'thickness',
  material: 'material',
  dna: 'dna',
  // ADR-421 SLICE C — opening family types carry nominal dimensions + glazing/
  // fire-rating on the TYPE; track them so opening-type edits diff meaningfully.
  width: 'width',
  height: 'height',
  frameWidth: 'frameWidth',
  glazingPanes: 'glazingPanes',
  fireRating: 'fireRating',
};

export const BIM_FAMILY_TYPE_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(BIM_FAMILY_TYPE_TRACKED_FIELDS_RAW, {});

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
    case 'wall':
      return WALL_TRACKED_FIELDS;
    case 'column':
      return COLUMN_TRACKED_FIELDS;
    case 'mep-fixture':
      return MEP_FIXTURE_TRACKED_FIELDS;
    case 'mep-system':
      return MEP_SYSTEM_TRACKED_FIELDS;
    case 'electrical-panel':
      return ELECTRICAL_PANEL_TRACKED_FIELDS;
    case 'mep-manifold':
      return MEP_MANIFOLD_TRACKED_FIELDS;
    case 'mep-radiator':
      return MEP_RADIATOR_TRACKED_FIELDS;
    case 'mep-boiler':
      return MEP_BOILER_TRACKED_FIELDS;
    case 'mep-underfloor':
      return MEP_UNDERFLOOR_TRACKED_FIELDS;
    case 'mep-segment':
      return MEP_SEGMENT_TRACKED_FIELDS;
    case 'mep-fitting':
      return MEP_FITTING_TRACKED_FIELDS;
    case 'railing':
      return RAILING_TRACKED_FIELDS;
    case 'roof':
      return ROOF_TRACKED_FIELDS;
    case 'floorplan-symbol':
      return FLOORPLAN_SYMBOL_TRACKED_FIELDS;
    case 'slab':
      return SLAB_TRACKED_FIELDS;
    case 'beam':
      return BEAM_TRACKED_FIELDS;
    case 'opening':
      return OPENING_TRACKED_FIELDS;
    case 'slab-opening':
      return SLAB_OPENING_TRACKED_FIELDS;
    case 'stair':
      return STAIR_TRACKED_FIELDS;
    case 'bim_family_type':
      return BIM_FAMILY_TYPE_TRACKED_FIELDS;
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
