/**
 * Shared internals for the deletion guard family (entity guard + link guard).
 *
 * Kept small and dependency-free so both `deletion-guard.ts` and
 * `deletion-link-guard.ts` can import without cycles.
 *
 * @module lib/firestore/deletion-common
 * @enterprise ADR-226 — Deletion Guard
 */

import 'server-only';

import { DEPENDENCY_REMEDIATIONS } from '@/config/deletion-registry';

/** Maximum document IDs returned per dependency (for UI preview) */
export const MAX_PREVIEW_IDS = 10;

/**
 * Map a collection name to its default remediation guidance (Greek).
 * Used when a dependency definition has no explicit `remediation` field.
 */
export function getDefaultRemediation(collection: string): string {
  switch (collection) {
    case 'attendance_events':
      return DEPENDENCY_REMEDIATIONS.attendanceEvents;
    case 'employment_records':
      return DEPENDENCY_REMEDIATIONS.employmentRecords;
    case 'communications':
      return DEPENDENCY_REMEDIATIONS.communications;
    case 'opportunities':
      return DEPENDENCY_REMEDIATIONS.opportunities;
    case 'properties':
    case 'parking_spaces':
    case 'storage':
      return DEPENDENCY_REMEDIATIONS.propertiesOwnership;
    case 'contact_links':
      return DEPENDENCY_REMEDIATIONS.contactLinks;
    case 'obligations':
      return DEPENDENCY_REMEDIATIONS.obligations;
    case 'construction_phases':
    case 'building_milestones':
    case 'floors':
    case 'buildings':
      return DEPENDENCY_REMEDIATIONS.constructionChildren;
    case 'accounting_invoices':
      return DEPENDENCY_REMEDIATIONS.accountingDocs;
    case 'projects':
      return DEPENDENCY_REMEDIATIONS.projectsAsCompany;
    default:
      return DEPENDENCY_REMEDIATIONS.generic;
  }
}
