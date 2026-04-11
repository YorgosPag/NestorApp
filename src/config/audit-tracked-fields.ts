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

// ============================================================================
// PROPERTY TRACKED FIELDS (Centralized — previously in properties/[id]/route.ts)
// ============================================================================

/** Fields tracked for property audit trail (field → Greek label) */
export const PROPERTY_TRACKED_FIELDS: Record<string, string> = {
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
  companyId: 'Εταιρεία',
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
// CONTACT TRACKED FIELDS
// ============================================================================

/** Fields tracked for contact audit trail (field → Greek label) */
export const CONTACT_TRACKED_FIELDS: Record<string, string> = {
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

/** Return CONTACT_TRACKED_FIELDS filtered to only relevant fields for the given type */
export function getContactTrackedFieldsForType(
  contactType: 'individual' | 'company' | 'service' | string,
): Record<string, string> {
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
// FLATTEN HELPER — Converts nested objects to dot-notation for tracking
// ============================================================================

/**
 * Flatten a document for dot-notation tracking.
 * Converts `{ commercial: { askingPrice: 100 } }` → `{ 'commercial.askingPrice': 100 }`
 *
 * Only flattens keys that have a corresponding dot-notation entry in trackedFields.
 */
export function flattenForTracking(
  doc: Record<string, unknown>,
  trackedFields: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Collect top-level keys that need flattening (e.g. 'commercial' from 'commercial.askingPrice')
  const nestedPrefixes = new Set<string>();
  for (const field of Object.keys(trackedFields)) {
    const dotIdx = field.indexOf('.');
    if (dotIdx > 0) {
      nestedPrefixes.add(field.slice(0, dotIdx));
    }
  }

  for (const [key, value] of Object.entries(doc)) {
    if (nestedPrefixes.has(key) && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Flatten nested object into dot-notation
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        const dotKey = `${key}.${subKey}`;
        if (dotKey in trackedFields) {
          result[dotKey] = subValue;
        }
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ============================================================================
// CLIENT-SIDE DIFF UTILITY
// ============================================================================

/**
 * Sort object keys recursively for stable JSON comparison.
 * Without this, { a: 1, b: 2 } and { b: 2, a: 1 } would produce different strings.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Serialize a value to a comparable primitive for diffing.
 * Uses sorted keys for stable comparison of objects/arrays.
 *
 * Empty structures ([], {all-empty-strings}) are normalized to null
 * so that `null → []` or `null → { facebook: '' }` are NOT recorded
 * as changes — they are form-initialization noise, not user edits.
 */
function serializeValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  // Empty array → null (no meaningful data)
  if (Array.isArray(value) && value.length === 0) return null;
  // Object with ALL empty/null/undefined values → null (form default noise)
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const vals = Object.values(value as Record<string, unknown>);
    if (vals.length === 0) return null;
    if (vals.every(v => v === null || v === undefined || v === '')) return null;
  }
  return JSON.stringify(sortKeys(value));
}

/**
 * Compute field-level diffs between old and new document states.
 * Supports dot-notation fields (e.g. 'commercial.askingPrice').
 *
 * Client-side equivalent of EntityAuditService.diffFields() — same logic,
 * without the `server-only` import so it can run in the browser.
 *
 * @param oldDoc - Document state before update
 * @param newDoc - Fields being updated (partial)
 * @param trackedFields - Map of field name → human-readable label
 * @returns Array of field changes (only fields that actually changed)
 */
export function computeEntityDiff(
  oldDoc: Record<string, unknown>,
  newDoc: Record<string, unknown>,
  trackedFields: Record<string, string>,
): AuditFieldChange[] {
  // Flatten both docs for dot-notation support
  const flatOld = flattenForTracking(oldDoc, trackedFields);
  const flatNew = flattenForTracking(newDoc, trackedFields);

  const changes: AuditFieldChange[] = [];

  for (const [field, label] of Object.entries(trackedFields)) {
    // Only process fields present in the update payload
    if (!(field in flatNew)) continue;

    const oldValue = flatOld[field] ?? null;
    const newValue = flatNew[field] ?? null;

    // Normalize to comparable primitives
    const oldStr = serializeValue(oldValue);
    const newStr = serializeValue(newValue);

    if (oldStr !== newStr) {
      changes.push({
        field,
        oldValue: oldStr,
        newValue: newStr,
        label,
      });
    }
  }

  return changes;
}
