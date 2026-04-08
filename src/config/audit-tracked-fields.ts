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
  // Identity
  firstName: 'Όνομα',
  lastName: 'Επώνυμο',
  fatherName: 'Πατρώνυμο',
  companyName: 'Επωνυμία',
  serviceName: 'Όνομα Υπηρεσίας',
  type: 'Τύπος',
  status: 'Κατάσταση',

  // Tax / Legal
  vatNumber: 'ΑΦΜ',
  taxOffice: 'ΔΟΥ',
  idNumber: 'Αρ. Ταυτότητας',
  profession: 'Επάγγελμα',

  // Contact info (arrays — serialized to JSON for diff)
  emails: 'Emails',
  phones: 'Τηλέφωνα',

  // Address fields
  addresses: 'Διευθύνσεις',

  // Categorization
  tags: 'Ετικέτες',
  isFavorite: 'Αγαπημένο',
  category: 'Κατηγορία',

  // Notes
  notes: 'Σημειώσεις',

  // Company-specific
  legalForm: 'Νομική Μορφή',
  companyType: 'Τύπος Εταιρείας',
  industry: 'Κλάδος',
  'customFields.activities': 'Δραστηριότητες ΚΑΔ',
  'customFields.chamber': 'Επιμελητήριο / Τ.Υ. ΓΕΜΗ',
  'customFields.activityCodeKAD': 'Κύριος ΚΑΔ',
  'customFields.activityDescription': 'Περιγραφή ΚΑΔ',
  'customFields.activityType': 'Τύπος δραστηριότητας',

  // Personas (ADR-121)
  personas: 'Ρόλοι (Personas)',
};

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
 * Serialize a value to a comparable primitive for diffing.
 * Mirrors EntityAuditService.serializeValue (server-only).
 */
function serializeValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return JSON.stringify(value);
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
