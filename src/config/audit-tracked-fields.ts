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
export { getTrackedFieldLabel } from '@/lib/audit/audit-diff';

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
  name: 'Όνομα',
  type: 'Τύπος',
  status: 'Κατάσταση',
  floor: 'Όροφος',
  area: 'Εμβαδόν',
  price: 'Τιμή',
  description: 'Περιγραφή',
  buildingId: 'Κτίριο',
  projectId: 'Έργο',
  // companyId intentionally omitted — it is the tenant isolation key and
  // never changes after creation. Tracking it produces noise (raw ID) with
  // no informational value for the property audit timeline.
  // Extended fields (from PropertyFieldsBlock)
  layout: 'Διαρρύθμιση',
  areas: 'Εμβαδά',
  orientations: 'Προσανατολισμοί',
  condition: 'Κατάσταση ακινήτου',
  energy: 'Ενεργειακή κλάση',
  finishes: 'Φινιρίσματα',
  interiorFeatures: 'Εσωτερικά χαρακτηριστικά',
  securityFeatures: 'Χαρακτηριστικά ασφαλείας',
  systemsOverride: 'Εγκαταστάσεις (Θέρμανση/Ψύξη)',
  // Commercial status (top-level)
  commercialStatus: 'Εμπορική κατάσταση',
  // Commercial sub-fields (dot-notation — human-readable, no internal IDs)
  'commercial.askingPrice': 'Τιμή ζητούμενη',
  'commercial.finalPrice': 'Τελική τιμή',
  'commercial.reservationDeposit': 'Προκαταβολή',
  'commercial.owners': 'Ιδιοκτήτες/Αγοραστές',
  'commercial.reservationDate': 'Ημερ. κράτησης',
  'commercial.saleDate': 'Ημερ. πώλησης',
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
  name: 'Όνομα',
  title: 'Τίτλος',
  description: 'Περιγραφή',
  status: 'Κατάσταση',
  type: 'Τύπος',

  // ── Company links (ADR-232: linkedCompanyId is business entity, companyId is tenant) ──
  company: 'Εταιρεία',
  linkedCompanyId: 'Συνδεδεμένη εταιρεία',
  linkedCompanyName: 'Επωνυμία συνδεδεμένης εταιρείας',

  // ── Location ──
  address: 'Διεύθυνση',
  city: 'Πόλη',
  addresses: 'Διευθύνσεις',
  location: 'Τοποθεσία',

  // ── Progress / financials ──
  progress: 'Πρόοδος',
  totalValue: 'Συνολική αξία',
  totalArea: 'Συνολικό εμβαδόν',
  budget: 'Προϋπολογισμός',

  // ── Timeline ──
  startDate: 'Ημερομηνία έναρξης',
  completionDate: 'Ημερομηνία ολοκλήρωσης',
  endDate: 'Ημερομηνία λήξης',
  duration: 'Διάρκεια (μήνες)',
  startYear: 'Έτος έναρξης',

  // ── Classification ──
  priority: 'Προτεραιότητα',
  riskLevel: 'Επίπεδο ρίσκου',
  complexity: 'Πολυπλοκότητα',

  // ── Permits / legal ──
  buildingBlock: 'Οικοδομικό τετράγωνο',
  protocolNumber: 'Αρ. πρωτοκόλλου',
  licenseNumber: 'Αρ. άδειας',
  issuingAuthority: 'Αρχή έκδοσης άδειας',
  issueDate: 'Ημερομηνία έκδοσης άδειας',

  // ── Feature flags ──
  hasPermits: 'Έχει άδειες',
  hasFinancing: 'Έχει χρηματοδότηση',
  isEcological: 'Οικολογικό',
  hasSubcontractors: 'Με υπεργολάβους',
  isActive: 'Ενεργό',
  hasIssues: 'Έχει ζητήματα',

  // ── ADR-244: Landowners / bartex ──
  landowners: 'Οικοπεδούχοι',
  bartexPercentage: 'Ποσοστό αντιπαροχής',
};

// ============================================================================
// CONTACT TRACKED FIELDS
// ============================================================================

/** Fields tracked for contact audit trail (raw field → Greek label) */
const CONTACT_TRACKED_FIELDS_RAW: Record<string, string> = {
  // ── Identity (shared) ──
  firstName: 'Όνομα',
  lastName: 'Επώνυμο',
  fatherName: 'Πατρώνυμο',
  motherName: 'Μητρώνυμο',
  middleName: 'Μεσαίο Όνομα',
  nickname: 'Ψευδώνυμο',
  companyName: 'Επωνυμία',
  serviceName: 'Όνομα Υπηρεσίας',
  type: 'Τύπος',
  status: 'Κατάσταση',

  // ── Individual — Personal ──
  birthDate: 'Ημ. Γέννησης',
  birthCountry: 'Χώρα Γέννησης',
  gender: 'Φύλο',
  amka: 'ΑΜΚΑ',

  // ── Individual — Identity Documents ──
  documentType: 'Τύπος Εγγράφου',
  documentIssuer: 'Εκδούσα Αρχή',
  documentNumber: 'Αρ. Εγγράφου',
  documentIssueDate: 'Ημ. Έκδοσης Εγγράφου',
  documentExpiryDate: 'Ημ. Λήξης Εγγράφου',

  // ── Tax / Legal ──
  vatNumber: 'ΑΦΜ',
  taxOffice: 'ΔΟΥ',
  idNumber: 'Αρ. Ταυτότητας',
  profession: 'Επάγγελμα',

  // ── Individual — Professional ──
  specialty: 'Ειδικότητα',
  employer: 'Εργοδότης',
  employerId: 'ID Εργοδότη',
  position: 'Θέση',
  department: 'Τμήμα',
  workAddress: 'Διεύθυνση Εργασίας',
  workWebsite: 'Ιστοσελίδα Εργασίας',
  escoLabel: 'Επάγγελμα ESCO',
  iscoCode: 'Κωδικός ISCO',
  escoSkills: 'Δεξιότητες ESCO',

  // ── Individual — Family ──
  maritalStatus: 'Οικογ. Κατάσταση',
  spouse: 'Σύζυγος',
  children: 'Τέκνα',

  // ── Contact info (arrays — serialized to JSON for diff) ──
  emails: 'Emails',
  phones: 'Τηλέφωνα',
  websites: 'Ιστοσελίδες',
  socialMedia: 'Μέσα Κοιν. Δικτύωσης',

  // ── Address fields ──
  addresses: 'Διευθύνσεις',

  // ── Categorization ──
  tags: 'Ετικέτες',
  isFavorite: 'Αγαπημένο',
  category: 'Κατηγορία',

  // ── Notes ──
  notes: 'Σημειώσεις',

  // ── Photos / Media ──
  // photoURL: excluded — derived from multiplePhotoURLs[0], not independent data
  multiplePhotoURLs: 'Φωτογραφίες',
  logoURL: 'Λογότυπο',
  representativePhotoURL: 'Φωτογραφία Εκπροσώπου',

  // ── Company-specific ──
  legalForm: 'Νομική Μορφή',
  companyType: 'Τύπος Εταιρείας',
  legalName: 'Νομική Επωνυμία',
  tradeName: 'Εμπορική Επωνυμία',
  gemiNumber: 'Αρ. ΓΕΜΗ',
  registrationNumber: 'Αρ. ΓΕΜΗ (legacy)',
  industry: 'Κλάδος',
  sector: 'Τομέας',
  numberOfEmployees: 'Αρ. Εργαζομένων',
  annualRevenue: 'Ετήσιος Κύκλος Εργασιών',
  contactPersons: 'Πρόσωπα Επικοινωνίας',
  'customFields.activities': 'Δραστηριότητες ΚΑΔ',
  'customFields.chamber': 'Επιμελητήριο / Τ.Υ. ΓΕΜΗ',
  'customFields.activityCodeKAD': 'Κύριος ΚΑΔ',
  'customFields.activityDescription': 'Περιγραφή ΚΑΔ',
  'customFields.activityType': 'Τύπος δραστηριότητας',
  'customFields.gemiStatus': 'Κατάσταση ΓΕΜΗ',
  'customFields.gemiStatusDate': 'Ημερ. Κατάστασης ΓΕΜΗ',
  'customFields.capitalAmount': 'Κεφάλαιο',
  'customFields.currency': 'Νόμισμα',
  'customFields.registrationDate': 'Ημερ. Εγγραφής',
  'customFields.lastUpdateDate': 'Ημερ. Τελ. Ενημέρωσης',
  'customFields.gemiDepartment': 'Τμήμα ΓΕΜΗ',
  'customFields.prefecture': 'Νομός',
  'customFields.municipality': 'Δήμος',

  // ── Service-specific ──
  name: 'Ονομασία Υπηρεσίας',
  shortName: 'Συντομογραφία',
  supervisionMinistry: 'Εποπτεύον Υπουργείο',
  serviceType: 'Τύπος Υπηρεσίας',
  parentOrganization: 'Μητρικός Οργανισμός',
  serviceCode: 'Κωδικός Υπηρεσίας',
  registryNumber: 'Αρ. Μητρώου',
  responsibleMinistry: 'Αρμόδιο Υπουργείο',
  division: 'Διεύθυνση',
  operatingHours: 'Ωράριο Λειτουργίας',
  responsiblePersons: 'Υπεύθυνοι Επικοινωνίας',
  servicesProvided: 'Παρεχόμενες Υπηρεσίες',

  // ── Personas (ADR-121) ──
  personas: 'Ρόλοι (Personas)',
  personaTypes: 'Τύποι Ρόλων',
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
  type: 'Τύπος Διεύθυνσης',
  isPrimary: 'Κύρια Διεύθυνση',
  label: 'Ετικέτα',
  street: 'Οδός',
  number: 'Αριθμός',
  city: 'Πόλη',
  postalCode: 'Τ.Κ.',
  region: 'Περιφέρεια',
  regionalUnit: 'Περιφερειακή Ενότητα',
  country: 'Χώρα',
  municipality: 'Δήμος',
  neighborhood: 'Περιοχή / Συνοικία',
  blockSide: 'Πλευρά Οικοδομικού Τετραγώνου',
  floor: 'Όροφος',
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
    label: 'Διευθύνσεις',
    keyBy: 'id',
    labelFields: ['type', 'street', 'number'],
    trackSubFields: ADDRESS_TRACK_SUB_FIELDS,
    subFieldLabels: ADDRESS_SUB_FIELD_LABELS,
  },
  landowners: {
    kind: 'collection',
    label: 'Οικοπεδούχοι',
    keyBy: 'contactId',
    labelFields: ['name'],
    trackSubFields: ['name', 'landOwnershipPct', 'allocatedShares'],
  },
};

const CONTACT_COLLECTION_DEFS: Record<string, CollectionDef> = {
  emails: {
    kind: 'collection',
    label: 'Emails',
    keyBy: 'email',
    labelFields: ['email'],
    trackSubFields: ['email', 'type', 'isPrimary', 'label'],
  },
  phones: {
    kind: 'collection',
    label: 'Τηλέφωνα',
    keyBy: 'number',
    labelFields: ['number'],
    trackSubFields: ['number', 'type', 'isPrimary', 'label', 'countryCode'],
  },
  websites: {
    kind: 'collection',
    label: 'Ιστοσελίδες',
    keyBy: 'url',
    labelFields: ['url'],
    trackSubFields: ['url', 'type', 'label'],
  },
  socialMedia: {
    kind: 'collection',
    label: 'Μέσα Κοιν. Δικτύωσης',
    keyBy: ['platform', 'username'],
    labelFields: ['platform', 'username'],
    trackSubFields: ['platform', 'username', 'url', 'type', 'label'],
  },
  addresses: {
    kind: 'collection',
    label: 'Διευθύνσεις',
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
    label: 'Τέκνα',
    keyBy: 'value',
  },
  contactPersons: {
    kind: 'collection',
    label: 'Πρόσωπα Επικοινωνίας',
    keyBy: ['name', 'position'],
    labelFields: ['name', 'position'],
    trackSubFields: ['name', 'position', 'department', 'email', 'phone', 'isPrimary'],
  },
  tags: {
    kind: 'collection',
    label: 'Ετικέτες',
    keyBy: 'value',
  },
  multiplePhotoURLs: {
    kind: 'collection',
    label: 'Φωτογραφίες',
    keyBy: 'value',
  },
  responsiblePersons: {
    kind: 'collection',
    label: 'Υπεύθυνοι Επικοινωνίας',
    keyBy: ['name', 'position'],
    labelFields: ['name', 'position'],
    trackSubFields: [
      'name', 'position', 'department', 'email', 'phone',
      'isPrimary', 'responsibilities', 'availableHours',
    ],
  },
  servicesProvided: {
    kind: 'collection',
    label: 'Παρεχόμενες Υπηρεσίες',
    keyBy: 'value',
  },
  personas: {
    kind: 'collection',
    label: 'Ρόλοι (Personas)',
    keyBy: ['type'],
    labelFields: ['type'],
  },
  personaTypes: {
    kind: 'collection',
    label: 'Τύποι Ρόλων',
    keyBy: 'value',
  },
  escoSkills: {
    kind: 'collection',
    label: 'Δεξιότητες ESCO',
    keyBy: ['code'],
    labelFields: ['label', 'code'],
  },
};

const PROPERTY_COLLECTION_DEFS: Record<string, CollectionDef> = {
  orientations: {
    kind: 'collection',
    label: 'Προσανατολισμοί',
    keyBy: 'value',
  },
  interiorFeatures: {
    kind: 'collection',
    label: 'Εσωτερικά χαρακτηριστικά',
    keyBy: 'value',
  },
  securityFeatures: {
    kind: 'collection',
    label: 'Χαρακτηριστικά ασφαλείας',
    keyBy: 'value',
  },
  'commercial.owners': {
    kind: 'collection',
    label: 'Ιδιοκτήτες/Αγοραστές',
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

/** Fields tracked for building audit trail (raw field → Greek label) */
const BUILDING_TRACKED_FIELDS_RAW: Record<string, string> = {
  // Identity
  name: 'Τίτλος',
  code: 'Κωδικός',
  description: 'Περιγραφή',
  status: 'Κατάσταση',
  category: 'Κατηγορία Κτιρίου',
  projectId: 'Έργο',
  // Location
  address: 'Διεύθυνση',
  city: 'Πόλη',
  addresses: 'Διευθύνσεις',
  // Metrics
  totalArea: 'Συνολικό εμβαδόν',
  builtArea: 'Δομημένο εμβαδόν',
  floors: 'Όροφοι',
  units: 'Μονάδες',
  totalValue: 'Συνολική αξία',
  progress: 'Πρόοδος',
  // Timeline
  startDate: 'Ημερομηνία έναρξης',
  completionDate: 'Ημερομηνία ολοκλήρωσης',
  // Company links
  company: 'Εταιρεία',
  linkedCompanyId: 'Συνδεδεμένη εταιρεία',
};

const BUILDING_COLLECTION_DEFS: Record<string, CollectionDef> = {
  addresses: {
    kind: 'collection',
    label: 'Διευθύνσεις',
    keyBy: 'id',
    labelFields: ['type', 'street', 'number'],
    trackSubFields: ADDRESS_TRACK_SUB_FIELDS,
    subFieldLabels: ADDRESS_SUB_FIELD_LABELS,
  },
};

/** Building audit registry — `field → TrackedFieldDef`. */
export const BUILDING_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(BUILDING_TRACKED_FIELDS_RAW, BUILDING_COLLECTION_DEFS);

/** Project audit registry — `field → TrackedFieldDef`. */
export const PROJECT_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(PROJECT_TRACKED_FIELDS_RAW, PROJECT_COLLECTION_DEFS);

/** Contact audit registry — `field → TrackedFieldDef`. */
export const CONTACT_TRACKED_FIELDS: Record<string, TrackedFieldDef> =
  mergeDefs(CONTACT_TRACKED_FIELDS_RAW, CONTACT_COLLECTION_DEFS);

/**
 * Return the tracked-fields registry for a given `AuditEntityType`, or `null`
 * if no registry exists (e.g. `floor`, `storage`, `parking` which are not yet
 * defined here — those will emit `changes: []` on creation until their
 * registries are added).
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
    case 'property':
      return PROPERTY_TRACKED_FIELDS;
    case 'project':
      return PROJECT_TRACKED_FIELDS;
    case 'contact':
      return CONTACT_TRACKED_FIELDS;
    default:
      return null;
  }
}

/** Return CONTACT_TRACKED_FIELDS filtered to only relevant fields for the given type */
export function getContactTrackedFieldsForType(
  contactType: 'individual' | 'company' | 'service' | string,
): Record<string, TrackedFieldDef> {
  let excludeSet: ReadonlySet<string>;
  switch (contactType) {
    case 'individual':
      excludeSet = new Set([...SERVICE_EXCLUSIVE, ...COMPANY_EXCLUSIVE]);
      break;
    case 'company':
      excludeSet = new Set([...SERVICE_EXCLUSIVE, ...INDIVIDUAL_EXCLUSIVE]);
      break;
    case 'service':
      excludeSet = new Set([...COMPANY_EXCLUSIVE, ...INDIVIDUAL_EXCLUSIVE]);
      break;
    default:
      return CONTACT_TRACKED_FIELDS;
  }
  return Object.fromEntries(
    Object.entries(CONTACT_TRACKED_FIELDS).filter(([field]) => !excludeSet.has(field)),
  );
}

// ============================================================================
// SHARED DIFF HELPERS — Wrappers over `@/lib/audit/audit-diff`
// ============================================================================

/**
 * Flatten a document for dot-notation tracking.
 * Accepts the new `TrackedFieldDef` map (the SSoT format).
 */
export function flattenForTracking(
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
